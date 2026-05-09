# 认证说明

## Agent Token

PunkRecord 使用 Agent Token 进行 API 认证。Token 格式为 `pat_` + 64位十六进制字符串。

### 获取方式

用户在 PunkRecord 工作台（首页）底部的"Agent 密钥"区域生成。生成时可设置名称和有效期（30天/90天/180天/永久）。

### 使用方式

所有 API 请求需在 HTTP 头中携带：

```
Authorization: Bearer pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 验证身份

```bash
curl -H "Authorization: Bearer $TOKEN" http://14.103.229.153:15085/api/v1/auth/me
```

返回当前用户信息和权限列表：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "uuid",
    "display_name": "杨喆",
    "username": "zheyang",
    "permissions": ["todo.read", "todo.write", "project.read", ...],
    "job_title_name": "技术总监"
  }
}
```

### 错误处理

| HTTP 状态码 | 含义 |
|-------------|------|
| 401 | Token 无效、已过期或已撤销 |
| 403 | 用户无对应模块权限 |
