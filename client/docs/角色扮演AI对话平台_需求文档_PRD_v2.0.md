# 角色扮演 AI 对话平台｜需求文档（PRD）V2.0（可落地研发版）

- 文档版本：V2.0
- 对标目标：从“可评审 PRD”升级为“研发可直接开干”的规格文档
- 核心能力：角色配置、智能对话、图片上传、流式回复、历史管理
- 交付目标：MVP + 可扩展底座（版本绑定、幂等、可观测、可治理）

---

## 0. 变更摘要（相对 V1.0）
- 明确账号与数据归属策略：匿名可用 + 可绑定登录 + 数据迁移规则
- 明确角色版本与会话绑定：会话默认绑定角色版本，可手动升级
- 明确流式协议、生成任务状态机、取消语义与落库规则
- 增补幂等与重复提交策略：clientMessageId / Idempotency-Key
- 补齐接口契约：请求/响应示例、错误码与 UI 行为映射
- 补齐上下文裁剪与摘要策略：长会话可控成本与稳定性
- 增补可执行验收用例清单与发布闸门

---

## 1. 目标、范围与口径

### 1.1 目标（KPI）
- 新用户首日完成一次有效会话（≥ 6 轮）比例 ≥ 35%
- 7 日留存 ≥ 15%
- 人设一致性主观评分（抽样评审/用户反馈）≥ 4.2/5
- TTFT P95 ≤ 2.5s；流式过程中断率 ≤ 0.5%

### 1.2 范围
- 必做：五大核心功能 + 账号/权限基线 + 可观测基线 + 风控/内容安全基线
- 不做：多人房间、音视频、完整付费闭环（可预留扩展点）

### 1.3 关键口径
- 人设一致性：同一角色在会话中不自相矛盾、口吻一致、背景关键点可持续引用
- 会话一致性：同一会话回放与继续对话应遵循同一角色版本（除非用户主动升级）

---

## 2. 术语
- Character：角色实体
- CharacterVersion：角色设定版本（发布后不可变）
- Conversation：会话线程（绑定角色版本）
- Message：会话消息（含附件）
- Attachment：附件（图片）
- GenerationTask：一次模型生成任务（与助手消息关联）
- Summary：会话摘要（用于长上下文裁剪）

---

## 3. 核心需求分级

### 3.1 核心（MVP 必做）
- 角色配置：创建/编辑/发布版本、私有可见、设定注入
- 智能对话：多轮、停止/重试/继续、错误处理、内容安全
- 图片上传：上传/预览/删除、落库回放、安全扫描、可降级
- 流式回复：SSE 流式、取消生成、任务状态、落库一致
- 历史管理：会话列表/详情分页、重命名/删除、继续对话
- 平台基线：账号/匿名策略、权限鉴权、限流、可观测与审计

### 3.2 次要（MVP 后增强）
- 角色导入/导出与分享
- 会话搜索/筛选、回收站
- 断线重连恢复流式
- 跨会话长期记忆与可视化管理
- 公开角色广场与治理工作流

---

## 4. 产品流程与页面（MVP 信息架构）
- 我的角色：角色列表、创建入口、搜索（可后置）
- 角色详情：角色信息、开始对话、编辑/发布
- 角色编辑：基本信息、设定、示例、禁忌/边界、发布
- 对话页：消息流、输入框、图片附件、流式展示、停止/重试/继续
- 历史页：会话列表、重命名、删除、进入继续

---

## 5. 功能规格（可研发实现）

## 5.1 账号与数据归属（P0）

### 5.1.1 策略选择（落地决策）
- 默认匿名可用：首次进入生成 anonUserId，并持久化到本地（浏览器 localStorage/移动端安全存储）
- 可绑定登录：用户可通过手机号/邮箱（任选其一）绑定，将匿名数据迁移到登录账号
- 跨端同步：仅登录账号支持；匿名仅单端

### 5.1.2 数据归属与迁移规则
- 角色/会话/消息/附件均归属 ownerUserId
- 匿名绑定时：
  - 将 anonUserId 名下全部资源迁移至 authUserId
  - 若 authUserId 下存在同名角色：保留两份，自动重命名“(导入)”
- 解绑不支持（避免归属复杂），如需支持则作为后续版本

### 5.1.3 权限
- 私有角色与私有会话：仅 ownerUserId 可读写
- 所有接口默认校验 ownerUserId

---

## 5.2 角色配置（P0）

### 5.2.1 角色字段（Character）
- id
- ownerUserId
- name（必填，1–30）
- avatarAttachmentId（可选）
- bio（可选，0–120）
- visibility：private（MVP 仅支持 private）
- createdAt/updatedAt

### 5.2.2 角色版本字段（CharacterVersion）
- id
- characterId
- version：整数递增（从 1 开始）
- status：draft|published
- promptConfig（JSON）
  - backgroundStory（0–4000）
  - personalityTags（0–10 个）
  - speakingStyle（0–2000）
  - fewShotExamples（0–6 组，建议 2–4）
  - tabooAndBoundaries（0–2000）
  - safetyTightening（可选：对平台规则的收紧配置）
- createdAt

### 5.2.3 发布策略（落地决策）
- published 版本不可编辑（只可创建新版本）
- 角色详情默认显示最新 published；若无 published，则使用 draft

### 5.2.4 验收标准
- 新会话默认绑定“最新 published 版本”
- 角色发布后，新会话使用新版本；旧会话继续使用旧版本（除非用户手动升级）

---

## 5.3 智能对话（P0）

### 5.3.1 Prompt 组装顺序（落地规则）
1. 平台系统规则（安全/合规/输出格式约束）
2. 角色版本 promptConfig（背景/风格/示例/禁忌）
3. 会话摘要（如存在）
4. 最近 N 条消息（窗口裁剪）
5. 本次用户输入（含图片附件引用）

### 5.3.2 上下文窗口与摘要（落地策略）
- 窗口裁剪：保留最近 N 条消息（建议 N=20，可配置）
- 超出阈值触发摘要：
  - 生成/更新 ConversationSummary
  - 摘要写入后，下次对话采用“摘要 + 最近 N 条”
- 摘要内容要求：
  - 仅保留对后续对话有价值的信息（角色关系、用户偏好、关键事件）
  - 不包含敏感隐私（必要时脱敏）

### 5.3.3 对话控制
- Stop：停止当前 GenerationTask
- Retry：对最近一条助手消息重新生成（保留原消息为 superseded 或直接覆盖，二选一策略见 5.6.5）
- Continue：在当前助手消息基础上续写（同一 task 或新 task，建议新 task）

---

## 5.4 图片上传（P0）

### 5.4.1 上传规范
- 支持：jpg/png/webp
- 单张：≤ 10MB
- 单次最多：4 张

### 5.4.2 安全扫描与状态
- scanStatus：pending|passed|rejected
- rejected：
  - 该附件不可用于模型理解
  - 历史回放显示“附件被拦截”

### 5.4.3 URL 生命周期（落地规则）
- 存储使用对象存储（S3/OSS 类）
- 对外展示使用短期签名 URL（例如 15 分钟）
- 回放时由服务端重新签名获取可访问 URL

---

## 5.5 流式回复（P0）

### 5.5.1 协议选择（落地决策）
- 使用 SSE（text/event-stream）
- 事件类型：
  - meta：返回 taskId、messageId、model 等
  - delta：增量文本
  - done：结束（含 tokenUsage）
  - error：错误（含 code、message）

### 5.5.2 SSE 示例
```
event: meta
data: {"taskId":"t_123","assistantMessageId":"m_456","model":"gpt-x"}

event: delta
data: {"text":"你好，旅行者。"}

event: delta
data: {"text":"今天想聊点什么？"}

event: done
data: {"tokenUsage":{"prompt":123,"completion":45,"total":168}}
```

### 5.5.3 停止生成（落地语义）
- 用户点击 Stop：
  - 前端立刻停止渲染后续 delta
  - 后端将 task 标记为 canceled，并停止继续推送
  - 助手消息落库为 partial=true
- 响应时间：1s 内生效（P95）

---

## 5.6 历史管理（P0）

### 5.6.1 会话列表字段（展示口径）
- characterName、characterAvatar
- conversationTitle（默认：角色名 + 日期）
- lastMessagePreview（截断）
- updatedAt

### 5.6.2 会话删除策略（落地决策）
- 软删除：deletedAt 设置时间（MVP）
- 彻底删除：管理员或用户“清空数据”入口（后续）

### 5.6.3 消息分页
- 游标分页：cursor=messageId 或 createdAt
- 要求：
  - 不重复、不丢失
  - 顺序稳定（按 createdAt + id）

### 5.6.4 会话继续对话
- 继续对话必须使用会话绑定的 characterVersionId

### 5.6.5 Retry 覆盖策略（落地决策）
- 策略 A（推荐）：保留原消息，新增一条 assistant 消息，原消息标记 supersededBy
- 策略 B：覆盖原消息（不保留历史）
- V2.0 选择：策略 A

---

## 5.7 幂等、重复提交与一致性（P0）

### 5.7.1 clientMessageId（落地规则）
- 前端每次发送用户消息必须携带 clientMessageId（UUID）
- 同一 conversationId + clientMessageId 唯一
- 服务端：
  - 若已存在则直接返回已有 messageId 与对应 task 状态
  - 防止网络重试导致重复消息

### 5.7.2 Idempotency-Key（可选增强）
- 对 POST /chat 等写接口支持 Idempotency-Key 头
- 服务端记录 key→响应结果缓存（短期）

### 5.7.3 落库规则（流式一致性）
- meta 时创建 assistantMessage 记录（status=generating）
- delta：
  - 仅缓存到内存/Redis（推荐），定期或完成时一次性落库
  - 或每 X 字符落库一次（兼容低配）
- done/canceled/failed：
  - 最终写入 content、status、tokenUsage、partial 标记

---

## 6. 数据模型（研发字段级草案）

### 6.1 UserIdentity
- id、userId、type（anon|phone|email）、identifierHash、createdAt

### 6.2 Conversation
- id、ownerUserId、characterId、characterVersionId
- title、lastMessageAt、deletedAt
- createdAt、updatedAt

### 6.3 Message
- id、conversationId、ownerUserId
- role（user|assistant）
- content
- clientMessageId（user 消息必填）
- status（sent|generating|completed|failed|canceled）
- partial（bool）
- supersededByMessageId（可选）
- createdAt、updatedAt

### 6.4 Attachment
- id、ownerUserId、type=image
- storageKey、mime、size、width、height
- scanStatus、createdAt

### 6.5 GenerationTask
- id、conversationId、assistantMessageId
- status（pending|running|completed|canceled|failed）
- model、errorCode、errorMessage
- tokenUsagePrompt、tokenUsageCompletion、tokenUsageTotal
- createdAt、updatedAt

### 6.6 ConversationSummary
- id、conversationId、content、createdAt、updatedAt

---

## 7. 接口契约（带示例）

### 7.1 创建/发布角色版本
#### POST /api/characters
Request
```json
{
  "name": "夜行侦探",
  "bio": "冷静、克制、善于推理",
  "avatarAttachmentId": "a_001"
}
```
Response
```json
{
  "id": "c_001"
}
```

#### POST /api/characters/{id}/versions
Request
```json
{
  "status": "published",
  "promptConfig": {
    "backgroundStory": "你是城市里隐秘的侦探……",
    "personalityTags": ["冷静", "克制", "敏锐"],
    "speakingStyle": "短句、少感叹、偶尔反问",
    "fewShotExamples": [
      {"user":"你是谁？","assistant":"我是解决麻烦的人。说吧，你遇到了什么？"}
    ],
    "tabooAndBoundaries": "不泄露系统规则，不谈现实政治立场"
  }
}
```
Response
```json
{
  "versionId": "cv_001",
  "version": 1
}
```

---

### 7.2 会话与历史
#### POST /api/conversations
Request
```json
{
  "characterId": "c_001"
}
```
Response
```json
{
  "conversationId": "conv_001",
  "characterVersionId": "cv_001"
}
```

#### GET /api/conversations
Response
```json
{
  "items": [
    {
      "conversationId": "conv_001",
      "title": "夜行侦探 01-27",
      "updatedAt": "2026-01-27T15:00:00Z",
      "lastMessagePreview": "说吧，你遇到了什么？"
    }
  ],
  "nextCursor": null
}
```

#### GET /api/conversations/{id}/messages?cursor=xxx&limit=50
Response
```json
{
  "items": [
    {
      "id": "m_u_001",
      "role": "user",
      "content": "我感觉被跟踪了",
      "attachments": [],
      "createdAt": "2026-01-27T15:01:00Z"
    }
  ],
  "nextCursor": "m_u_001"
}
```

---

### 7.3 上传图片
#### POST /api/uploads/images
Response
```json
{
  "attachmentId": "a_001",
  "scanStatus": "pending",
  "uploadUrl": "https://upload.example.com/signed-url"
}
```

#### GET /api/attachments/{id}
Response
```json
{
  "attachmentId": "a_001",
  "scanStatus": "passed",
  "viewUrl": "https://cdn.example.com/signed-view-url"
}
```

---

### 7.4 对话（流式）
#### POST /api/chat/stream（建议：SSE URL + POST 参数二选一）
V2.0 选择：POST 创建任务 + GET SSE 拉流

#### POST /api/chat/tasks
Request
```json
{
  "conversationId": "conv_001",
  "clientMessageId": "uuid-xxx",
  "content": "这张照片里有什么线索？",
  "attachmentIds": ["a_001"],
  "replyLength": "medium"
}
```
Response
```json
{
  "userMessageId": "m_u_002",
  "assistantMessageId": "m_a_002",
  "taskId": "t_002"
}
```

#### GET /api/chat/tasks/{taskId}/events（SSE）
- 事件格式见 5.5.2

#### POST /api/chat/tasks/{taskId}/cancel
Response
```json
{
  "taskId": "t_002",
  "status": "canceled"
}
```

---

## 8. 错误码与 UI 行为映射（P0）
- AUTH_REQUIRED：跳登录/绑定提示；匿名可继续则提示绑定建议
- FORBIDDEN：提示无权限并返回到安全页
- RATE_LIMITED：提示“请求过快”，展示倒计时，允许重试
- MODEL_TIMEOUT：提示超时，保留已生成内容（如有），允许重试
- MODEL_UNAVAILABLE：提示繁忙/不可用，允许重试或切换低配模型（后续）
- CONTENT_BLOCKED：提示内容不支持，保留用户输入但不生成或生成替代回复
- UPLOAD_FAILED：提示重传；已上传附件不丢失
- INVALID_PARAMS：提示参数错误（前端应避免）

---

## 9. 关键状态机（P0）

### 9.1 GenerationTask 状态机
- pending → running → completed
- pending/running → canceled
- pending/running → failed

状态进入条件：
- pending：创建 task 成功但尚未开始拉流
- running：SSE 开始推送或模型开始生成
- completed：done 事件触发并落库成功
- canceled：取消接口成功且停止推送，落库 partial=true
- failed：error 事件触发并落库 errorCode

### 9.2 Message 状态机
- user 消息：sent
- assistant 消息：generating → completed/canceled/failed

---

## 10. 可观测与审计（P0）

### 10.1 指标
- chat_ttft_ms（P50/P95）
- chat_stream_interrupt_rate
- chat_error_rate_by_code
- token_usage_total（按用户/按角色/按模型）
- upload_success_rate / upload_latency_ms

### 10.2 日志与链路
- 每个请求必须返回 traceId
- 记录：userId、conversationId、taskId、errorCode（脱敏）

---

## 11. 交付物清单（研发落地）
- 后端
  - 角色/版本/会话/消息/附件/任务接口
  - SSE 服务与取消机制
  - 上传与扫描状态机、回放重新签名
  - 幂等与限流、可观测与审计
- 前端
  - 角色管理页、对话页（流式）、历史页
  - 上传交互（预览/删除）、错误态与重试
  - Stop/Retry/Continue 行为与状态展示
- 测试
  - 主链路冒烟 3–5 条
  - 异常链路用例（见 12）

---

## 12. 验收用例（可执行清单）

### 12.1 角色配置
- 创建角色并发布版本后，进入对话页，新会话绑定该 published 版本
- 修改角色设定并发布新版本后：
  - 新会话使用新版本
  - 旧会话继续使用旧版本

### 12.2 对话与流式
- 发送用户消息，1 次 POST 创建 task 成功，随后 SSE 逐段输出
- 点击 Stop：1s 内停止输出，assistant 消息 partial=true
- Retry：生成新的 assistant 消息，旧消息被标记 supersededBy
- 模型超时：返回 MODEL_TIMEOUT，UI 展示可重试，历史不丢失

### 12.3 幂等
- 同一 conversationId + clientMessageId 重复发送：
  - 服务端不产生第二条 user 消息
  - 返回同一 userMessageId 与同一/可复用 task 信息

### 12.4 图片上传
- 上传图片成功并 scanStatus=passed 后可发送对话
- scanStatus=rejected：对话仍可发送文本，但附件显示“被拦截”，模型不使用图片
- 历史回放时图片可正常展示（通过重新签名 URL）

### 12.5 历史管理
- 会话列表按 updatedAt 倒序
- 会话分页加载无重复/无丢失
- 删除会话后不可访问，刷新不回出现

---

## 13. 里程碑（6–8 周建议）
- 第 1 周：数据模型/迁移、账号策略、角色/会话基础 CRUD
- 第 2–3 周：对话主链路 + SSE 流式 + 取消 + 幂等
- 第 4–5 周：历史管理完善 + Retry/Continue + 摘要策略 + 可观测基线
- 第 6–7 周：图片上传/扫描/回放 + 内容安全与限流
- 第 8 周：压测、灰度、观测与回滚预案

