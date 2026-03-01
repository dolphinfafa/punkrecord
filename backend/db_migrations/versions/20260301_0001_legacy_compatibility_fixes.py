"""legacy compatibility fixes

Revision ID: 20260301_0001
Revises:
Create Date: 2026-03-01 10:45:00
"""

from __future__ import annotations

from datetime import datetime

from alembic import op
import sqlalchemy as sa


revision = "20260301_0001"
down_revision = None
branch_labels = None
depends_on = None


def _has_table(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _get_columns(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table_name)}


def _ensure_user_columns(inspector: sa.Inspector) -> None:
    if not _has_table(inspector, "user"):
        return

    columns = _get_columns(inspector, "user")
    current_year = datetime.utcnow().year
    user_leave_defaults = {
        "leave_annual_remaining": 5.0,
        "leave_maternity_remaining": 15.0,
        "leave_marriage_remaining": 3.0,
        "leave_personal_remaining": 3.0,
        "leave_sick_remaining": 3.0,
    }

    if "beili_balance" not in columns:
        op.add_column(
            "user",
            sa.Column("beili_balance", sa.Float(), nullable=False, server_default=sa.text("0")),
        )
        columns.add("beili_balance")
    op.execute("UPDATE user SET beili_balance = 0 WHERE beili_balance IS NULL")

    if "leave_balance_reset_year" not in columns:
        op.add_column(
            "user",
            sa.Column(
                "leave_balance_reset_year",
                sa.Integer(),
                nullable=False,
                server_default=sa.text(str(current_year)),
            ),
        )
        columns.add("leave_balance_reset_year")
    op.execute(
        f"UPDATE user SET leave_balance_reset_year = {current_year} "
        "WHERE leave_balance_reset_year IS NULL"
    )

    for col_name, default_val in user_leave_defaults.items():
        if col_name not in columns:
            op.add_column(
                "user",
                sa.Column(col_name, sa.Float(), nullable=False, server_default=sa.text(str(default_val))),
            )
            columns.add(col_name)
        op.execute(f"UPDATE user SET {col_name} = {default_val} WHERE {col_name} IS NULL")


def _ensure_beli_rule_columns(inspector: sa.Inspector) -> None:
    if not _has_table(inspector, "beli_rule"):
        return

    columns = _get_columns(inspector, "beli_rule")
    if "rule_type" not in columns:
        op.add_column(
            "beli_rule",
            sa.Column("rule_type", sa.String(length=64), nullable=False, server_default="task_timeliness"),
        )
    op.execute(
        "UPDATE beli_rule "
        "SET rule_type = 'task_timeliness' "
        "WHERE rule_type IS NULL OR rule_type = ''"
    )


def _ensure_project_columns(inspector: sa.Inspector) -> None:
    if _has_table(inspector, "project"):
        project_columns = _get_columns(inspector, "project")
        if "attachments" not in project_columns:
            op.add_column("project", sa.Column("attachments", sa.JSON(), nullable=True))
        op.execute("UPDATE project SET attachments = '[]' WHERE attachments IS NULL")

    if _has_table(inspector, "project_stage"):
        stage_columns = _get_columns(inspector, "project_stage")
        if "attachments" not in stage_columns:
            op.add_column("project_stage", sa.Column("attachments", sa.JSON(), nullable=True))
        op.execute("UPDATE project_stage SET attachments = '[]' WHERE attachments IS NULL")


def _ensure_finance_transaction_columns(inspector: sa.Inspector) -> None:
    if not _has_table(inspector, "finance_transaction"):
        return

    columns = _get_columns(inspector, "finance_transaction")
    if "txn_type" not in columns:
        op.add_column(
            "finance_transaction",
            sa.Column("txn_type", sa.String(length=32), nullable=False, server_default="payment"),
        )
        columns.add("txn_type")
    if "employee_user_id" not in columns:
        op.add_column("finance_transaction", sa.Column("employee_user_id", sa.CHAR(length=32), nullable=True))

    op.execute(
        "UPDATE finance_transaction SET txn_type = CASE "
        "WHEN LOWER(txn_direction) = 'in' OR txn_direction = 'IN' THEN 'RECEIPT' "
        "ELSE 'PAYMENT' END "
        "WHERE txn_type IS NULL OR txn_type = ''"
    )
    op.execute(
        "UPDATE finance_transaction SET txn_type = CASE "
        "WHEN LOWER(txn_type) = 'receipt' THEN 'RECEIPT' "
        "WHEN LOWER(txn_type) = 'payment' THEN 'PAYMENT' "
        "WHEN LOWER(txn_type) = 'reimbursement' THEN 'REIMBURSEMENT' "
        "ELSE txn_type END "
        "WHERE txn_type IS NOT NULL "
        "AND LOWER(txn_type) IN ('receipt', 'payment', 'reimbursement') "
        "AND txn_type NOT IN ('RECEIPT', 'PAYMENT', 'REIMBURSEMENT')"
    )
    op.execute(
        "UPDATE finance_transaction SET reconcile_status = CASE "
        "WHEN LOWER(reconcile_status) = 'unreconciled' THEN 'UNRECONCILED' "
        "WHEN LOWER(reconcile_status) = 'completed' THEN 'COMPLETED' "
        "WHEN LOWER(reconcile_status) = 'reconciled' THEN 'RECONCILED' "
        "ELSE reconcile_status END "
        "WHERE reconcile_status IS NOT NULL "
        "AND LOWER(reconcile_status) IN ('unreconciled', 'completed', 'reconciled') "
        "AND reconcile_status NOT IN ('UNRECONCILED', 'COMPLETED', 'RECONCILED')"
    )


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    _ensure_user_columns(inspector)
    _ensure_beli_rule_columns(inspector)
    _ensure_project_columns(inspector)
    _ensure_finance_transaction_columns(inspector)


def downgrade() -> None:
    # This migration backfills/normalizes legacy data; destructive downgrade is intentionally omitted.
    pass
