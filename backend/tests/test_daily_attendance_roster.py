"""Explicit daily attendance with real HTTP endpoints and a synthetic LLM."""
import asyncio
from datetime import date, datetime, timedelta
from uuid import uuid4

import pytest
from sqlmodel import select

from app.api import meeting as api
from app.core.config import settings
from app.models.beli import BeliAccount, BeliPolicy, DailyAttendanceRoster, MorningAttendance
from app.models.base import now_cn
from app.models.iam import User, UserStatus
from app.models.todo import LeaveRequest, LeaveStatus, LeaveType
from app.schemas.meeting import SummarizeRequest
from app.services.beli import _reconcile_recorded_days
from test_beli_workflow import db
from test_summary_attendance import attendance_ledger, draft, llm

DAY = date(2026, 10, 15)


@pytest.fixture
def daily(db, llm):
    session = db[0]
    session.exec(select(BeliPolicy)).one().roster_starts_on = DAY
    session.commit()
    return db


def endpoint(meeting, action="attendance-roster"):
    return f"/api/v1/meeting/records/{meeting.id}/{action}"


def entries(people, absent=()):
    return [
        {"user_id": row["user_id"], "status": "absent" if row["user_id"] in absent else "present"}
        for row in people
    ]


def roster(client, meeting):
    response = client.get(endpoint(meeting))
    assert response.status_code == 200, response.text
    return response.json()["data"]


def confirm(client, meeting, absent=(), **extra):
    before = roster(client, meeting)
    response = client.put(endpoint(meeting), json={
        "version": before["version"], "people": entries(before["people"], absent), **extra,
    })
    assert response.status_code == 200, response.text
    return response.json()["data"]["version"]


def summarize(client, meeting, version):
    response = client.post(endpoint(meeting, "summarize"), json={
        "prompt": "Synthetic notes", "attendance_roster_version": version,
    })
    assert response.status_code == 200, response.text
    return response.text


def ledger(session):
    session.expire_all()
    return [(row.user_id, int(row.amount)) for row in attendance_ledger(session)]


def test_inactive_employee_is_not_an_expected_attendee(daily):
    session, _, employee, other, *_, client = daily
    other.status = UserStatus.INACTIVE
    session.commit()
    meeting = draft(daily, attendees=[other.display_name])
    assert [person["user_id"] for person in roster(client, meeting)["people"]] == [str(employee.id)]
    assert "error" not in summarize(client, meeting, confirm(client, meeting))
    assert session.exec(select(MorningAttendance.user_id)).all() == [employee.id]
    assert not ledger(session)


def test_disable_after_saving_requires_reconfirmation_and_does_not_charge(daily):
    session, _, employee, other, *_, client = daily
    meeting = draft(daily)
    before = roster(client, meeting)
    version = confirm(client, meeting, [str(other.id)])
    other.status = UserStatus.INACTIVE
    session.commit()
    current = roster(client, meeting)
    assert current["version"] == version and current["needs_confirmation"]
    assert [person["user_id"] for person in current["people"]] == [str(employee.id)]
    assert client.put(endpoint(meeting), json={
        "version": version, "people": entries(before["people"]),
    }).status_code == 400
    assert client.post(endpoint(meeting, "summarize"), json={
        "prompt": "Synthetic notes", "attendance_roster_version": version,
    }).status_code == 409
    version = confirm(client, meeting)
    assert not roster(client, meeting)["needs_confirmation"]
    assert "error" not in summarize(client, meeting, version)
    assert session.exec(select(MorningAttendance.user_id)).all() == [employee.id]
    assert not ledger(session)


def test_disable_during_generation_aborts_settlement(daily):
    session, boss, _, other, *_ = daily
    client = daily[-1]
    meeting = draft(daily)
    version = confirm(client, meeting, [str(other.id)])

    async def run():
        generation = await api.summarize_meeting(meeting.id, SummarizeRequest(
            prompt="In progress", attendance_roster_version=version), session, boss)
        other.status = UserStatus.INACTIVE
        session.commit()
        assert "error" in "".join([part async for part in generation.body_iterator])

    asyncio.run(run())
    assert not ledger(session)
    assert meeting.summary is None and roster(client, meeting)["needs_confirmation"]
    assert not session.exec(select(MorningAttendance)).all()


def test_inactive_not_in_current_stats_but_settled_history_is_preserved(daily):
    session, _, employee, other, *_, client = daily
    meeting = draft(daily)
    summarize(client, meeting, confirm(client, meeting, [str(other.id)]))
    other.status = UserStatus.INACTIVE
    today = now_cn().date()
    session.add_all([MorningAttendance(day=today, user_id=other.id),
                     MorningAttendance(day=today, user_id=employee.id)])
    session.add(LeaveRequest(applicant_user_id=other.id, leave_type=LeaveType.ANNUAL,
        start_at=datetime.combine(DAY, datetime.min.time()) + timedelta(hours=10),
        end_at=datetime.combine(DAY, datetime.min.time()) + timedelta(hours=12),
        status=LeaveStatus.APPROVED))
    session.commit()
    _reconcile_recorded_days(session.bind)
    assert ledger(session) == [(other.id, -500)]
    current = client.get(f"/api/v1/beli/attendance?day={today}").json()["data"]
    assert current["total"] == 1
    assert [row["user_id"] for row in current["items"]] == [str(employee.id)]
    past = client.get(f"/api/v1/beli/attendance?day={DAY}").json()["data"]
    charged = [row for row in past["items"] if row["charged"]]
    assert len(charged) == 1 and charged[0]["user_id"] == str(other.id)
    assert client.post(f"/api/v1/beli/attendance/{charged[0]['id']}/void",
                       json={"reason": "Synthetic waiver"}).status_code == 200
    assert ledger(session) == [(other.id, -500), (other.id, 500)]


def test_eight_people_only_one_absent_then_corrected(daily):
    session, boss, employee, other, *_, client = daily
    for index in range(6):
        session.add(User(display_name=f"Staff {index}", manager_user_id=boss.id,
                         created_at=datetime(2020, 1, 1)))
    session.commit()
    meeting = draft(daily, attendees=[other.display_name])
    second = draft(daily, attendees=[])
    data = roster(client, meeting)
    assert len(data["people"]) == 8
    assert {row["status"] for row in data["people"]} == {"pending"}
    assert next(row for row in data["people"] if row["user_id"] == str(other.id))["suggested_present"]
    assert client.post(endpoint(meeting, "summarize"), json={"prompt": "Notes"}).status_code == 409
    version = confirm(client, meeting, [str(other.id)])
    assert roster(client, second)["version"] == version
    _reconcile_recorded_days(session.bind)
    assert ledger(session) == []
    assert "error" not in summarize(client, meeting, version)
    assert ledger(session) == [(other.id, -500)]
    assert session.exec(select(BeliAccount.user_id)).all() == [other.id]
    assert session.exec(select(MorningAttendance).where(MorningAttendance.user_id == employee.id)).one().revision == 0

    assert "error" not in summarize(client, second, version)
    assert ledger(session) == [(other.id, -500)]
    session.commit()
    assert client.delete(endpoint(meeting, "").rstrip("/")).status_code == 200
    _reconcile_recorded_days(session.bind)
    assert ledger(session) == [(other.id, -500)]
    changed_version = confirm(client, second)
    _reconcile_recorded_days(session.bind)
    assert ledger(session) == [(other.id, -500)]
    assert "error" not in summarize(client, second, changed_version)
    assert ledger(session) == [(other.id, -500), (other.id, 500)]
    assert "error" not in summarize(client, second, changed_version)
    _reconcile_recorded_days(session.bind)
    assert ledger(session) == [(other.id, -500), (other.id, 500)]
    assert roster(client, second)["settled_version"] == changed_version


def test_all_present_does_not_initialize_accounts_or_post_ledger(daily):
    session, *_, client = daily
    meeting = draft(daily, attendees=[])
    assert "error" not in summarize(client, meeting, confirm(client, meeting))
    assert not ledger(session)
    assert not session.exec(select(BeliAccount)).all()


def test_requires_current_complete_confirmation_and_permission(daily, monkeypatch):
    session, boss, employee, other, _, actor, client = daily
    meeting = draft(daily)
    people = roster(client, meeting)["people"]
    all_present = entries(people)
    for invalid in [[], all_present[:1], all_present + all_present[:1],
                    [{**all_present[0], "user_id": str(uuid4())}, all_present[1]]]:
        assert client.put(endpoint(meeting), json={"version": 0, "people": invalid}).status_code == 400
    all_absent = entries(people, [str(employee.id), str(other.id)])
    assert client.put(endpoint(meeting), json={"version": 0, "people": all_absent}).status_code == 400
    assert client.put(endpoint(meeting), json={
        "version": 0, "people": all_absent, "confirm_all_absent": True,
    }).status_code == 200
    assert client.put(endpoint(meeting), json={"version": 0, "people": all_present}).status_code == 409
    assert client.post(endpoint(meeting, "summarize"), json={
        "prompt": "Notes", "attendance_roster_version": 2,
    }).status_code == 409
    actor[0] = employee
    monkeypatch.setattr(settings, "ENFORCE_RBAC", True)
    assert client.get(endpoint(meeting)).status_code == 403
    assert client.put(endpoint(meeting), json={"version": 1, "people": all_present}).status_code == 403
    assert not ledger(session)


@pytest.mark.parametrize("mode", ["truncated", "partial_error", "http_error", "ok"])
def test_unfinished_summary_does_not_replace_settlement(daily, llm, mode):
    session, _, _, other, *_, client = daily
    meeting = draft(daily)
    version = confirm(client, meeting, [str(other.id)])
    assert "error" not in summarize(client, meeting, version)
    correction = confirm(client, meeting)
    llm.append(("" if mode == "ok" else "partial", mode))
    assert "error" in summarize(client, meeting, correction)
    assert roster(client, meeting)["settled_version"] == version
    assert ledger(session) == [(other.id, -500)]
    assert meeting.summary == "Summary"


def test_stale_roster_and_same_day_newer_generation_across_meetings(daily, llm):
    session, boss, employee, other, *_, client = daily
    first, second = draft(daily), draft(daily)
    first_version = confirm(client, first, [str(employee.id)])
    ids = first.id, second.id

    async def run():
        stale = await api.summarize_meeting(ids[0], SummarizeRequest(
            prompt="Stale", attendance_roster_version=first_version), session, boss)
        next_version = confirm(client, second, [str(other.id)])
        assert "error" in "".join([part async for part in stale.body_iterator])
        req = SummarizeRequest(prompt="Concurrent", attendance_roster_version=next_version)
        old = await api.summarize_meeting(ids[0], req, session, boss)
        new = await api.summarize_meeting(ids[1], req, session, boss)
        llm.extend([("Newest summary", "ok"), ("Old result", "ok")])
        assert "error" not in "".join([part async for part in new.body_iterator])
        assert "error" in "".join([part async for part in old.body_iterator])

    asyncio.run(run())
    assert ledger(session) == [(other.id, -500)]
    assert first.summary is None and second.summary == "Newest summary"
    assert session.exec(select(DailyAttendanceRoster)).one().settled_version == first_version + 1


def test_history_not_reconciled_and_old_summary_still_works(daily):
    session, _, employee, *_, client = daily
    meeting = draft(daily, day=date(2026, 10, 14))
    past_row = MorningAttendance(day=meeting.meeting_date, user_id=employee.id, absent=True, charged=True, revision=1)
    session.add(past_row)
    session.commit()
    assert roster(client, meeting) == {"enabled": False}
    result = client.post(endpoint(meeting, "summarize"), json={"prompt": "Historical notes"})
    assert result.status_code == 200 and "[DONE]" in result.text
    _reconcile_recorded_days(session.bind)
    assert not ledger(session)
    assert past_row.charged and past_row.revision == 1


def test_day_keeps_leave_and_waiver_exemptions(daily):
    session, _, employee, other, *_, client = daily
    session.add(LeaveRequest(applicant_user_id=employee.id, leave_type=LeaveType.ANNUAL,
        start_at=datetime(2026, 10, 15, 10), end_at=datetime(2026, 10, 15, 12),
        reason="Synthetic leave", status=LeaveStatus.APPROVED))
    session.commit()
    meeting = draft(daily)
    version = confirm(client, meeting, [str(employee.id), str(other.id)], confirm_all_absent=True)
    assert "error" not in summarize(client, meeting, version)
    assert ledger(session) == [(other.id, -500)]
    row = session.exec(select(MorningAttendance).where(MorningAttendance.user_id == other.id)).one()
    assert client.post(f"/api/v1/beli/attendance/{row.id}/void", json={"reason": "Synthetic waiver"}).status_code == 200
    summarize(client, meeting, version)
    assert ledger(session) == [(other.id, -500), (other.id, 500)]


def test_accounting_failure_rolls_back_summary_and_settled_roster(daily, monkeypatch, llm):
    session, _, _, other, *_, client = daily
    meeting = draft(daily)
    first_version = confirm(client, meeting)
    summarize(client, meeting, first_version)
    changed = confirm(client, meeting, [str(other.id)])
    reconcile = api.reconcile_attendance

    def fail_after_writes(db, day):
        reconcile(db, day)
        raise RuntimeError("Synthetic transaction failure")

    monkeypatch.setattr(api, "reconcile_attendance", fail_after_writes)
    llm.append(("Unsaved correction", "ok"))
    assert "error" in summarize(client, meeting, changed)
    assert ledger(session) == []
    assert not session.exec(select(BeliAccount)).all()
    assert roster(client, meeting)["settled_version"] == first_version
    assert meeting.summary == "Summary"
