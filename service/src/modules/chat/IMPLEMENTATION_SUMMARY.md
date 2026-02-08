# Chat 模块实现总结

## 1. 核心功能

### 1.1 LLM 集成
- ✅ 引入 `LlmModule`，基于 OpenAI SDK 实现通用 LLM 调用。
- ✅ 支持 OpenAI 兼容接口（如 Moonshot Kimi, DeepSeek 等）。
- ✅ 支持流式输出（Streaming）和完整生成（Completion）。

### 1.2 异步任务处理
- ✅ `ChatService` 实现了 `processTask` 方法，用于后台处理聊天任务。
- ✅ 支持 `createTask`, `retryMessage`, `continueMessage` 触发生成。
- ✅ 实时更新数据库中的消息内容（流式写入），支持前端 SSE 实时展示。
- ✅ 自动处理任务状态流转（pending -> running -> completed/failed）。
- ✅ 错误处理和状态回写。

### 1.3 摘要生成
- ✅ `SummariesProvider` 集成 `LlmService`，实现真实的摘要生成功能。
- ✅ 自动回退机制：如果 LLM 调用失败，回退到 Mock 生成（开发模式）。

## 2. 配置说明

### 2.1 环境变量
在 `.env` 文件中配置 LLM 参数：

```ini
# OpenAI Compatible Configuration
OPENAI_API_KEY="sk-..."
OPENAI_BASE_URL="https://api.moonshot.cn/v1"  # 可选，默认 https://api.openai.com/v1
CHAT_DEFAULT_MODEL="moonshot-v1-8k"           # 聊天模型
SUMMARY_MODEL="moonshot-v1-8k"                # 摘要模型
```

### 2.2 模型参数
- `temperature`: 默认 0.7
- `max_tokens`: 可选配置

## 3. 数据流
1. **用户请求** -> `POST /api/chat/tasks` -> 创建 Task (pending) -> 返回 TaskID。
2. **后台处理** -> `ChatService.processTask` 被触发（异步）。
   - 获取上下文（Conversation, Summary, Recent Messages）。
   - 构建 Prompt（包含 System Prompt, Character Config, History）。
   - 调用 LLM Stream。
3. **流式更新** -> 接收 Chunk -> 缓冲 -> 更新 `Message` 表 (content) -> 更新 `Task` 状态。
4. **前端展示** -> 前端通过 SSE (`GET /api/chat/tasks/:id/events`) 监听数据库变化 -> 实时显示。

## 4. 待优化项
- [ ] 消息重试机制优化（目前是 fire-and-forget）。
- [ ] Token 使用量统计计算（目前仅估算）。
- [ ] 更精细的错误处理（区分网络错误和模型错误）。
