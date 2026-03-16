"""
Meeting record schemas
"""
from datetime import datetime
from typing import Optional, List, Dict
from uuid import UUID
from pydantic import BaseModel


class MeetingCreateResponse(BaseModel):
    id: UUID
    title: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class MeetingResponse(BaseModel):
    id: UUID
    title: str
    audio_file_name: str
    audio_content_type: str
    audio_file_size: int
    duration_seconds: Optional[int] = None
    status: str
    asr_task_id: Optional[str] = None
    speaker_mapping: dict = {}
    summary: Optional[str] = None
    created_by: UUID
    creator_name: Optional[str] = None
    archived_document_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MeetingListResponse(BaseModel):
    items: List[MeetingResponse]
    total: int
    skip: int
    limit: int


class TranscriptSegmentResponse(BaseModel):
    id: UUID
    meeting_id: UUID
    segment_index: int
    speaker_id: str
    start_time: float
    end_time: float
    content: str

    class Config:
        from_attributes = True


class TranscriptSegmentUpdate(BaseModel):
    id: UUID
    content: str


class TranscriptBatchUpdate(BaseModel):
    segments: List[TranscriptSegmentUpdate]


class SpeakerMappingUpdate(BaseModel):
    speaker_mapping: Dict[str, str]


class MeetingStatusResponse(BaseModel):
    id: UUID
    status: str
    asr_task_id: Optional[str] = None


class SummarizeRequest(BaseModel):
    prompt: Optional[str] = None
