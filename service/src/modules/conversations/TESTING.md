# Conversations 模块测试文档

## 1. 测试环境准备

### 1.1 数据库准备
```bash
# 确保数据库已初始化
npm run prisma:generate
npm run prisma:migrate
```

### 1.2 依赖安装
```bash
npm install
```

## 2. 单元测试

### 2.1 运行所有测试
```bash
npm test
```

### 2.2 运行指定模块测试
```bash
npm test conversations.service
npm test conversations.controller
```

### 2.3 测试覆盖率
```bash
npm test -- --coverage
```

## 3. 手动测试用例

### 3.1 创建会话
```bash
# 创建新会话
curl -X POST http://localhost:3000/api/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-trace-id: tr_test_001" \
  -d '{
    "characterId": "char_123"
  }'

# 期望响应
{
  "conversationId": "conv_xxx",
  "characterVersionId": "cv_xxx",
  "traceId": "tr_test_001"
}

# 错误情况 - 角色不存在
curl -X POST http://localhost:3000/api/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "characterId": "char_not_exist"
  }'

# 期望响应 - 404 Not Found
{
  "code": "NOT_FOUND",
  "message": "Character char_not_exist not found",
  "traceId": "tr_xxx"
}
```

### 3.2 获取会话列表
```bash
# 获取会话列表（默认20条）
curl -X GET "http://localhost:3000/api/conversations" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-trace-id: tr_test_002"

# 期望响应
{
  "items": [
    {
      "conversationId": "conv_xxx",
      "title": "角色名称 01-28",
      "updatedAt": "2026-01-28T10:00:00Z",
      "lastMessagePreview": "最后消息预览",
      "lastMessageAt": "2026-01-28T10:00:00Z"
    }
  ],
  "nextCursor": "conv_xxx",
  "traceId": "tr_test_002"
}

# 分页查询
curl -X GET "http://localhost:3000/api/conversations?cursor=conv_xxx&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3.3 获取会话详情
```bash
# 获取会话详情
curl -X GET "http://localhost:3000/api/conversations/conv_xxx" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-trace-id: tr_test_003"

# 期望响应
{
  "conversationId": "conv_xxx",
  "characterId": "char_123",
  "characterVersionId": "cv_xxx",
  "title": "角色名称 01-28",
  "createdAt": "2026-01-28T10:00:00Z",
  "updatedAt": "2026-01-28T10:30:00Z",
  "lastMessageAt": "2026-01-28T10:30:00Z",
  "traceId": "tr_test_003"
}

# 错误情况 - 会话不存在
curl -X GET "http://localhost:3000/api/conversations/conv_not_exist" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 期望响应 - 404 Not Found
{
  "code": "NOT_FOUND",
  "message": "Conversation conv_not_exist not found",
  "traceId": "tr_xxx"
}
```

### 3.4 更新会话标题
```bash
# 更新会话标题
curl -X PATCH "http://localhost:3000/api/conversations/conv_xxx" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-trace-id: tr_test_004" \
  -d '{
    "title": "新标题"
  }'

# 期望响应
{
  "conversationId": "conv_xxx",
  "title": "新标题",
  "traceId": "tr_test_004"
}

# 错误情况 - 会话不存在
curl -X PATCH "http://localhost:3000/api/conversations/conv_not_exist" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "新标题"
  }'

# 期望响应 - 404 Not Found
{
  "code": "NOT_FOUND",
  "message": "Conversation conv_not_exist not found",
  "traceId": "tr_xxx"
}
```

### 3.5 删除会话
```bash
# 删除会话（软删除）
curl -X DELETE "http://localhost:3000/api/conversations/conv_xxx" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-trace-id: tr_test_005"

# 期望响应 - 204 No Content

# 错误情况 - 会话不存在
curl -X DELETE "http://localhost:3000/api/conversations/conv_not_exist" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 期望响应 - 404 Not Found
{
  "code": "NOT_FOUND",
  "message": "Conversation conv_not_exist not found",
  "traceId": "tr_xxx"
}

# 验证删除后无法访问
curl -X GET "http://localhost:3000/api/conversations/conv_xxx" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 期望响应 - 404 Not Found
```

### 3.6 获取会话消息列表
```bash
# 获取会话消息列表
curl -X GET "http://localhost:3000/api/conversations/conv_xxx/messages" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-trace-id: tr_test_006"

# 期望响应（当前为空列表，等MessagesModule实现后会有数据）
{
  "items": [],
  "nextCursor": null,
  "traceId": "tr_test_006"
}

# 分页查询
curl -X GET "http://localhost:3000/api/conversations/conv_xxx/messages?cursor=msg_xxx&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 4. 权限测试

### 4.1 访问其他用户的会话
```bash
# 使用用户A的token访问用户B的会话
curl -X GET "http://localhost:3000/api/conversations/user_b_conversation" \
  -H "Authorization: Bearer USER_A_TOKEN"

# 期望响应 - 404 Not Found（或403 Forbidden，根据实现）
{
  "code": "FORBIDDEN",
  "message": "无权限访问该资源",
  "traceId": "tr_xxx"
}
```

### 4.2 更新其他用户的会话
```bash
# 使用用户A的token更新用户B的会话
curl -X PATCH "http://localhost:3000/api/conversations/user_b_conversation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer USER_A_TOKEN" \
  -d '{
    "title": "恶意修改"
  }'

# 期望响应 - 403 Forbidden
{
  "code": "FORBIDDEN",
  "message": "无权限访问该资源",
  "traceId": "tr_xxx"
}
```

## 5. 边界条件测试

### 5.1 分页边界
```bash
# limit超过最大值
curl -X GET "http://localhost:3000/api/conversations?limit=200" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 期望：limit被限制为100

# 负数limit
curl -X GET "http://localhost:3000/api/conversations?limit=-10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 期望：使用默认值20
```

### 5.2 空数据测试
```bash
# 获取空会话列表
curl -X GET "http://localhost:3000/api/conversations" \
  -H "Authorization: Bearer NEW_USER_TOKEN"

# 期望响应
{
  "items": [],
  "nextCursor": null,
  "traceId": "tr_xxx"
}
```

## 6. 性能测试

### 6.1 大量会话列表
```bash
# 测试大量数据的分页性能
curl -X GET "http://localhost:3000/api/conversations?limit=100" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 期望：响应时间 < 500ms
```

## 7. 验证要点

### 7.1 数据一致性
- [ ] 创建会话时正确绑定角色最新版本
- [ ] 会话列表按 updatedAt 倒序排列
- [ ] 软删除的会话不再出现在列表中
- [ ] 用户只能访问自己的会话

### 7.2 错误处理
- [ ] 角色不存在时返回404
- [ ] 会话不存在时返回404
- [ ] 无权限访问时返回403
- [ ] 参数验证失败时返回400

### 7.3 业务规则
- [ ] 新会话标题格式：{角色名称} {MM-DD}
- [ ] 优先使用已发布的角色版本，没有则使用草稿版本
- [ ] 分页游标工作正常
- [ ] traceId 在每个响应中都存在

## 8. 集成测试

### 8.1 完整流程测试
1. 创建角色
2. 创建角色版本
3. 创建会话
4. 获取会话列表
5. 更新会话标题
6. 获取会话详情
7. 删除会话
8. 验证会话已删除

### 8.2 并发测试
```bash
# 同时创建多个会话
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/conversations \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{"characterId": "char_123"}' &
done
wait

# 验证所有会话都创建成功
```

## 9. 测试数据清理

### 9.1 清理测试会话
```bash
# 删除所有测试会话（需要管理员权限）
# 建议在每个测试套件运行后清理
```

## 10. 已知问题和限制

1. **认证系统**：当前使用临时AuthGuard，需要集成正式的JWT认证
2. **消息集成**：获取会话消息列表功能需要等MessagesModule实现
3. **最后消息预览**：需要集成MessagesRepository来获取最后消息预览
4. **字符集编码**：确保中文字符正确处理
5. **时区处理**：所有时间使用UTC时间

## 11. 下一步计划

1. 集成正式的认证系统
2. 实现MessagesModule以支持消息功能
3. 添加更多的错误处理和边界条件测试
4. 性能优化和缓存策略
5. 添加审计日志功能