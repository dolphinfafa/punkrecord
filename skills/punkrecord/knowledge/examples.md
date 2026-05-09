# 常见操作示例

以下示例中 `$TOKEN` 为 Agent Token，`$BASE` 为 `http://14.103.229.153:15085/api/v1`。

---

## 查看我的待办

```bash
curl -H "Authorization: Bearer $TOKEN" "$BASE/todo/my?page_size=10"
```

按状态筛选：
```bash
curl -H "Authorization: Bearer $TOKEN" "$BASE/todo/my?status=in_progress"
```

## 创建任务

```bash
curl -X POST "$BASE/todo" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "完成周报",
    "assignee_user_id": "用户UUID",
    "priority": "p1",
    "due_at": "2026-05-10T18:00:00",
    "description": "本周工作总结",
    "source_type": "custom",
    "action_type": "do"
  }'
```

## 开始/提交/完成任务

```bash
# 开始任务
curl -X POST "$BASE/todo/{todo_id}/start" -H "Authorization: Bearer $TOKEN"

# 提交完成（有审核人则进入待审核，无审核人则直接完成）
curl -X POST "$BASE/todo/{todo_id}/submit" -H "Authorization: Bearer $TOKEN"

# 审核通过
curl -X POST "$BASE/todo/{todo_id}/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "审核通过"}'
```

## 提交请假

```bash
# 请假一天（周一全天）
curl -X POST "$BASE/todo/leaves" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leave_type": "annual",
    "start_at": "2026-05-12T10:00:00",
    "end_at": "2026-05-12T19:00:00",
    "reason": "个人事务"
  }'

# 请假半天（周一上午）
curl -X POST "$BASE/todo/leaves" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leave_type": "annual",
    "start_at": "2026-05-12T10:00:00",
    "end_at": "2026-05-12T12:00:00",
    "reason": "看牙医"
  }'
```

## 查看项目

```bash
# 项目列表
curl -H "Authorization: Bearer $TOKEN" "$BASE/project/projects?page_size=10"

# 项目详情
curl -H "Authorization: Bearer $TOKEN" "$BASE/project/projects/{project_id}"

# 项目任务
curl -H "Authorization: Bearer $TOKEN" "$BASE/project/projects/{project_id}/todos"
```

## 查看财务

```bash
# 交易记录（按日期筛选）
curl -H "Authorization: Bearer $TOKEN" "$BASE/finance/transactions?date_from=2026-05-01&date_to=2026-05-31"
```

## 搜索知识库

```bash
curl -X POST "$BASE/kb/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "考勤制度", "top_k": 5}'
```

## 查看会议记录

```bash
# 会议列表
curl -H "Authorization: Bearer $TOKEN" "$BASE/meeting/records?page_size=5"

# 会议转录
curl -H "Authorization: Bearer $TOKEN" "$BASE/meeting/records/{meeting_id}/transcript"
```
