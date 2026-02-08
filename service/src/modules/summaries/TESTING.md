# Summaries 模块测试文档

## 1. 测试环境准备

### 1.1 数据库准备
```bash
# 确保数据库已初始化
npm run prisma:generate
npm run prisma:migrate

# 确保messages表有token_count字段（用于token计算）
# 如果没有，需要添加：
ALTER TABLE messages ADD COLUMN token_count INTEGER DEFAULT 0;
```

### 1.2 依赖安装
```bash
npm install
```

### 1.3 配置参数
```bash
# 摘要相关配置
SUMMARY_MIN_MESSAGES=10              # 最小消息数触发摘要
SUMMARY_MIN_TOKENS=4000              # 最小token数触发摘要
SUMMARY_MAX_TOKENS=200               # 摘要最大token数
SUMMARY_MODEL=gpt-3.5-turbo          # 摘要生成模型
SUMMARY_STALE_HOURS=24               # 摘要过期时间（小时）
SUMMARY_AUTO_GENERATION=true         # 是否启用自动生成
SUMMARY_CUSTOM_PATTERNS=[]           # 自定义隐私过滤模式
```

## 2. 手动测试用例

### 2.1 获取会话摘要

#### 2.1.1 获取存在的摘要
```bash
# 获取会话摘要
curl -X GET "http://localhost:3000/api/summaries/conversation/conv_xxx" \
  -H "x-user-id: user_123" \
  -H "x-trace-id: tr_test_001"

# 期望响应
{
  "summaryId": "sum_xxx",
  "conversationId": "conv_xxx",
  "content": "本次对话主要讨论了技术实现方案，双方就架构设计达成了共识。",
  "createdAt": "2026-01-28T10:00:00Z",
  "updatedAt": "2026-01-28T10:30:00Z",
  "conversationTitle": "技术讨论 01-28",
  "traceId": "tr_test_001"
}
```

#### 2.1.2 获取不存在的摘要
```bash
# 获取不存在摘要的会话
curl -X GET "http://localhost:3000/api/summaries/conversation/conv_no_summary" \
  -H "x-user-id: user_123"

# 期望响应 - 404 Not Found
{
  "code": "NOT_FOUND",
  "message": "Summary for conversation conv_no_summary not found",
  "traceId": "tr_xxx"
}
```

#### 2.1.3 获取其他用户的会话摘要
```bash
# 尝试获取其他用户的会话摘要
curl -X GET "http://localhost:3000/api/summaries/conversation/other_user_conv" \
  -H "x-user-id: user_a"

# 期望响应 - 404 Not Found（隐藏资源存在性）
{
  "code": "NOT_FOUND",
  "message": "Summary for conversation other_user_conv not found",
  "traceId": "tr_xxx"
}
```

### 2.2 获取用户摘要列表

#### 2.2.1 获取默认摘要列表
```bash
# 获取用户摘要列表（默认20条）
curl -X GET "http://localhost:3000/api/summaries" \
  -H "x-user-id: user_123" \
  -H "x-trace-id: tr_test_002"

# 期望响应
{
  "items": [
    {
      "summaryId": "sum_xxx",
      "conversationId": "conv_xxx",
      "content": "本次对话主要讨论了技术实现方案...",
      "createdAt": "2026-01-28T10:00:00Z",
      "updatedAt": "2026-01-28T10:30:00Z",
      "conversationTitle": "技术讨论 01-28"
    }
  ],
  "nextCursor": "sum_xxx",
  "traceId": "tr_test_002"
}
```

#### 2.2.2 分页查询
```bash
# 使用游标分页
curl -X GET "http://localhost:3000/api/summaries?cursor=sum_xxx&limit=10" \
  -H "x-user-id: user_123"

# 期望响应包含下一页游标
{
  "items": [...],
  "nextCursor": "sum_yyy",
  "traceId": "tr_xxx"
}
```

### 2.3 创建会话摘要

#### 2.3.1 成功创建摘要
```bash
# 创建会话摘要
curl -X POST "http://localhost:3000/api/summaries" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -H "x-trace-id: tr_test_003" \
  -d '{
    "conversationId": "conv_xxx",
    "content": "本次对话主要讨论了项目架构设计，确定了技术选型方案。",
    "triggerReason": "message_count_15"
  }'

# 期望响应
{
  "summaryId": "sum_new_xxx",
  "conversationId": "conv_xxx",
  "content": "本次对话主要讨论了项目架构设计，确定了技术选型方案。",
  "createdAt": "2026-01-28T10:00:00Z",
  "updatedAt": "2026-01-28T10:00:00Z",
  "traceId": "tr_test_003"
}
```

#### 2.3.2 创建已存在摘要的会话
```bash
# 尝试为已有摘要的会话创建摘要
curl -X POST "http://localhost:3000/api/summaries" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -d '{
    "conversationId": "conv_has_summary",
    "content": "新的摘要内容"
  }'

# 期望响应 - 409 Conflict
{
  "code": "CONFLICT",
  "message": "Summary already exists for conversation conv_has_summary",
  "traceId": "tr_xxx"
}
```

#### 2.3.3 创建无效内容的摘要
```bash
# 创建内容过短的摘要
curl -X POST "http://localhost:3000/api/summaries" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -d '{
    "conversationId": "conv_xxx",
    "content": "短"
  }'

# 期望响应 - 409 Conflict
{
  "code": "CONFLICT",
  "message": "Invalid summary content: 摘要过短",
  "traceId": "tr_xxx"
}
```

### 2.4 更新会话摘要

#### 2.4.1 成功更新摘要
```bash
# 更新会话摘要
curl -X PUT "http://localhost:3000/api/summaries/conversation/conv_xxx" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -H "x-trace-id: tr_test_004" \
  -d '{
    "content": "更新后的摘要内容：本次对话深入探讨了系统架构，确定了微服务拆分方案。",
    "updateReason": "内容补充和优化"
  }'

# 期望响应
{
  "summaryId": "sum_xxx",
  "conversationId": "conv_xxx",
  "content": "更新后的摘要内容：本次对话深入探讨了系统架构，确定了微服务拆分方案。",
  "createdAt": "2026-01-28T10:00:00Z",
  "updatedAt": "2026-01-28T11:00:00Z",
  "traceId": "tr_test_004"
}
```

### 2.5 删除会话摘要

#### 2.5.1 成功删除摘要
```bash
# 删除会话摘要
curl -X DELETE "http://localhost:3000/api/summaries/conversation/conv_xxx" \
  -H "x-user-id: user_123" \
  -H "x-trace-id: tr_test_005"

# 期望响应 - 204 No Content
```

### 2.6 自动生成会话摘要

#### 2.6.1 自动生成新摘要
```bash
# 自动生成会话摘要
curl -X POST "http://localhost:3000/api/summaries/conversation/conv_xxx/generate" \
  -H "x-user-id: user_123" \
  -H "x-trace-id: tr_test_006"

# 期望响应
{
  "summaryId": "sum_generated_xxx",
  "conversationId": "conv_xxx",
  "content": "本次对话主要讨论了技术实现方案，双方就架构设计达成了共识。",
  "tokenCount": 45,
  "model": "gpt-3.5-turbo",
  "triggerReason": "message_count_15",
  "created": true,
  "traceId": "tr_test_006"
}
```

#### 2.6.2 强制重新生成摘要
```bash
# 强制重新生成摘要
curl -X POST "http://localhost:3000/api/summaries/conversation/conv_xxx/generate?force=true" \
  -H "x-user-id: user_123"

# 期望响应（已存在摘要被重新生成）
{
  "summaryId": "sum_existing_xxx",
  "conversationId": "conv_xxx",
  "content": "重新生成的摘要内容...",
  "tokenCount": 42,
  "model": "gpt-3.5-turbo",
  "triggerReason": "manual_trigger",
  "created": false,
  "traceId": "tr_xxx"
}
```

#### 2.6.3 模拟摘要生成（开发测试）
```bash
# 模拟生成摘要（开发环境）
curl -X POST "http://localhost:3000/api/summaries/conversation/conv_xxx/mock-generate" \
  -H "x-user-id: user_123" \
  -H "x-trace-id: tr_test_007"

# 期望响应
{
  "summaryId": "sum_mock_xxx",
  "conversationId": "conv_xxx",
  "content": "会话摘要：主要讨论了相关问题并交换了意见。",
  "tokenCount": 25,
  "model": "mock-model",
  "triggerReason": "manual_trigger",
  "created": true,
  "isMock": true,
  "traceId": "tr_test_007"
}
```

### 2.7 批量生成会话摘要

#### 2.7.1 批量生成多个会话摘要
```bash
# 批量生成会话摘要
curl -X POST "http://localhost:3000/api/summaries/batch-generate" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -H "x-trace-id: tr_test_008" \
  -d '{
    "conversationIds": ["conv_1", "conv_2", "conv_3"]
  }'

# 期望响应
{
  "results": [
    {
      "summaryId": "sum_1",
      "conversationId": "conv_1",
      "content": "摘要内容1...",
      "tokenCount": 35,
      "model": "gpt-3.5-turbo",
      "triggerReason": "message_count_12",
      "created": true
    },
    {
      "summaryId": "sum_2",
      "conversationId": "conv_2",
      "content": "摘要内容2...",
      "tokenCount": 28,
      "model": "existing",
      "triggerReason": "existing_summary",
      "created": false
    }
  ],
  "total": 2,
  "traceId": "tr_test_008"
}
```

### 2.8 获取需要摘要的会话

#### 2.8.1 获取需要生成摘要的会话
```bash
# 获取需要摘要的会话
curl -X GET "http://localhost:3000/api/summaries/needed" \
  -H "x-user-id: user_123" \
  -H "x-trace-id: tr_test_009"

# 期望响应
{
  "conversations": [
    {
      "conversationId": "conv_need_summary_1",
      "messageCount": 15,
      "totalTokens": 5000,
      "lastMessageAt": "2026-01-28T09:00:00Z"
    },
    {
      "conversationId": "conv_need_summary_2",
      "messageCount": 25,
      "totalTokens": 8000,
      "lastMessageAt": "2026-01-28T08:30:00Z"
    }
  ],
  "total": 2,
  "criteria": {
    "minMessageCount": 10,
    "minTokenCount": 4000
  },
  "traceId": "tr_test_009"
}
```

### 2.9 获取摘要统计

#### 2.9.1 获取用户摘要统计
```bash
# 获取摘要统计
curl -X GET "http://localhost:3000/api/summaries/stats" \
  -H "x-user-id: user_123" \
  -H "x-trace-id: tr_test_010"

# 期望响应
{
  "stats": {
    "total": 20,
    "byStatus": {
      "hasSummary": 15,
      "needsSummary": 3,
      "staleSummary": 2
    }
  },
  "config": {
    "minMessageCount": 10,
    "minTokenCount": 4000,
    "maxSummaryTokens": 200,
    "summaryStaleHours": 24,
    "enableAutoGeneration": true,
    "model": "gpt-3.5-turbo"
  },
  "traceId": "tr_test_010"
}
```

### 2.10 提取摘要关键词

#### 2.10.1 提取摘要关键词
```bash
# 提取摘要关键词
curl -X GET "http://localhost:3000/api/summaries/sum_xxx/keywords" \
  -H "x-user-id: user_123" \
  -H "x-trace-id: tr_test_011"

# 期望响应
{
  "summaryId": "sum_xxx",
  "keywords": ["技术架构", "微服务", "数据库", "性能优化", "部署"],
  "traceId": "tr_test_011"
}
```

### 2.11 验证摘要质量

#### 2.11.1 验证摘要质量
```bash
# 验证摘要质量
curl -X GET "http://localhost:3000/api/summaries/sum_xxx/validate" \
  -H "x-user-id: user_123" \
  -H "x-trace-id: tr_test_012"

# 期望响应
{
  "summaryId": "sum_xxx",
  "isValid": true,
  "issues": [],
  "score": 95,
  "traceId": "tr_test_012"
}
```

### 2.12 检查会话是否有摘要

#### 2.12.1 检查会话摘要存在性
```bash
# 检查会话是否有摘要
curl -X GET "http://localhost:3000/api/summaries/conversation/conv_xxx/exists" \
  -H "x-user-id: user_123" \
  -H "x-trace-id: tr_test_013"

# 期望响应
{
  "conversationId": "conv_xxx",
  "hasSummary": true,
  "traceId": "tr_test_013"
}
```

## 3. 边界条件测试

### 3.1 分页边界
```bash
# 负数limit
curl -X GET "http://localhost:3000/api/summaries?limit=-10" \
  -H "x-user-id: user_123"

# 期望：使用默认值20

# 超过最大限制
curl -X GET "http://localhost:3000/api/summaries?limit=200" \
  -H "x-user-id: user_123"

# 期望：限制为100
```

### 3.2 内容长度边界
```bash
# 创建超长摘要（超过2000字符）
curl -X POST "http://localhost:3000/api/summaries" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -d '{
    "conversationId": "conv_xxx",
    "content": "'$(python3 -c "print('长' * 3000)")'"
  }'

# 期望响应 - 400 Bad Request（参数验证失败）
```

### 3.3 空数据测试
```bash
# 获取空摘要列表
curl -X GET "http://localhost:3000/api/summaries" \
  -H "x-user-id: new_user_123"

# 期望响应
{
  "items": [],
  "nextCursor": null,
  "traceId": "tr_xxx"
}
```

### 3.4 批量操作边界
```bash
# 批量生成空数组
curl -X POST "http://localhost:3000/api/summaries/batch-generate" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -d '{
    "conversationIds": []
  }'

# 期望响应 - 400 Bad Request
```

## 4. 性能测试

### 4.1 大量摘要列表
```bash
# 测试大量摘要的分页性能
curl -X GET "http://localhost:3000/api/summaries?limit=100" \
  -H "x-user-id: user_with_many_summaries"

# 期望：响应时间 < 500ms
```

### 4.2 批量生成性能
```bash
# 测试批量生成大量摘要
curl -X POST "http://localhost:3000/api/summaries/batch-generate" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -d '{
    "conversationIds": ["conv_1", "conv_2", ..., "conv_50"]
  }'

# 期望：响应时间 < 5s（50个会话）
```

### 4.3 摘要生成性能
```bash
# 测试长对话的摘要生成
curl -X POST "http://localhost:3000/api/summaries/conversation/conv_many_messages/generate" \
  -H "x-user-id: user_123"

# 期望：响应时间 < 10s（取决于AI模型调用）
```

## 5. 摘要生成策略测试

### 5.1 消息数量触发
```bash
# 创建包含15条消息的会话，然后生成摘要
curl -X POST "http://localhost:3000/api/summaries/conversation/conv_15_messages/generate" \
  -H "x-user-id: user_123"

# 应该成功生成，triggerReason为"message_count_15"
```

### 5.2 Token数量触发
```bash
# 创建包含大量文本的会话（token数>4000），然后生成摘要
curl -X POST "http://localhost:3000/api/summaries/conversation/conv_long_content/generate" \
  -H "x-user-id: user_123"

# 应该成功生成，triggerReason为"token_count_xxxx"
```

### 5.3 不满足条件的情况
```bash
# 创建只有5条消息的短会话，然后尝试生成摘要
curl -X POST "http://localhost:3000/api/summaries/conversation/conv_5_messages/generate" \
  -H "x-user-id: user_123"

# 期望响应 - 409 Conflict（不满足生成条件）
```

## 6. 隐私过滤测试

### 6.1 手机号过滤
```bash
# 创建包含手机号的摘要
curl -X POST "http://localhost:3000/api/summaries" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -d '{
    "conversationId": "conv_xxx",
    "content": "用户手机号13812345678需要联系",
    "triggerReason": "test"
  }'

# 验证内容是否被过滤为"用户手机号[PHONE]需要联系"
```

### 6.2 身份证过滤
```bash
# 创建包含身份证的摘要
curl -X POST "http://localhost:3000/api/summaries" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -d '{
    "conversationId": "conv_xxx",
    "content": "身份证号码110101199001011234需要验证",
    "triggerReason": "test"
  }'

# 验证内容是否被过滤为"身份证号码[ID_CARD]需要验证"
```

### 6.3 自定义模式过滤
```bash
# 配置自定义过滤模式后测试
# SUMMARY_CUSTOM_PATTERNS=["公司机密", "内部资料"]
```

## 7. 错误处理测试

### 7.1 认证失败
```bash
# 不提供用户ID
curl -X GET "http://localhost:3000/api/summaries/conversation/conv_xxx"

# 期望响应 - 401 Unauthorized
{
  "code": "AUTH_REQUIRED",
  "message": "Authentication required",
  "traceId": "tr_xxx"
}
```

### 7.2 参数验证失败
```bash
# 无效的conversationId格式
curl -X GET "http://localhost:3000/api/summaries/conversation/invalid-id-format" \
  -H "x-user-id: user_123"

# 期望响应 - 400 Bad Request（如果实现了格式验证）
```

### 7.3 权限验证失败
```bash
# 尝试操作其他用户的资源
curl -X DELETE "http://localhost:3000/api/summaries/conversation/other_user_conv" \
  -H "x-user-id: user_a"

# 期望响应 - 404 Not Found（隐藏资源存在性）
```

## 8. 集成测试

### 8.1 完整摘要生命周期
1. 创建会话并添加多条消息
2. 检查是否需要摘要（should meet criteria）
3. 生成摘要
4. 获取摘要验证内容
5. 更新摘要内容
6. 验证摘要质量
7. 提取关键词
8. 删除摘要

### 8.2 与消息模块集成
1. 创建会话
2. 添加超过10条消息
3. 检查是否需要摘要
4. 生成摘要
5. 在对话中使用摘要（prompt组装）

### 8.3 自动摘要触发
1. 配置自动摘要生成
2. 创建会话并持续添加消息
3. 观察摘要是否自动生成
4. 验证摘要内容质量

## 9. 配置测试

### 9.1 不同配置参数测试
```bash
# 修改配置参数后测试不同行为
SUMMARY_MIN_MESSAGES=5
SUMMARY_MIN_TOKENS=2000
SUMMARY_MAX_TOKENS=100
SUMMARY_STALE_HOURS=12
```

### 9.2 模型配置测试
```bash
# 切换不同的摘要模型
SUMMARY_MODEL=gpt-4
SUMMARY_MODEL=claude-3
SUMMARY_MODEL=mock-model
```

### 9.3 自动生成功能开关
```bash
# 关闭自动摘要生成
SUMMARY_AUTO_GENERATION=false
```

## 10. 验证要点

### 10.1 功能验证
- [ ] 创建会话摘要
- [ ] 获取会话摘要
- [ ] 更新会话摘要
- [ ] 删除会话摘要
- [ ] 自动生成摘要
- [ ] 批量生成摘要
- [ ] 摘要列表查询
- [ ] 摘要统计
- [ ] 关键词提取
- [ ] 质量验证

### 10.2 业务规则验证
- [ ] 消息数量触发（≥10条）
- [ ] Token数量触发（≥4000 tokens）
- [ ] 摘要长度限制（≤200 tokens）
- [ ] 过期时间机制（24小时）
- [ ] 隐私过滤功能
- [ ] 权限验证（用户隔离）

### 10.3 性能验证
- [ ] 摘要生成性能
- [ ] 批量操作性能
- [ ] 分页查询性能
- [ ] 统计查询性能

### 10.4 安全验证
- [ ] 内容长度限制
- [ ] 隐私信息过滤
- [ ] 权限控制
- [ ] 数据隔离

## 11. 已知问题和限制

1. **AI模型集成**：当前使用模拟摘要生成，需要集成实际的AI模型API
2. **Token计算**：依赖messages表的token_count字段，需要确保数据准确性
3. **隐私过滤**：自定义模式配置需要进一步完善
4. **批量处理**：大量会话的批量生成可能需要异步处理
5. **摘要质量**：质量评估算法需要更多实际数据调优

## 12. 下一步计划

### 12.1 高优先级
1. 集成实际的AI模型API（OpenAI、Claude等）
2. 完善token计算机制
3. 优化隐私过滤规则

### 12.2 中优先级
1. 实现异步批量摘要生成
2. 添加摘要质量评分机制
3. 支持更多摘要模型

### 12.3 低优先级
1. 添加摘要模板和样式配置
2. 实现摘要版本控制
3. 支持多语言摘要

---

**测试状态**: 📝 文档完成，等待实际测试执行
**最后更新**: 2026-01-28
**维护人员**: Personal Backend Engineer