import asyncio
from datetime import date
from decimal import Decimal
from pathlib import Path
import sys
from uuid import uuid4

from sqlmodel import Session, SQLModel, create_engine

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app import models  # noqa: F401
from app.api.finance import delete_voided_transaction, export_transactions
from app.core.exceptions import AtlasException
from app.models.contract import Counterparty, CounterpartyType
from app.models.finance import (
    AccountCategory,
    AccountStatus,
    FinanceAccount,
    FinanceTransaction,
    ReconcileStatus,
    TransactionDirection,
    TransactionType,
)
from app.models.iam import OurEntity, OurEntityStatus, OurEntityType, User, UserStatus


def _make_session() -> Session:
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _seed_user(session: Session) -> User:
    user = User(
        display_name="Finance Tester",
        username=f"finance_{uuid4().hex[:6]}",
        status=UserStatus.ACTIVE,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _seed_entity(session: Session) -> OurEntity:
    entity = OurEntity(
        name=f"Finance Entity {uuid4().hex[:6]}",
        type=OurEntityType.COMPANY,
        status=OurEntityStatus.ACTIVE,
    )
    session.add(entity)
    session.commit()
    session.refresh(entity)
    return entity


def _seed_account(session: Session) -> FinanceAccount:
    counterparty = Counterparty(
        name=f"Account Owner {uuid4().hex[:6]}",
        type=CounterpartyType.ORGANIZATION.value,
    )
    session.add(counterparty)
    session.commit()
    session.refresh(counterparty)

    account = FinanceAccount(
        entity_id=counterparty.id,
        account_category=AccountCategory.PUBLIC,
        account_name="Test Account",
        initial_balance=Decimal("0"),
        status=AccountStatus.ACTIVE,
    )
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


def _seed_transaction(session: Session, *, voided: bool = False) -> FinanceTransaction:
    user = _seed_user(session)
    entity = _seed_entity(session)
    account = _seed_account(session)
    txn = FinanceTransaction(
        our_entity_id=entity.id,
        account_id=account.id,
        txn_type=TransactionType.PAYMENT,
        txn_direction=TransactionDirection.OUT,
        amount=Decimal("123.45"),
        txn_date=date(2026, 7, 1),
        purpose="测试导出和删除",
        reconcile_status=ReconcileStatus.UNRECONCILED,
        voided=voided,
        created_by_user_id=user.id,
    )
    session.add(txn)
    session.commit()
    session.refresh(txn)
    return txn


def test_delete_transaction_requires_voided_transaction():
    with _make_session() as session:
        current_user = _seed_user(session)
        txn = _seed_transaction(session, voided=False)

        try:
            asyncio.run(delete_voided_transaction(txn.id, session=session, current_user=current_user))
        except AtlasException as exc:
            assert "只能删除已作废" in exc.message
        else:
            raise AssertionError("Expected AtlasException")

        assert session.get(FinanceTransaction, txn.id) is not None


def test_delete_voided_transaction_removes_record():
    with _make_session() as session:
        current_user = _seed_user(session)
        txn = _seed_transaction(session, voided=True)

        resp = asyncio.run(delete_voided_transaction(txn.id, session=session, current_user=current_user))

        assert resp["code"] == 0
        assert session.get(FinanceTransaction, txn.id) is None


def test_export_transactions_uses_ascii_safe_content_disposition_and_xlsx_body():
    with _make_session() as session:
        current_user = _seed_user(session)
        _seed_transaction(session, voided=True)

        response = asyncio.run(
            export_transactions(
                status="voided",
                date_from=None,
                date_to=None,
                account_id=None,
                txn_direction=None,
                session=session,
                current_user=current_user,
            )
        )

        content_disposition = response.headers["content-disposition"]
        assert "filename=transactions.xlsx" in content_disposition
        assert "filename*=UTF-8''" in content_disposition
        content_disposition.encode("latin-1")
        async def collect_body():
            chunks = []
            async for chunk in response.body_iterator:
                chunks.append(chunk)
            return b"".join(chunks)

        body = asyncio.run(collect_body())
        assert body.startswith(b"PK")
