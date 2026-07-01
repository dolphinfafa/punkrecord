from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.asr_service import AudioChunk, _merge_chunk_segments


def test_merge_chunk_segments_offsets_and_dedupes_overlap():
    chunks = [
        AudioChunk("chunk1.mp3", 0.0, 0.0, 60.0, "mp3", True),
        AudioChunk("chunk2.mp3", 55.0, 60.0, 120.0, "mp3", True),
    ]
    results = [
        {
            "segments": [
                {
                    "speaker_id": "speaker_0",
                    "start_time": 50.0,
                    "end_time": 58.0,
                    "content": "这里是边界前的内容",
                },
                {
                    "speaker_id": "speaker_1",
                    "start_time": 58.0,
                    "end_time": 60.0,
                    "content": "继续讨论上线计划",
                },
            ],
            "text": "这里是边界前的内容\n继续讨论上线计划",
        },
        {
            "segments": [
                {
                    "speaker_id": "speaker_1",
                    "start_time": 3.0,
                    "end_time": 5.0,
                    "content": "继续讨论上线计划",
                },
                {
                    "speaker_id": "speaker_0",
                    "start_time": 6.0,
                    "end_time": 10.0,
                    "content": "后面还有新的内容",
                },
            ],
            "text": "继续讨论上线计划\n后面还有新的内容",
        },
    ]

    segments, text, warnings = _merge_chunk_segments(chunks, results)

    assert warnings == []
    assert [segment["content"] for segment in segments] == [
        "这里是边界前的内容",
        "继续讨论上线计划",
        "后面还有新的内容",
    ]
    assert segments[0]["start_time"] == 50.0
    assert segments[1]["start_time"] == 58.0
    assert segments[2]["start_time"] == 61.0
    assert segments[2]["speaker_id"] == "chunk2_speaker_0"
    assert text == "这里是边界前的内容\n继续讨论上线计划\n后面还有新的内容"


def test_merge_chunk_segments_reports_empty_chunk_warning():
    chunks = [AudioChunk("chunk1.mp3", 0.0, 0.0, 60.0, "mp3", True)]

    segments, text, warnings = _merge_chunk_segments(chunks, [{"segments": [], "text": ""}])

    assert segments == []
    assert text == ""
    assert warnings == ["chunk 1 returned no transcript segments"]
