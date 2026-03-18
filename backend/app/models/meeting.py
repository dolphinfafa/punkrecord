"""
Meeting record models — meetings, transcript segments
"""
import enum
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from sqlmodel import Field, SQLModel, Column, JSON, TEXT

from app.models.base import BaseDBModel


class MeetingStatus(str, enum.Enum):
    UPLOADING = "uploading"
    TRANSCRIBING = "transcribing"
    TRANSCRIBED = "transcribed"
    SUMMARIZED = "summarized"
    ARCHIVED = "archived"
    FAILED = "failed"


class MeetingType(str, enum.Enum):
    MORNING = "morning"          # 早会
    WEEKLY = "weekly"            # 周会
    PROJECT = "project"          # 项目会议
    REVIEW = "review"            # 复盘会议
    BRAINSTORM = "brainstorm"    # 头脑风暴
    OTHER = "other"              # 其他


class MeetingRecord(BaseDBModel, table=True):
    """Meeting record"""
    __tablename__ = "meeting_record"

    title: str = Field(nullable=False)
    meeting_type: str = Field(default=MeetingType.MORNING, index=True)
    audio_file_name: str = Field(default="")
    audio_stored_name: str = Field(default="")
    audio_content_type: str = Field(default="")
    audio_file_size: int = Field(default=0)
    duration_seconds: Optional[int] = Field(default=None)
    status: MeetingStatus = Field(default=MeetingStatus.UPLOADING, index=True)
    asr_task_id: Optional[str] = Field(default=None)
    meeting_date: Optional[date] = Field(default=None, index=True)
    speaker_mapping: dict = Field(default={}, sa_column=Column(JSON))
    attendees: Optional[list] = Field(default=None, sa_column=Column(JSON))
    summary: Optional[str] = Field(default=None, sa_column=Column(TEXT))
    created_by: UUID = Field(foreign_key="users.id")
    archived_document_id: Optional[UUID] = Field(default=None, foreign_key="kb_document.id")


class MeetingTranscriptSegment(BaseDBModel, table=True):
    """ASR transcript segment"""
    __tablename__ = "meeting_transcript_segment"

    meeting_id: UUID = Field(foreign_key="meeting_record.id", index=True)
    segment_index: int = Field(default=0)
    speaker_id: str = Field(default="")
    start_time: float = Field(default=0.0)
    end_time: float = Field(default=0.0)
    content: str = Field(sa_column=Column(TEXT))
