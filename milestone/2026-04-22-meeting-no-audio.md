# 2026-04-22 Milestone (二)

## 会议记录支持无音频创建 (v1.0.6)

### 1. 背景

原有流程必须上传音频才能创建会议记录，不适用于没有录音的会议场景。用户希望先创建会议，再根据情况选择上传音频转录或直接手动填写会议记录。

### 2. 新流程

1. 创建会议：仅需标题、类型、日期，无需音频
2. 进入详情页后两条路径：
   - **有音频**：上传音频 → ASR 转录 → 编辑说话人 → AI 生成纪要
   - **无音频**：填写参会人员 → 在"自定义提示词"填写会议文字记录 → AI 直接生成纪要

### 3. 后端改动

| 改动 | 说明 |
|------|------|
| `create_meeting` | `file` 参数从必填改为可选，无音频时状态直接 `transcribed` |
| 新增 `upload-audio` | `POST /records/{id}/upload-audio`，为无音频会议追加上传并触发 ASR |
| 新增 `attendees` | `PATCH /records/{id}/attendees`，更新参会人员列表 |
| `summarize` | 无转录 segments 时允许用自定义提示词作为会议内容生成纪要 |

### 4. 前端改动

| 文件 | 改动 |
|------|------|
| `UploadAudioModal.jsx` | 改为纯创建弹窗（标题/类型/日期），去掉音频拖拽上传 |
| `MeetingListPage.jsx` | "上传音频" → "创建会议"，成功后跳转详情页 |
| `MeetingDetailPage.jsx` | 无音频时显示上传按钮 + 参会人员输入框；AI 纪要区始终显示 |
| `meeting.js` | createMeeting 改为不传文件；新增 uploadAudio、updateAttendees |

### 5. 状态流转

```
无音频创建 → transcribed → (自定义提示词生成) → summarized → archived
无音频后补音频 → transcribing → transcribed → summarized → archived
有音频创建 → transcribing → transcribed → summarized → archived
```
