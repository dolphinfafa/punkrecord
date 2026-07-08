from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.services.asr_service import AudioChunk, _merge_chunk_segments, _smooth_short_speaker_turns


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


def test_merge_chunk_segments_reuses_speaker_alias_from_overlap_duplicate():
    chunks = [
        AudioChunk("chunk1.mp3", 0.0, 0.0, 60.0, "mp3", True),
        AudioChunk("chunk2.mp3", 55.0, 60.0, 120.0, "mp3", True),
    ]
    results = [
        {
            "segments": [
                {
                    "speaker_id": "speaker_2",
                    "start_time": 55.0,
                    "end_time": 60.0,
                    "content": "我们继续看合同附件上传",
                },
            ],
        },
        {
            "segments": [
                {
                    "speaker_id": "speaker_0",
                    "start_time": 0.0,
                    "end_time": 5.0,
                    "content": "我们继续看合同附件上传",
                },
                {
                    "speaker_id": "speaker_0",
                    "start_time": 5.5,
                    "end_time": 8.0,
                    "content": "然后确认预览入口",
                },
            ],
        },
    ]

    segments, _, _ = _merge_chunk_segments(chunks, results)

    assert [segment["content"] for segment in segments] == [
        "我们继续看合同附件上传",
        "然后确认预览入口",
    ]
    assert segments[1]["speaker_id"] == "chunk1_speaker_2"


def test_merge_chunk_segments_keeps_nearby_different_boundary_text():
    chunks = [
        AudioChunk("chunk1.mp3", 0.0, 0.0, 60.0, "mp3", True),
        AudioChunk("chunk2.mp3", 55.0, 60.0, 120.0, "mp3", True),
    ]
    results = [
        {
            "segments": [
                {
                    "speaker_id": "speaker_0",
                    "start_time": 55.0,
                    "end_time": 59.0,
                    "content": "第一句边界内容",
                },
            ],
        },
        {
            "segments": [
                {
                    "speaker_id": "speaker_0",
                    "start_time": 1.0,
                    "end_time": 4.0,
                    "content": "第二句新的内容",
                },
            ],
        },
    ]

    segments, text, warnings = _merge_chunk_segments(chunks, results)

    assert warnings == []
    assert [segment["content"] for segment in segments] == ["第一句边界内容", "第二句新的内容"]
    assert text == "第一句边界内容\n第二句新的内容"


def test_merge_chunk_segments_reports_empty_chunk_warning():
    chunks = [AudioChunk("chunk1.mp3", 0.0, 0.0, 60.0, "mp3", True)]

    segments, text, warnings = _merge_chunk_segments(chunks, [{"segments": [], "text": ""}])

    assert segments == []
    assert text == ""
    assert warnings == ["chunk 1 returned no transcript segments"]


def test_smooth_short_speaker_turns_reassigns_isolated_short_turn():
    segments = [
        {"speaker_id": "speaker_1", "start_time": 104.16, "end_time": 104.60, "content": "小雪。"},
        {"speaker_id": "speaker_5", "start_time": 106.19, "end_time": 107.31, "content": "那个测试工具。"},
        {"speaker_id": "speaker_1", "start_time": 112.01, "end_time": 128.69, "content": "请问行，散会吧。"},
        {"speaker_id": "speaker_5", "start_time": 147.49, "end_time": 149.69, "content": "他要坐公交，大概要一个半小时。"},
    ]

    smoothed = _smooth_short_speaker_turns(segments)

    assert [segment["speaker_id"] for segment in smoothed] == ["speaker_1", "speaker_1", "speaker_1", "speaker_5"]
    assert segments[1]["speaker_id"] == "speaker_5"


def test_smooth_short_speaker_turns_keeps_repeated_speaker():
    segments = [
        {"speaker_id": "speaker_1", "start_time": 10.0, "end_time": 12.0, "content": "第一句"},
        {"speaker_id": "speaker_2", "start_time": 13.0, "end_time": 14.0, "content": "嗯"},
        {"speaker_id": "speaker_1", "start_time": 15.0, "end_time": 16.0, "content": "第二句"},
        {"speaker_id": "speaker_2", "start_time": 17.0, "end_time": 19.0, "content": "我补充一下"},
    ]

    smoothed = _smooth_short_speaker_turns(segments)

    assert [segment["speaker_id"] for segment in smoothed] == ["speaker_1", "speaker_2", "speaker_1", "speaker_2"]
