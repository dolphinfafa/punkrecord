"""Summary-triggered attendance uses only synthetic data and an in-memory LLM."""
import asyncio
import json
from collections import deque
from datetime import date, datetime

import pytest
from sqlmodel import select

from app.api import meeting as api
from app.models.beli import BeliLedger, MorningAttendance
from app.models.meeting import MeetingRecord, MeetingStatus
from app.schemas.meeting import SummarizeRequest
from app.services.beli import _reconcile_recorded_days, reconcile_attendance
from test_beli_workflow import db


@pytest.fixture
def llm(db, monkeypatch):
    session = db[0]
    monkeypatch.setattr(api, 'engine', session.bind)
    outcomes = deque()

    class Stream:
        def __init__(self):
            self.text, self.mode = outcomes.popleft() if outcomes else ('Summary', 'ok')

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        def raise_for_status(self):
            if self.mode == 'http_error':
                raise RuntimeError('Synthetic upstream failure')

        async def aiter_lines(self):
            if self.text:
                yield 'data: ' + json.dumps({'choices': [{'delta': {'content': self.text}}]})
            if self.mode == 'partial_error':
                raise RuntimeError('Synthetic interrupted stream')
            if self.mode != 'truncated':
                yield 'data: [DONE]'

    class Client:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        def stream(self, *args, **kwargs):
            return Stream()

    monkeypatch.setattr(api.httpx, 'AsyncClient', Client)
    return outcomes


def draft(db, *, day=date(2026, 10, 15), attendees=None, kind='morning'):
    session, boss, employee, *_ = db
    row = MeetingRecord(title='Synthetic meeting', meeting_type=kind, meeting_date=day,
                        status=MeetingStatus.TRANSCRIBED, created_by=boss.id,
                        attendees=attendees if attendees is not None else [employee.display_name])
    session.add(row)
    session.commit()
    return row


def summarize(db, row):
    session, *_, client = db
    response = client.post(f'/api/v1/meeting/records/{row.id}/summarize', json={'prompt': 'Synthetic notes'})
    assert response.status_code == 200, response.text
    session.expire_all()
    return response.text


def attendance_ledger(session):
    return session.exec(select(BeliLedger).where(BeliLedger.kind.in_(['attendance', 'attendance_reverse']))).all()


def test_create_edit_and_background_worker_do_not_settle_before_summary(db, llm):
    session, boss, employee, other, _, _, client = db
    response = client.post('/api/v1/meeting/records', data={
        'title': 'Draft morning', 'meeting_type': 'morning', 'meeting_date': '2026-10-15'})
    assert response.status_code == 200
    row = session.get(MeetingRecord, response.json()['data']['id'])
    assert client.patch(f'/api/v1/meeting/records/{row.id}/transcript', json={
        'replace': True, 'segments': [{'speaker_id': 'speaker_1', 'content': 'Synthetic words'}]}).status_code == 200
    assert client.put(f'/api/v1/meeting/records/{row.id}/speakers', json={
        'speaker_mapping': {'speaker_1': employee.display_name},
        'speaker_user_mapping': {'speaker_1': str(employee.id)}}).status_code == 200
    _reconcile_recorded_days(session.bind)
    assert not session.exec(select(MorningAttendance)).all()
    assert not attendance_ledger(session)
    assert '[DONE]' in summarize(db, row)
    assert session.get(MeetingRecord, row.id).attendance_snapshot['present_user_ids'] == [str(employee.id)]
    assert len(attendance_ledger(session)) == 1
    assert attendance_ledger(session)[0].user_id == other.id


def test_latest_summary_replaces_roster_and_repeated_summary_is_idempotent(db, llm):
    session, _, employee, other, _, _, client = db
    row = draft(db)
    summarize(db, row)
    assert len(session.exec(select(MorningAttendance)).all()) == 2
    assert len(attendance_ledger(session)) == 1
    assert client.patch(f'/api/v1/meeting/records/{row.id}/attendees', json={
        'attendees': [employee.display_name, other.display_name]}).status_code == 200
    _reconcile_recorded_days(session.bind)
    assert len(attendance_ledger(session)) == 1
    summarize(db, row)
    assert [entry.amount for entry in attendance_ledger(session)] == [-500, 500]
    for _ in range(2):
        summarize(db, row)
        _reconcile_recorded_days(session.bind)
    assert len(attendance_ledger(session)) == 2
    client.patch(f'/api/v1/meeting/records/{row.id}/attendees', json={'attendees': [other.display_name]})
    summarize(db, row)
    assert len(attendance_ledger(session)) == 3
    rows = {item.user_id: item for item in session.exec(select(MorningAttendance)).all()}
    assert rows[employee.id].charged and not rows[other.id].charged


@pytest.mark.parametrize('mode,text', [('http_error', ''), ('partial_error', 'Partial'), ('truncated', 'Partial'), ('ok', '')])
def test_failed_summary_keeps_previous_summary_snapshot_and_ledger(db, llm, mode, text):
    session, _, employee, other, _, _, client = db
    row = draft(db)
    summarize(db, row)
    previous = row.attendance_snapshot.copy()
    client.patch(f'/api/v1/meeting/records/{row.id}/attendees', json={'attendees': [other.display_name]})
    llm.append((text, mode))
    assert 'error' in summarize(db, row)
    session.refresh(row)
    assert row.summary == 'Summary' and row.attendance_snapshot == previous
    assert len(attendance_ledger(session)) == 1
    _reconcile_recorded_days(session.bind)
    assert len(attendance_ledger(session)) == 1


def test_failed_first_summary_does_not_charge(db, llm):
    session = db[0]
    row = draft(db)
    llm.append(('Partial', 'partial_error'))
    summarize(db, row)
    assert row.attendance_snapshot is None and row.summary is None
    _reconcile_recorded_days(session.bind)
    assert not attendance_ledger(session)


def test_document_creation_does_not_charge_until_summary(db, llm):
    from test_feedback_regressions import docx_bytes
    session, _, employee, other, *_, client = db
    response = client.post('/api/v1/meeting/records', data={
        'title': 'Document morning', 'meeting_type': 'morning', 'meeting_date': '2026-10-15'},
        files={'transcript_file': ('meeting.docx', docx_bytes(employee.username + ': Synthetic notes'))})
    assert response.status_code == 200, response.text
    row = session.get(MeetingRecord, response.json()['data']['id'])
    _reconcile_recorded_days(session.bind)
    assert row.attendance_snapshot is None and not attendance_ledger(session)
    summarize(db, row)
    assert len(attendance_ledger(session)) == 1 and attendance_ledger(session)[0].user_id == other.id
    public = client.get(f'/api/v1/meeting/records/{row.id}').json()['data']
    assert 'attendance_snapshot' not in public and 'summary_generation_id' not in public


def test_failed_new_request_cannot_be_replaced_by_an_older_inflight_request(db, llm):
    session, boss, employee, other, *_ = db
    row = draft(db)
    summarize(db, row)
    previous = row.attendance_snapshot.copy()

    async def run():
        older = await api.summarize_meeting(row.id, SummarizeRequest(prompt='Older'), session, boss)
        row.attendees = [other.display_name]
        session.add(row); session.commit()
        newest = await api.summarize_meeting(row.id, SummarizeRequest(prompt='Newest'), session, boss)
        llm.extend([('Partial', 'partial_error'), ('Old inflight result', 'ok')])
        awaitable = [part async for part in newest.body_iterator]
        assert any('error' in part for part in awaitable)
        old_events = [part async for part in older.body_iterator]
        assert any('error' in part for part in old_events)

    asyncio.run(run())
    session.expire_all()
    assert row.summary == 'Summary' and row.attendance_snapshot == previous
    assert len(attendance_ledger(session)) == 1


def test_summary_captures_roster_at_request_time_and_older_request_cannot_overwrite(db, llm):
    session, boss, employee, other, *_ = db
    row = draft(db)

    async def run():
        old = await api.summarize_meeting(row.id, SummarizeRequest(prompt='Old request'), session, boss)
        row.attendees = [other.display_name]
        session.add(row); session.commit()
        newest = await api.summarize_meeting(row.id, SummarizeRequest(prompt='New request'), session, boss)
        row.attendees = [employee.display_name, other.display_name]
        session.add(row); session.commit()
        llm.extend([('Newest summary', 'ok'), ('Stale summary', 'ok')])
        new_events = ''.join([part async for part in newest.body_iterator])
        old_events = ''.join([part async for part in old.body_iterator])
        return new_events, old_events

    new_events, old_events = asyncio.run(run())
    assert 'error' not in new_events and 'error' in old_events
    session.expire_all()
    assert row.summary == 'Newest summary'
    assert row.attendance_snapshot['present_user_ids'] == [str(other.id)]
    assert len(attendance_ledger(session)) == 1 and attendance_ledger(session)[0].user_id == employee.id


def test_asr_and_document_edits_keep_previous_snapshot_until_next_summary(db, llm, monkeypatch):
    session, _, employee, other, *_ = db
    row = draft(db)
    summarize(db, row)
    snapshot = row.attendance_snapshot.copy()

    async def asr(*args):
        return {'segments': [{'speaker_id': 'speaker_1', 'content': 'New words'}]}

    monkeypatch.setattr(api, 'submit_asr_task', asr)
    asyncio.run(api._run_asr(row.id))
    session.expire_all()
    assert row.attendance_snapshot == snapshot and row.speaker_mapping == {}
    _reconcile_recorded_days(session.bind)
    assert len(attendance_ledger(session)) == 1
    parsed = api._parse_transcript_text(other.display_name + ': New document')
    api._apply_transcript_import(row, parsed, session)
    session.commit()
    _reconcile_recorded_days(session.bind)
    assert row.attendance_snapshot == snapshot and len(attendance_ledger(session)) == 1
    summarize(db, row)
    assert row.attendance_snapshot['present_user_ids'] == [str(other.id)]
    assert len(attendance_ledger(session)) == 3


def test_same_day_union_only_includes_summarized_meetings_and_delete_reconciles(db, llm):
    session, _, employee, other, *_, client = db
    first = draft(db)
    second = draft(db, attendees=[other.display_name])
    summarize(db, first)
    assert len(attendance_ledger(session)) == 1
    summarize(db, second)
    assert sum(entry.amount for entry in attendance_ledger(session)) == 0
    assert client.delete(f'/api/v1/meeting/records/{second.id}').status_code == 200
    assert sum(entry.amount for entry in attendance_ledger(session)) == -500
    assert client.delete(f'/api/v1/meeting/records/{first.id}').status_code == 200
    assert sum(entry.amount for entry in attendance_ledger(session)) == 0


def test_non_morning_and_future_summary_rules(db, llm, monkeypatch):
    session = db[0]
    weekly = draft(db, kind='weekly')
    summarize(db, weekly)
    assert weekly.attendance_snapshot is None and not attendance_ledger(session)
    future_day = date(2030, 1, 7)
    future = draft(db, day=future_day)
    summarize(db, future)
    assert future.attendance_snapshot is not None and not attendance_ledger(session)
    from app.services import beli
    monkeypatch.setattr(beli, 'now_cn', lambda: datetime(2030, 1, 7, 12))
    _reconcile_recorded_days(session.bind)
    assert len(attendance_ledger(session)) == 1


def test_accounting_failure_rolls_back_summary_and_attendance_together(db, llm, monkeypatch):
    session = db[0]
    row = draft(db)

    def fail(*args, **kwargs):
        raise RuntimeError('Synthetic ledger failure')

    from app.services import beli
    monkeypatch.setattr(beli, 'post_entry', fail)
    assert 'error' in summarize(db, row)
    assert row.summary is None and row.attendance_snapshot is None
    assert not attendance_ledger(session)
    assert not session.exec(select(MorningAttendance)).all()
