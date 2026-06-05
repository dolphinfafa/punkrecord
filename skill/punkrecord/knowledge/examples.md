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

## 创建项目关联任务（带 dev_type 与标签）

```bash
curl -X POST "$BASE/todo" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "登录接口联调",
    "assignee_user_id": "用户UUID",
    "priority": "p1",
    "link": {"project_name": "官网改版", "dev_type": "dev_backend"},
    "tags": ["联调"]
  }'
```

- 用 `link.project_name`（或更精确的 `link.project_id`）即可把任务挂到项目下，无需多轮对话。
- `dev_type` 可选：`dev_backend`/`dev_frontend`/`dev_ui`/`dev_product`/`other`。

## 阻塞 / 忽略任务（原因放 body）

```bash
# 阻塞（blocked_reason 必填，放在请求体）
curl -X POST "$BASE/todo/{todo_id}/block" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"blocked_reason": "等待上游接口"}'

# 忽略（dismiss_reason 可选）
curl -X POST "$BASE/todo/{todo_id}/dismiss" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dismiss_reason": "需求取消"}'
```

## 查看任务相关图片

```bash
# 1) 按任务 id 列出全部图片
curl -H "Authorization: Bearer $TOKEN" "$BASE/todo/{todo_id}/images"

# 2) 按任务名定位图片（任务名需 URL 编码）
curl -G -H "Authorization: Bearer $TOKEN" --data-urlencode "title=登录接口联调" "$BASE/todo/images"

# 3) 下载某张图片（download_path 来自上面返回）
curl -H "Authorization: Bearer $TOKEN" -o image.png \
  "$BASE/todo/{todo_id}/images/{image_id}/download"
```

> 任务详情 `GET /todo/{id}` 的 `link.todo_images[]` 也包含每张图片的 `id`，可据此拼下载地址。

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

## 创建合同（合同编号可不传）

```bash
# 不传 contract_no，后端自动生成 CNT-<时间戳>
# party_a_id / party_b_id 均为对手方(counterparty) id
curl -X POST "$BASE/contract/contracts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "网站开发合同",
    "contract_type": "sales",
    "party_a_id": "对手方UUID",
    "party_b_id": "对手方UUID",
    "amount_total": 50000
  }'
```

## 搜索知识库 / RAG 对话

```bash
# 语义搜索
curl -X POST "$BASE/kb/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "考勤制度", "top_k": 5}'

# RAG 对话（SSE，注意字段是 message 不是 query）
curl -N -X POST "$BASE/kb/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "公司的考勤制度是怎样的？"}'
```

> 知识库检索/对话依赖后端嵌入服务；未配置时接口返回友好提示而非报错。

## 查看会议记录

```bash
# 会议列表
curl -H "Authorization: Bearer $TOKEN" "$BASE/meeting/records?page_size=5"

# 会议转录
curl -H "Authorization: Bearer $TOKEN" "$BASE/meeting/records/{meeting_id}/transcript"
```
