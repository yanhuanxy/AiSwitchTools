# 角色扮演 AI 对话平台｜客户端设计文档 V1.0（Vue3）

- 版本：V1.0
- 对标：PRD V2.0（可落地研发版）
- 范围：角色配置、智能对话（含 SSE 流式）、图片上传、历史管理、账号与数据归属（匿名/绑定）
- 技术栈：Vue 3 + 组件化 + SPA（vue-router、Pinia、Fetch/Axios、EventSource）

---

## 1. 统一契约（前后端一致性）

### 1.1 基础约定
- Base URL：`/api`
- Content-Type：`application/json; charset=utf-8`
- 时间：ISO8601 UTC，例如 `2026-01-27T15:01:00Z`
- ID：ULID 字符串，服务端生成（前端仅生成 `clientMessageId`）
- Trace：每次响应携带 `traceId`（Header 或 JSON 字段），前端在错误上报时带上

### 1.2 认证与身份
- 身份鉴权使用 Token：前端对外请求携带 `Authorization: Bearer <accessToken>`
- accessToken 包含用户信息（JWT Claims）：`sub(userId)`、`identityType(anon|magicLink|email|phone)`、`tokenVersion`、`iat/exp`，可扩展 `sessionId`
- Token 续期：accessToken 过期后使用 refreshToken 换取新 accessToken（refreshToken 做 rotation，响应必返回新的 refreshToken）
- accessToken TTL：15 分钟
- refreshToken TTL：7 天（可配置）
- refreshToken 存储：refreshToken 必须持久化保存（例如 localStorage）；refresh 成功后原子性覆盖为新 refreshToken
- 并发刷新：客户端必须保证同一时刻仅有一个 refresh 请求在飞行中，其他请求等待同一个 refresh 结果，避免并发 refresh 触发重放保护
- 重放触发全端登出：若 refresh 接口返回 AUTH_REQUIRED（或 401）并提示凭证已失效，客户端清空本地 token 并自动切回匿名身份（POST /api/auth/anon），同时提示“登录失效，已切换为匿名，可重新绑定”
- 绑定登录使用魔法链接：现阶段不接入短信/邮箱验证码，但保留扩展口子
- 魔法链接：token TTL 10 分钟，使用后立即失效
- 魔法链接成功跳转：`/app?magic=success`

### 1.3 错误响应（非 SSE）
统一错误结构：
```json
{
  "code": "RATE_LIMITED",
  "message": "请求过快，请稍后重试",
  "traceId": "tr_xxx"
}
```

### 1.4 SSE 事件格式（流式）
- URL：`GET /api/chat/tasks/{taskId}/events`
- Content-Type：`text/event-stream`
- Event Types：`meta`、`delta`、`done`、`error`
- 心跳：每 30 秒发送 `keepalive`
- 超时断开：60 秒无数据服务端主动关闭
- 断线重连：补全文 + 前端去重（不追求 delta 精确）；重连后以 `assistantMessageId` 为主键覆盖为全文并继续追加
- Last-Event-ID：ULID 或时间戳字符串
- 每用户并发连接上限：3
- 多标签页并发：允许多连接，共享会话状态，前端去重

事件数据约定：
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

### 1.5 分页约定（游标）
列表返回统一结构：
```json
{
  "items": [],
  "nextCursor": null
}
```

- 会话列表：按 `updatedAt desc`，`nextCursor` 由服务端给出
- 消息列表：顺序稳定（按 `createdAt + id`），`nextCursor` 表示下一页起点
- 默认 limit=20，最大 limit=100
- `nextCursor` 采用 base64 编码并包含 HMAC 签名与过期信息

### 1.6 安全与清洗
- CORS 白名单：`https://yourdomain.com`，`http://localhost:3000`
- CSRF 防护：Cookie + SameSite=Strict + CSRF token
- 输入/输出清洗：后端必须做，前端做增强

---

## 2. 信息架构与路由

### 2.1 页面清单
- 我的角色（Role List）：`/roles`
- 角色详情（Role Detail）：`/roles/:id`
- 角色编辑（Role Editor）：`/roles/:id/edit`、`/roles/create`
- 对话页（Chat）：`/chat/:conversationId`
- 历史页（History）：`/history`

### 2.2 关键跳转
- 角色详情 -> 开始对话：创建会话后跳转 `/chat/:conversationId`
- 历史列表 -> 继续对话：进入 `/chat/:conversationId`（继续对话必须使用会话绑定的 characterVersionId）

---

## 3. 领域模型（前端视角）

### 3.1 Role（Character）
```ts
type Character = {
  id: string
  name: string
  bio?: string
  avatarAttachmentId?: string
  visibility: "private"
  createdAt: string
  updatedAt: string
}
```

### 3.2 Role Version（CharacterVersion）
```ts
type PromptConfig = {
  backgroundStory: string
  personalityTags: string[]
  speakingStyle: string
  fewShotExamples: Array<{ user: string; assistant: string }>
  tabooAndBoundaries: string
  safetyTightening?: Record<string, unknown>
}

type CharacterVersion = {
  id: string
  characterId: string
  version: number
  status: "draft" | "published"
  promptConfig: PromptConfig
  createdAt: string
}
```

### 3.3 Conversation / Message
```ts
type ConversationListItem = {
  conversationId: string
  title: string
  updatedAt: string
  lastMessagePreview: string
}

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  status?: "sent" | "generating" | "completed" | "failed" | "canceled"
  partial?: boolean
  supersededByMessageId?: string | null
  attachments?: Attachment[]
  createdAt: string
}
```

### 3.4 Attachment（图片）
```ts
type Attachment = {
  attachmentId: string
  scanStatus: "pending" | "passed" | "rejected" | "failed"
  viewUrl?: string
  mime?: string
  size?: number
  width?: number
  height?: number
}
```

---

## 4. 组件拆分（建议）

### 4.1 角色域
- RoleListPage：角色列表容器
- RoleCard：角色卡片
- RoleDetailPage：角色详情与版本信息
- RoleEditorPage：角色编辑页面
- RoleBasicForm：名称/简介/头像
- PromptConfigEditor：背景/标签/口吻/示例/禁忌编辑

### 4.2 对话域
- ChatPage：对话主页面（消息流 + 输入区 + 控制区）
- MessageList：消息列表（可后置虚拟滚动）
- MessageItem：消息气泡（user/assistant/状态/被替代提示）
- Composer：输入框 + 发送按钮
- AttachmentStrip：图片预览/删除/上传状态
- TaskControls：Stop/Retry/Continue 控件与状态

### 4.3 历史域
- HistoryPage：会话列表 + 分页加载
- ConversationList / ConversationListItem：展示 title/updatedAt/preview + 重命名/删除入口

---

## 5. 状态管理（Pinia）

### 5.1 Auth Store
- `accessToken`：当前访问令牌（用于 Authorization Header）
- `refreshToken`：刷新令牌（用于续期 accessToken）
- `expiresAt`：accessToken 过期时间
- `userId`：从 accessToken claims 解析（用于 UI 展示与埋点）
- `identityType`：anon | magicLink | email | phone（用于 UI 提示）
- `tokenVersion`：从 accessToken claims 解析（用于诊断 tokenVersion 变更导致的失效）

状态持久化与更新规则：
- 持久化：将 `accessToken/refreshToken/expiresAt` 持久化保存（例如 localStorage），页面刷新后优先从本地恢复
- 下发覆盖：任何下发 token 的接口（`POST /api/auth/anon`、`POST /api/auth/token/refresh`、`GET /api/auth/magic-link/consume`）返回成功后，必须原子性覆盖本地存储的 token 三元组
- rotation 覆盖：`POST /api/auth/token/refresh` 成功后，必须以响应中的新 refreshToken 覆盖旧 refreshToken（旧 refreshToken 视为立即失效）
- 单飞刷新：同一时刻只允许一个 refresh 在飞行中；并发请求需等待同一 refresh 结果，避免触发 refresh 重放保护
- 被动全端登出：若 refresh 返回 AUTH_REQUIRED（或 401 且明确为凭证失效，例如 tokenVersion 不匹配/refresh 已撤销/refresh 重放），则清空本地 token，并立刻 `POST /api/auth/anon` 切回匿名身份；同时关闭所有 SSE 连接/停止当前生成任务并提示“登录失效，已切换为匿名，可重新绑定”
- 主动登出：用户点击“退出登录”时调用 `POST /api/auth/logout`，成功后清空本地 token，并立刻 `POST /api/auth/anon` 切回匿名身份；重置用户相关缓存（Role/Conversation/Chat），跳转到 `/roles`

### 5.2 Role Store
- `roles`：我的角色列表
- `activeRole`：角色详情
- `activeVersions`：角色版本列表

### 5.3 Conversation Store
- `items`：会话列表（含 nextCursor）
- `activeConversation`：当前会话元信息（characterVersionId、title）

### 5.4 Chat Store
- `messagesByConversationId`：消息缓存（分页加载合并去重）
- `activeTaskByConversationId`：当前生成任务（taskId、assistantMessageId、status）
- `streamTextByAssistantMessageId`：SSE delta 拼接缓存

---

## 6. API 交互设计（前端实现口径）

### 6.0 认证与绑定
- `POST /api/auth/anon`
  - 说明：获取匿名身份的 token（若无 token 或 token 过期）
  - Response：`{ accessToken, refreshToken, expiresIn }`
- `POST /api/auth/token/refresh`
  - Request：`{ refreshToken }`
  - 说明：refreshToken 做 rotation（响应必返回新的 refreshToken，旧 refreshToken 立即失效）；若检测到 rotated refreshToken 被再次使用，服务端递增 tokenVersion 并登出全端
  - Response：`{ accessToken, refreshToken, expiresIn }`
- `POST /api/auth/logout`
  - 说明：登出并使该用户所有 token 失效（递增 tokenVersion）
  - Response：`{ ok: true }`
  - 前端行为：成功后清空本地 token，并立刻 `POST /api/auth/anon` 切回匿名身份；重置用户相关缓存并跳转到 `/roles`
- `POST /api/auth/magic-link/start`
  - Request：`{ email }`
  - Response：`{ ok: true }`
- `GET /api/auth/magic-link/consume?token=xxx`
  - 说明：魔法链接落地页调用，换取 token
  - Response：`{ accessToken, refreshToken, expiresIn }`
- 扩展口子（后续）：`/api/auth/phone/*`、`/api/auth/email-otp/*`

### 6.1 角色
- `POST /api/characters`
  - Request：`{ name, bio?, avatarAttachmentId? }`
  - Response：`{ id }`
- `POST /api/characters/{id}/versions`
  - Request：`{ status: "draft" | "published", promptConfig }`
  - Response：`{ versionId, version }`
- `PUT /api/character-versions/{versionId}`
  - 说明：仅允许更新 draft 版本（用于发布前编辑）
  - Request：`{ promptConfig }`
  - Response：`{ versionId }`
- `POST /api/character-versions/{versionId}/publish`
  - 说明：将 draft 发布为 published，发布后不可编辑
  - Response：`{ versionId, version }`
- `GET /api/characters`：返回角色列表
- `GET /api/characters/{id}`：角色详情
- `GET /api/characters/{id}/versions`：版本列表（用于编辑/回溯）

### 6.2 会话与历史
- `POST /api/conversations`
  - Request：`{ characterId }`
  - Response：`{ conversationId, characterVersionId }`
- `GET /api/conversations?cursor=&limit=`
  - Response：`{ items: ConversationListItem[], nextCursor }`
- `GET /api/conversations/{id}/messages?cursor=&limit=`
  - Response：`{ items: Message[], nextCursor }`
- `PATCH /api/conversations/{id}`
  - Request：`{ title }`
- `DELETE /api/conversations/{id}`：软删除

### 6.3 图片上传与回放
上传流程（前端）：
- `POST /api/uploads/images`（multipart/form-data）
  - Response：`{ attachmentId, scanStatus, viewUrl? }`
- 预留拓展：若服务端返回 `uploadUrl`，则前端走 `PUT uploadUrl` 直传对象存储，再通过 `GET /api/attachments/{id}` 获取 viewUrl
- `GET /api/attachments/{id}`：回放与展示（服务端返回短期 viewUrl）
- `DELETE /api/attachments/{id}`（可选）
  - 说明：用于删除“未被任何消息引用”的附件；若已引用，服务端返回 INVALID_PARAMS 或直接忽略删除
- viewUrl 有效期：1 小时
- uploadUrl 有效期：5 分钟
- 每用户最大并发上传：3

删除语义（客户端）：
- 在输入框区域点击“删除图片”：默认仅从本次发送的附件列表中移除（不影响历史回放）
- 若需要彻底删除已上传但未发送的附件：调用 `DELETE /api/attachments/{id}`

展示规则：
- `scanStatus=pending`：显示“扫描中”
- `scanStatus=passed`：显示图片
- `scanStatus=rejected`：显示“附件被拦截”，不参与对话理解
- `scanStatus=failed`：显示“扫描失败”，允许用户删除并重新上传
发送规则：
- 允许发送，但 `pending/rejected` 时不使用图片参与模型理解

### 6.4 对话（任务 + SSE）
- `POST /api/chat/tasks`
  - Request：
  ```json
  {
    "conversationId": "conv_001",
    "clientMessageId": "uuid-xxx",
    "content": "这张照片里有什么线索？",
    "attachmentIds": ["a_001"],
    "replyLength": "medium"
  }
  ```
  - Response：`{ userMessageId, assistantMessageId, taskId }`
- replyLength：short(128) / medium(512) / long(1024) / auto(动态最大 2048)
- `GET /api/chat/tasks/{taskId}/events`：SSE 拉流
- `POST /api/chat/tasks/{taskId}/cancel`：取消
- `POST /api/chat/messages/{assistantMessageId}/retry`：重试（生成新的 assistant 消息）
- `POST /api/chat/messages/{assistantMessageId}/continue`：续写（追加到同一条 assistant 消息，创建新的生成任务）

幂等要求：
- 前端每次发送 user 消息必须生成 `clientMessageId(UUID)`
- 若网络重试导致重复提交，服务端需返回同一组 messageId/taskId（前端需能无缝接续）
- `Idempotency-Key`：仅关键写操作启用，TTL 24 小时

### 6.5 对话与摘要策略
- 摘要触发：消息数 ≥ 10 或总 token ≥ 4000
- 摘要长度：≤ 200 tokens
- 隐私脱敏词典：手机号、身份证、银行卡、自定义关键词
- 平台系统规则：包含行为规范、格式要求、安全提示等固定模板段落

---

## 7. 对话控制（Stop / Retry / Continue）

### 7.1 Stop
- 点击 Stop 后：UI 立即停止渲染后续 delta
- 立刻调用取消接口：`POST /api/chat/tasks/{taskId}/cancel`
- 将当前 assistant 消息展示为 `partial=true`（“已停止生成”）

### 7.2 Retry（策略 A）
- 从“最近一条 assistant 消息”触发 Retry
- UI 逻辑：
  - 创建新的 assistant 消息占位
  - 旧消息标记为“已被替代”（supersededBy）
  - 调用 `POST /api/chat/messages/{assistantMessageId}/retry` 创建新 task

### 7.3 Continue
- 基于当前 assistant 消息续写
- UI 逻辑：
  - 调用 `POST /api/chat/messages/{assistantMessageId}/continue` 创建新 task
  - 将输出追加到同一条消息
  - 若断线重连，服务端会先补齐当前已生成全文，客户端以 `assistantMessageId` 去重并继续追加

---

## 8. 错误码与 UI 行为映射（执行口径）

- AUTH_REQUIRED：清空本地 token 并切回匿名（POST /api/auth/anon）；展示“登录失效，已切换为匿名，可重新绑定”
- FORBIDDEN：提示无权限并跳转到 `/roles` 或 `/history`
- RATE_LIMITED：提示“请求过快”，展示倒计时，禁用发送
- MODEL_TIMEOUT：保留已生成内容并标记 partial，展示“超时，可重试”
- MODEL_UNAVAILABLE：提示繁忙，允许重试
- CONTENT_BLOCKED：提示内容不支持，保留输入但不生成
- UPLOAD_FAILED：提示重传，已成功上传的不丢失
- INVALID_PARAMS：表单高亮错误（理论上前端应避免）

---

## 9. 验收用例（前端可执行）

- 创建角色并发布版本后：新会话绑定最新 published 版本（会话元信息展示 characterVersionId）
- 修改角色设定并发布新版本后：新会话使用新版本，旧会话继续旧版本
- 发送消息后：先 POST 创建 task，再 SSE 输出；完成后消息可回放
- 点击 Stop：1s 内停止输出，assistant 消息 partial=true
- Retry：生成新的 assistant 消息，旧消息标记 supersededBy
- clientMessageId 重复提交：不产生第二条 user 消息，返回同一 userMessageId
