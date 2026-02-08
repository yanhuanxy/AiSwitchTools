# 角色扮演 AI 对话平台｜服务端设计文档 V1.0（Node.js + NestJS/Express + SQLite）

- 版本：V1.0
- 对标：PRD V2.0（可落地研发版）
- 范围：账号与数据归属、角色/版本、会话/消息、上传/附件扫描、SSE 流式生成、取消/重试/续写、幂等、可观测
- 技术栈：Node.js（推荐 NestJS）+ SQLite（推荐 Prisma）

---

## 1. 统一契约（前后端一致性）

### 1.1 基础约定
- Base URL：`/api`
- JSON：`application/json; charset=utf-8`
- 时间：ISO8601 UTC
- ID：ULID 字符串（服务端生成）
- Trace：每次响应返回 `traceId`（建议 Header `x-trace-id` + JSON 字段）

### 1.2 认证与身份（Token）
- 身份鉴权使用 Token：`Authorization: Bearer <accessToken>`
- accessToken 使用 JWT，包含用户信息（Claims）：`sub(userId)`、`identityType(anon|magicLink|email|phone)`、`tokenVersion`、`iat/exp`，可扩展 `sessionId`
- Token 续期：通过 refreshToken 换取新 accessToken（refreshToken 做 rotation，refresh 时必换新；旧 refresh 立即失效）
- accessToken TTL：15 分钟
- refreshToken TTL：7 天（可配置）
- 刷新并发：同一时刻只允许 1 个 refresh 在途
- refreshToken 重放：若检测到 rotated 的 refreshToken 再次被使用，判定 refresh 泄露，递增 `users.tokenVersion` 并撤销该用户所有 refreshTokens
- 登出失效：通过递增 `users.tokenVersion` 使该用户所有 access/refreshToken 失效（access/refresh 的 `tokenVersion` 必须与 DB 一致）
- 绑定登录使用魔法链接：现阶段不接入短信/邮箱验证码，但保留扩展口子
- 魔法链接：token TTL 10 分钟，消费后立即失效（记录 `consumedAt`）
- 邮件发送服务选型：Resend 或 SendGrid
- 魔法链接成功跳转：`/app?magic=success`
- 权限：所有资源（角色/会话/消息/附件）均按 `ownerUserId` 鉴权

### 1.3 错误响应（非 SSE）
```json
{
  "code": "FORBIDDEN",
  "message": "无权限访问该资源",
  "traceId": "tr_xxx"
}
```

错误码集合（PRD）：
- AUTH_REQUIRED
- FORBIDDEN
- RATE_LIMITED
- MODEL_TIMEOUT
- MODEL_UNAVAILABLE
- CONTENT_BLOCKED
- UPLOAD_FAILED
- INVALID_PARAMS

### 1.4 SSE 事件格式
- `GET /api/chat/tasks/{taskId}/events`
- Content-Type：`text/event-stream`
- 事件：`meta`、`delta`、`done`、`error`
- 心跳：每 30 秒发送 `keepalive`
- 超时断开：无数据 60 秒后服务端主动关闭
- 断线重连：不追求 delta 精确补流；服务端在重连后先补齐当前已生成的 assistant 全文，客户端做去重（以 `assistantMessageId` 为准，用“覆盖为全文 + 继续追加”的策略）
- Last-Event-ID：ULID 或时间戳字符串
- 每用户并发连接上限：3
- 跨重启：不支持补流；服务端重启后客户端通过重发“最后一条 user 消息”（同 `clientMessageId`）续接（由幂等保证不产生重复消息）

```text
id: 1
event: meta
data: {"taskId":"t_123","assistantMessageId":"m_456","model":"gpt-x","resumed":false}

id: 2
event: delta
data: {"text":"你好，旅行者。"}

id: 3
event: done
data: {"tokenUsage":{"prompt":123,"completion":45,"total":168}}

id: 4
event: error
data: {"code":"MODEL_TIMEOUT","message":"模型超时","traceId":"tr_xxx"}
```

### 1.5 游标分页
统一结构：
```json
{
  "items": [],
  "nextCursor": null
}
```

排序要求（PRD）：
- 消息分页：顺序稳定（按 `createdAt + id`）
- 会话列表：按 `updatedAt desc`
- 默认 limit=20，最大 limit=100
- `nextCursor` 采用 base64 编码并包含 HMAC 签名与过期信息

---

## 2. 代码结构与分层（NestJS 推荐）

### 2.1 模块划分
- AuthModule：匿名身份、绑定登录、数据迁移
- CharactersModule：角色 CRUD
- CharacterVersionsModule：版本创建/发布/查询
- ConversationsModule：会话创建/列表/重命名/删除
- MessagesModule：消息分页/回放
- UploadsModule：图片上传申请
- AttachmentsModule：附件状态与回放 viewUrl
- ChatModule：prompt 组装、创建生成任务、Retry/Continue
- TasksModule：GenerationTask 状态、SSE 推送、取消
- SummariesModule：会话摘要策略
- SafetyModule：内容安全与风控（限流）
- ObservabilityModule：traceId、日志、指标

### 2.2 分层职责
- Controller：协议层（DTO 校验、返回结构）
- Service：业务编排（事务、状态机、策略）
- Repository/DAO：数据访问（SQLite）
- Provider：外部依赖抽象（模型、存储、扫描、限流、指标）

---

## 3. 数据模型与 SQLite 表设计（DDL 草案）

### 3.1 User / Identity
`users`
- id (pk)
- tokenVersion (int, default 0)
- createdAt

`user_identities`
- id (pk)
- userId (fk users.id)
- type: anon | phone | email
- identifierHash
- createdAt
- unique(type, identifierHash)

`user_refresh_tokens`
- id (pk)
- userId (fk users.id)
- tokenHash
- status: active | rotated | revoked | expired
- rotatedFromTokenId (nullable)
- createdAt
- lastUsedAt (nullable)
- expiresAt
- index(userId, status, expiresAt)

### 3.2 Character / Version
`characters`
- id (pk)
- ownerUserId
- name (1–30)
- avatarAttachmentId (nullable)
- bio (0–120, nullable)
- visibility: private
- createdAt
- updatedAt
- index(ownerUserId, updatedAt)

`character_versions`
- id (pk)
- characterId (fk)
- version (int, from 1)
- status: draft | published
- promptConfigJson (text)
- createdAt
- unique(characterId, version)
- index(characterId, status, version)

### 3.3 Conversation / Message
`conversations`
- id (pk)
- ownerUserId
- characterId
- characterVersionId
- title
- lastMessageAt (nullable)
- deletedAt (nullable)
- createdAt
- updatedAt
- index(ownerUserId, updatedAt)
- index(ownerUserId, deletedAt)

`messages`
- id (pk)
- conversationId
- ownerUserId
- role: user | assistant
- content (text)
- clientMessageId (nullable, user 必填)
- status: sent | generating | completed | failed | canceled
- partial (boolean)
- supersededByMessageId (nullable)
- createdAt
- updatedAt
- unique(conversationId, clientMessageId)
- index(conversationId, createdAt, id)

### 3.4 Attachment / Link
`attachments`
- id (pk)
- ownerUserId
- type: image
- storageKey
- mime
- size
- width (nullable)
- height (nullable)
- scanStatus: pending | passed | rejected | failed
- createdAt
- index(ownerUserId, createdAt)

`message_attachments`
- messageId
- attachmentId
- unique(messageId, attachmentId)

### 3.5 GenerationTask / Summary
`generation_tasks`
- id (pk)
- conversationId
- assistantMessageId
- status: pending | running | completed | canceled | failed
- model
- errorCode (nullable)
- errorMessage (nullable)
- tokenUsagePrompt (nullable)
- tokenUsageCompletion (nullable)
- tokenUsageTotal (nullable)
- createdAt
- updatedAt
- index(conversationId, createdAt)

`conversation_summaries`
- id (pk)
- conversationId (unique)
- content (text)
- createdAt
- updatedAt

### 3.6 Idempotency（可选增强）
`idempotency_records`
- key (pk)
- ownerUserId
- route
- requestHash
- responseJson
- createdAt
- expiresAt
- TTL：24 小时
- 存储建议：Redis
- 启用路由：`POST /api/chat/tasks`、`POST /api/conversations`、`POST /api/attachments`

---

## 4. 核心业务规则（对齐 PRD）

### 4.1 数据归属与迁移
- 所有资源归属 `ownerUserId`
- 匿名绑定时迁移 anon 名下资源到 auth 用户
- 同名角色冲突：保留两份，迁移来的角色自动重命名“(导入)”

### 4.2 角色版本与会话绑定
- 角色详情默认使用最新 published；无 published 则使用 draft
- 新会话默认绑定“最新 published”
- 旧会话继续使用旧版本，除非用户手动升级（接口可后置）

### 4.3 Prompt 组装顺序（必须一致）
1) 平台系统规则（安全/合规/格式）  
2) 角色版本 promptConfig（背景/风格/示例/禁忌）  
3) 会话摘要（如存在）  
4) 最近 N 条消息（默认 N=20，可配置）  
5) 本次用户输入（含图片引用，仅 passed）  

### 4.4 上下文窗口与摘要
- 当会话过长触发摘要：生成/更新 `conversation_summaries`
- 下次对话采用 “摘要 + 最近 N 条”
- 摘要必须避免敏感信息（必要时脱敏）
- 摘要触发：消息数 ≥ 10 或总 token ≥ 4000
- 摘要长度：≤ 200 tokens
- 隐私脱敏词典：手机号、身份证、银行卡、自定义关键词
- 平台系统规则：包含行为规范、格式要求、安全提示等固定模板段落

---

## 5. API 设计（请求/响应与语义）

### 5.0 认证与绑定
- `POST /api/auth/anon`
  - 说明：创建匿名用户并下发 token
  - Response：`{ "accessToken": "xxx", "refreshToken": "yyy", "expiresIn": 3600 }`

- `POST /api/auth/token/refresh`
  - Request：`{ "refreshToken": "yyy" }`
  - 说明：refreshToken 做 rotation（响应必返回新的 refreshToken，旧 refreshToken 立即失效）
  - 重放保护：若 rotated refreshToken 被再次使用，服务端递增 `users.tokenVersion` 并撤销该用户所有 refreshTokens
  - Response：`{ "accessToken": "xxx", "refreshToken": "yyy_new", "expiresIn": 3600 }`

- `POST /api/auth/logout`
  - 说明：登出并使该用户所有 token 失效（递增 `users.tokenVersion`，并将该用户 refresh tokens 标记为 revoked）
  - Response：`{ "ok": true }`

- `POST /api/auth/magic-link/start`
  - 说明：向邮箱发送魔法链接（现阶段只实现邮件发送；短信/OTP 留口子）
  - Request：`{ "email": "user@example.com" }`
  - Response：`{ "ok": true }`

- `GET /api/auth/magic-link/consume?token=xxx`
  - 说明：消费魔法链接 token，换取 access/refresh token
  - Response：`{ "accessToken": "xxx", "refreshToken": "yyy", "expiresIn": 3600 }`

- 扩展口子（后续）：`/api/auth/phone/*`、`/api/auth/email-otp/*`

### 5.1 角色与版本
- `POST /api/characters`
  - Request：
  ```json
  { "name": "夜行侦探", "bio": "冷静、克制、善于推理", "avatarAttachmentId": "a_001" }
  ```
  - Response：`{ "id": "c_001" }`

- `POST /api/characters/{id}/versions`
  - Request：
  ```json
  { "status": "published", "promptConfig": { "backgroundStory": "", "personalityTags": [], "speakingStyle": "", "fewShotExamples": [], "tabooAndBoundaries": "" } }
  ```
  - Response：`{ "versionId": "cv_001", "version": 1 }`

- `PUT /api/character-versions/{versionId}`
  - 说明：仅允许更新 draft 版本（用于发布前编辑），published 版本拒绝修改
  - Request：`{ "promptConfig": { ... } }`
  - Response：`{ "versionId": "cv_001" }`

- `POST /api/character-versions/{versionId}/publish`
  - 说明：将 draft 发布为 published；发布后不可编辑
  - Response：`{ "versionId": "cv_001", "version": 1 }`

- `GET /api/characters`
- `GET /api/characters/{id}`
- `GET /api/characters/{id}/versions`

校验规则（PRD）：
- name 1–30；bio 0–120
- promptConfig 字段长度与数量限制严格校验

### 5.2 会话与历史
- `POST /api/conversations`
  - Request：`{ "characterId": "c_001" }`
  - Response：`{ "conversationId": "conv_001", "characterVersionId": "cv_001" }`

- `GET /api/conversations?cursor=&limit=`
  - Response：
  ```json
  {
    "items": [
      { "conversationId": "conv_001", "title": "夜行侦探 01-27", "updatedAt": "2026-01-27T15:00:00Z", "lastMessagePreview": "说吧，你遇到了什么？" }
    ],
    "nextCursor": null
  }
  ```

- `PATCH /api/conversations/{id}`
  - Request：`{ "title": "新标题" }`
  - Response：`{ "conversationId": "conv_001", "title": "新标题" }`

- `DELETE /api/conversations/{id}`
  - 语义：软删除（设置 deletedAt），删除后不可访问

- `GET /api/conversations/{id}/messages?cursor=&limit=`
  - Response：
  ```json
  { "items": [{ "id": "m_u_001", "role": "user", "content": "我感觉被跟踪了", "attachments": [], "createdAt": "2026-01-27T15:01:00Z" }], "nextCursor": "xxx" }
  ```

分页稳定性：
- 查询条件必须带 ownerUserId
- 排序与游标使用 `createdAt + id`，避免同一时间戳乱序/重复

会话列表排序口径：
- 会话列表按 `updatedAt desc`
- 用户发送消息成功入库时立刻更新 `conversations.updatedAt` 并置顶
- assistant 生成完成/失败/取消不更新 `conversations.updatedAt`（避免“后台完成”导致列表跳动），但会更新 `lastMessageAt`
- lastMessagePreview：取该会话内最后一条“已完成可回放消息”的截断文本（user=sent 视为完成；assistant 取终态 completed/failed/canceled 且 `supersededByMessageId` 为空）

### 5.3 上传图片与附件回放
- `POST /api/uploads/images`（multipart/form-data）
  - 说明：后端直收 multipart 上传；同时预留“签名直传对象存储”的拓展口子
  - Request：`multipart/form-data`（field: `file`）
  - Response：
  ```json
  { "attachmentId": "a_001", "scanStatus": "pending", "viewUrl": null }
  ```
  - 扫描：异步扫描，MVP 使用同进程轻量队列；仅当 `scanStatus=passed` 时返回真实 `viewUrl`
  - 队列恢复：服务启动时拉取 `scanStatus=pending` 且 `createdAt` 在 1h 内的附件重新入队；超过 1h 未完成则标记 `failed`
  - 可选拓展：若返回 `uploadUrl`，客户端可走 `PUT uploadUrl` 直传对象存储，再用 `GET /api/attachments/{id}` 获取 `viewUrl`
  - viewUrl 有效期：1 小时
  - uploadUrl 有效期：5 分钟
  - 每用户最大并发上传：3
  - 扫描引擎：NSFW JS 库、ClamAV 或云服务（AWS Rekognition/Google Vision）

- `GET /api/attachments/{id}`
  - 说明：仅当 `scanStatus=passed` 时返回真实 `viewUrl`；否则返回 `viewUrl: null`
  - Response：
  ```json
  { "attachmentId": "a_001", "scanStatus": "passed", "viewUrl": "https://cdn.example.com/signed-view-url" }
  ```

- `DELETE /api/attachments/{id}`（可选）
  - 说明：仅允许删除未被任何 message 引用的附件；已引用则返回 INVALID_PARAMS 或忽略删除

上传限制（PRD）：
- jpg/png/webp
- 单张 ≤ 10MB
- 单次最多 4 张

扫描语义（PRD）：
- rejected：不可用于模型理解；回放显示“附件被拦截”

### 5.4 对话任务（幂等 + SSE）
- `POST /api/chat/tasks`
  - Request：
  ```json
  { "conversationId": "conv_001", "clientMessageId": "uuid-xxx", "content": "这张照片里有什么线索？", "attachmentIds": ["a_001"], "replyLength": "medium" }
  ```
  - replyLength：short(128) / medium(512) / long(1024) / auto(动态最大 2048)
  - 附件使用：允许发送任意 scanStatus 的 attachmentIds，但服务端仅将 `passed` 附件纳入模型理解（pending/rejected 只用于历史展示）
  - 创建时机：POST 时立即创建 userMessage、assistantMessage（status=generating）与 generation_task（status=pending），并返回 ID；后续通过 SSE 推送与落库更新状态
  - Response：`{ "userMessageId": "m_u_002", "assistantMessageId": "m_a_002", "taskId": "t_002" }`

幂等规则（PRD）：
- `conversationId + clientMessageId` 唯一
- 命中幂等时：返回同一组 messageId 与 task 信息（并返回当前 task 状态）

- `GET /api/chat/tasks/{taskId}/events`（SSE）
  - 断线重连：补全文 + 前端去重（不追求 delta 精确）
  - 跨重启：不支持补流；客户端重发最后一条 user 消息（同 `clientMessageId`）续接
- `POST /api/chat/tasks/{taskId}/cancel`
  - Response：`{ "taskId": "t_002", "status": "canceled" }`

Stop 语义（PRD）：
- 取消后停止继续推送
- assistant 消息落库 `partial=true`
- P95 1s 内生效

### 5.5 Retry / Continue（建议补齐接口）
- `POST /api/chat/messages/{assistantMessageId}/retry`
  - 语义：策略 A（保留原消息 + 新增 assistant 消息；原消息标记 supersededBy）
  - Response：`{ "newAssistantMessageId": "m_a_003", "taskId": "t_003" }`

- `POST /api/chat/messages/{assistantMessageId}/continue`
  - 语义：对同一条 assistant 消息续写追加内容；服务端新建 task 以便审计与落库一致
  - Response：`{ "assistantMessageId": "m_a_002", "taskId": "t_004" }`

---

## 6. 状态机（PRD 落地）

### 6.1 GenerationTask
- pending → running → completed
- pending/running → canceled
- pending/running → failed

进入条件（PRD）：
- pending：创建 task 成功但未开始拉流
- running：SSE 开始推送或模型开始生成
- completed：done 落库成功
- canceled：取消成功且停止推送，assistant partial=true
- failed：error 触发并落库 errorCode

### 6.2 Message
- user：sent
- assistant：generating → completed/canceled/failed

---

## 7. SSE 实现要点（工程化）

### 7.1 连接语义
- 建议每个 task 允许单连接（重复连接返回当前状态或断开旧连接）
- 断线重连恢复：不追求 delta 精确补流；重连后先发送 `meta(resumed=true)`，随后发送 1 条 `delta(text=<当前已生成全文>)`，客户端以 `assistantMessageId` 为主键做去重/覆盖，然后继续接收后续 delta 追加内容

### 7.2 落库策略（PRD 一致性）
- POST /api/chat/tasks：创建 assistantMessage（status=generating）与 generation_task（status=pending）
- SSE 建立：写入 generation_task.status=running 并发送 meta
- delta：默认仅内存拼接
- done/canceled/failed：最终一次性写入 messages.content/status/partial 与 generation_task 的 tokenUsage/status/errorCode

### 7.3 取消实现
- 使用 AbortController 或内部取消信号终止模型生成
- 写库必须幂等：重复 cancel 不应报错（返回当前 status）

---

## 8. 可观测、审计与风控

### 8.1 指标（PRD）
- chat_ttft_ms（P50/P95）
- chat_stream_interrupt_rate
- chat_error_rate_by_code
- token_usage_total（按用户/角色/模型）
- upload_success_rate / upload_latency_ms
- 告警阈值：错误率 > 3%，P99 RT > 5s，SSE 中断率 > 10%

### 8.2 日志（脱敏）
- 每个请求记录：traceId、userId、conversationId、taskId、errorCode（脱敏）
- SSE 关键点记录：连接建立、meta 发出、done/canceled/failed

### 8.3 限流
- 维度：userId + route
- 策略：固定窗口/令牌桶（单机内存；可扩展 Redis）
- 返回错误码：RATE_LIMITED
- 每用户每路由速率：5 req/s（突发 10）
- 全局熔断：错误率 > 5% 持续 1 分钟触发告警并自动降级，返回 503

### 8.4 内容安全
- 输入：文本 + 附件（rejected 不参与 prompt）
- 输出：必要时做输出审核（MVP 可先依赖平台规则）

### 8.5 网络安全与清洗
- CORS 白名单：`https://yourdomain.com`，`http://localhost:3000`
- CSRF 防护：Cookie + SameSite=Strict + CSRF token
- 输入/输出清洗：后端必须做

---

## 9. 验收用例（服务端可执行）

- 新会话绑定最新 published；无 published 绑定 draft
- 角色发布新版本：新会话用新版本；旧会话不变
- 发送消息：一次 POST 创建 task + SSE 输出 + done 落库可回放
- Stop：1s 内生效，assistant partial=true，task=canceled
- Retry：新增 assistant 消息，旧消息 supersededBy
- 幂等：同 conversationId+clientMessageId 重复提交不产生第二条 user 消息
