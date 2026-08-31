import asyncio
from datetime import date
from pathlib import Path
import sys
from uuid import uuid4

sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine, select

from app import models  # noqa: F401
from app.api.meeting import (
    _attendee_names_from_speakers,
    _build_meeting_summary_user_message,
    _parse_transcript_text,
    _replace_transcript_segments,
    delete_meeting,
)
from app.models.iam import User, UserStatus
from app.models.meeting import MeetingRecord, MeetingStatus, MeetingTranscriptSegment, MeetingType
from app.schemas.meeting import TranscriptBatchUpdate, TranscriptSegmentUpdate


def _make_session() -> Session:
    engine = create_engine("sqlite://")

    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _add_test_user(session: Session) -> User:
    user = User(
        id=uuid4(),
        display_name="会议测试用户",
        username=f"meeting_test_{uuid4().hex[:8]}",
        status=UserStatus.ACTIVE,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def test_parse_transcript_text_speaker_number_labels():
    text = """
会议标题：早会
会议日期：2026-07-13
讲话人1：大家早上好，先同步今天的安排。
继续补充第一位讲话人的第二行。
讲话人2：我今天继续处理合同附件。
Speaker 1: 最后确认一下会议纪要。
"""

    segments, mapping = _parse_transcript_text(text)

    assert mapping == {"speaker_1": "讲话人1", "speaker_2": "讲话人2"}
    assert [item["speaker_id"] for item in segments] == ["speaker_1", "speaker_2", "speaker_1"]
    assert segments[0]["content"] == "大家早上好，先同步今天的安排。\n继续补充第一位讲话人的第二行。"
    assert segments[1]["content"] == "我今天继续处理合同附件。"
    assert segments[2]["content"] == "最后确认一下会议纪要。"


def test_parse_transcript_text_named_speakers_and_timecodes():
    text = """
[00:01-00:04] 张三：完成了接口联调。
00:05-00:08 李四：前端页面今天收尾。
张三：下午一起验收。
"""

    segments, mapping = _parse_transcript_text(text)

    assert mapping == {"speaker_1": "张三", "speaker_2": "李四"}
    assert [item["speaker_id"] for item in segments] == ["speaker_1", "speaker_2", "speaker_1"]
    assert segments[0]["start_time"] == 1.0
    assert segments[0]["end_time"] == 4.0
    assert segments[0]["has_time"] is True
    assert segments[2]["has_time"] is False


def test_parse_transcript_text_speaker_header_time_next_line_content():
    text = """
07-15早会
讲话人1  00:20
你是磊哥吗？
讲话人2  00:23
首先，我已经完成剪映的检测并且正在测试效果。
讲话人3  00:45
一是需要测试外勤管理后台导出并且优化的功能。
讲话人3  00:51
二是处理程序，我们需要导出查询并且修改功能。
讲话人1  01:07
是的。
"""

    segments, mapping = _parse_transcript_text(text)

    assert mapping == {"speaker_1": "讲话人1", "speaker_2": "讲话人2", "speaker_3": "讲话人3"}
    assert [item["speaker_id"] for item in segments] == [
        "speaker_1", "speaker_2", "speaker_3", "speaker_3", "speaker_1"
    ]
    assert segments[0]["start_time"] == 20.0
    assert segments[1]["start_time"] == 23.0
    assert segments[0]["content"] == "你是磊哥吗？"
    assert "07-15早会" not in segments[0]["content"]


def test_parse_transcript_text_without_speaker_labels_keeps_content():
    segments, mapping = _parse_transcript_text("这是已经整理好的会议记录，没有说话人标签。")

    assert mapping == {"speaker_1": "讲话人1"}
    assert len(segments) == 1
    assert segments[0]["speaker_id"] == "speaker_1"
    assert segments[0]["content"] == "这是已经整理好的会议记录，没有说话人标签。"


def test_replace_transcript_segments_inserts_deletes_and_reorders():
    with _make_session() as session:
        user = _add_test_user(session)
        meeting = MeetingRecord(
            title="编辑测试会议",
            meeting_type=MeetingType.MORNING,
            status=MeetingStatus.TRANSCRIBED,
            created_by=user.id,
        )
        session.add(meeting)
        session.commit()
        session.refresh(meeting)

        first = MeetingTranscriptSegment(
            meeting_id=meeting.id,
            segment_index=0,
            speaker_id="speaker_1",
            start_time=0,
            end_time=3,
            content="第一段",
        )
        second = MeetingTranscriptSegment(
            meeting_id=meeting.id,
            segment_index=1,
            speaker_id="speaker_2",
            start_time=3,
            end_time=6,
            content="第二段",
        )
        session.add(first)
        session.add(second)
        session.commit()
        session.refresh(first)

        payload = TranscriptBatchUpdate(
            replace=True,
            segments=[
                TranscriptSegmentUpdate(id=first.id, speaker_id="speaker_2", start_time=0, end_time=3, content="第一段改后"),
                TranscriptSegmentUpdate(id="draft-row-1", speaker_id="speaker_3", start_time=3, end_time=5, content="插入的新段"),
            ],
        )

        _replace_transcript_segments(meeting.id, payload, session)
        session.commit()

        rows = session.exec(
            select(MeetingTranscriptSegment)
            .where(MeetingTranscriptSegment.meeting_id == meeting.id)
            .order_by(MeetingTranscriptSegment.segment_index)
        ).all()

    assert [row.segment_index for row in rows] == [0, 1]
    assert [row.content for row in rows] == ["第一段改后", "插入的新段"]
    assert [row.speaker_id for row in rows] == ["speaker_2", "speaker_3"]


def test_attendees_follow_transcript_speaker_mapping_order():
    meeting_id = uuid4()
    segments = [
        MeetingTranscriptSegment(
            meeting_id=meeting_id,
            segment_index=0,
            speaker_id="speaker_2",
            content="先说话",
        ),
        MeetingTranscriptSegment(
            meeting_id=meeting_id,
            segment_index=1,
            speaker_id="speaker_1",
            content="后说话",
        ),
        MeetingTranscriptSegment(
            meeting_id=meeting_id,
            segment_index=2,
            speaker_id="speaker_2",
            content="重复讲话人不重复记录",
        ),
    ]

    names = _attendee_names_from_speakers(segments, {
        "speaker_1": "张三",
        "speaker_2": "李四",
    })

    assert names == ["李四", "张三"]


def test_meeting_summary_context_includes_meeting_date():
    meeting = MeetingRecord(
        title="早会",
        meeting_type=MeetingType.MORNING,
        meeting_date=date(2026, 8, 31),
        status=MeetingStatus.TRANSCRIBED,
        created_by=uuid4(),
    )

    message = _build_meeting_summary_user_message(
        meeting,
        "张三: 今天处理会议纪要日期。",
        None,
        ["张三", "李四"],
    )

    assert "会议基础信息" in message
    assert "会议标题：早会" in message
    assert "会议日期：2026-08-31" in message
    assert "参会人员：张三、李四" in message
    assert "会议转写文稿" in message


def test_delete_meeting_removes_transcript_segments_before_parent():
    with _make_session() as session:
        user = _add_test_user(session)
        meeting = MeetingRecord(
            title="删除测试会议",
            meeting_type=MeetingType.MORNING,
            status=MeetingStatus.TRANSCRIBED,
            created_by=user.id,
        )
        session.add(meeting)
        session.commit()
        session.refresh(meeting)

        session.add(
            MeetingTranscriptSegment(
                meeting_id=meeting.id,
                segment_index=0,
                speaker_id="speaker_1",
                start_time=0,
                end_time=3,
                content="需要先删除的转录段",
            )
        )
        session.commit()

        response = asyncio.run(delete_meeting(meeting.id, session, current_user=None))

        assert response["data"]["message"] == "会议记录已删除"
        assert session.get(MeetingRecord, meeting.id) is None
        rows = session.exec(
            select(MeetingTranscriptSegment).where(MeetingTranscriptSegment.meeting_id == meeting.id)
        ).all()
        assert rows == []
