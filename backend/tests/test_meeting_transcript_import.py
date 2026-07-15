from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.api.meeting import _parse_transcript_text


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
