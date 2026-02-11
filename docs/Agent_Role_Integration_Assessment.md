# Agent功能与角色对话整合技术评估报告

**版本**: 1.0  
**日期**: 2026-02-12  
**状态**: 已归档  
**作者**: Full Stack Engineer  

---

## 1. 现有触发机制深度分析 (Current Mechanism Analysis)

### 1.1 触发条件与链路
目前系统中，工作流（Workflow）的触发采用 **硬绑定 (Hard Binding)** 模式：
*   **配置态**: 用户在创建/编辑角色（Character）时，通过 `workflowId` 字段绑定一个特定的工作流。
*   **运行态 (`processTask`)**:
    1.  用户发送消息 -> 创建 Task。
    2.  后端检查 `conversation.characterVersion.workflowId`。
    3.  **If exists**: 系统拦截标准对话流程，直接调用 `workflowEngine.executeWorkflow()`。
    4.  **Else**: 进入标准 RAG + LLM 流程。

### 1.2 数据流转
*   **Input**: `input` (用户最新消息), `history` (最近 50 条消息)。
*   **Output**: 工作流执行结果直接作为 `assistantMessage` 内容更新到数据库。
*   **当前痛点**: 
    *   不支持流式输出（Streaming），用户必须等待工作流完全执行完毕（延迟高）。
    *   缺乏中间状态展示（如“正在思考”、“正在搜索”），用户体验像“黑盒”。

---

## 2. 兼容性分析 (Compatibility Analysis)

| 维度 | 原有角色 (Role) | 新 Agent | 兼容性评估 |
| :--- | :--- | :--- | :--- |
| **数据模型** | 基于 `Character` + `CharacterVersion` | 预计基于 `Agent` (或复用 Character) | **高**。Agent 本质上是增强版的 Character，只需增加 Capabilities 字段。 |
| **前端 UI** | `ChatPage.vue` (MessageList + Composer) | 需展示“思考过程”和“工具调用” | **中**。需改造 `MessageItem` 以支持结构化日志（Thought Chain）展示。 |
| **API 接口** | `POST /api/chat/tasks` | 需支持更复杂的意图路由 | **高**。核心 Payload (ConversationId + Content) 完全一致，无需破坏性变更。 |
| **状态管理** | `ChatStore` (Messages + ActiveTask) | 需增加 `AgentState` (Thinking/Acting) | **中**。现有 Store 结构可扩展，支持存储结构化事件流。 |

---

## 3. 方案对比评估 (Strategy Comparison)

### 方案一：独立新页面 (Standalone Page)
*   **路径**: `/agent/chat/:id`
*   **优点**: 
    *   **隔离性**: 不破坏现有 Role Chat 的稳定性。
    *   **自由度**: 可以随意设计全新的 UI（如左侧对话，右侧工作流画布）。
*   **缺点**:
    *   **代码重复**: 需要复制 `ChatPage.vue` 80% 的逻辑（SSE 连接、输入框、历史加载）。
    *   **用户体验割裂**: 用户不仅要理解“角色”，还要理解“Agent”，且两者界面不通。
    *   **维护成本**: 修复一个 Bug（如 Markdown 渲染）需要在两个页面修改。

### 方案二：功能合并集成 (Unified Integration) **[推荐]**
*   **路径**: 复用 `/chat/:id`
*   **策略**: 将 Agent 视为一种特殊的 Role（或者 Role 升级为 Agent）。
*   **优点**:
    *   **一致体验**: 用户无感知升级，所有“角色”都具备了调用工作流的能力。
    *   **架构收敛**: 只有一套对话运行时 (Runtime)，降低系统熵值。
    *   **渐进增强**: 旧 Role 继续工作，新 Agent 仅多出“思考组件”。
*   **缺点**:
    *   **UI 复杂度增加**: `MessageItem` 组件需要重构以支持渲染“工作流执行卡片”。

---

## 4. 技术选型与实施建议 (Implementation Plan)

### 4.1 前端架构调整
1.  **组件拆分**: 
    *   将 `MessageItem` 拆分为 `StandardMessage` (纯文本) 和 `AgentMessage` (含执行状态)。
    *   新增 `WorkflowStatusCard` 组件，用于展示 `Thinking...`、`Searching...` 等中间状态。
2.  **状态管理 (Pinia)**:
    *   在 `ChatStore` 中扩展 `Message` 类型，增加 `trace_logs` 字段，用于存储 SSE 推送过来的中间步骤。

### 4.2 路由与 API
*   保持 `POST /api/chat/tasks` 不变。
*   **关键升级**: 改造 SSE 事件流协议。
    *   现有: `delta` (文本增量), `done`.
    *   新增: `tool_use` (工具调用), `tool_result` (工具结果), `thought` (思维链)。

### 4.3 状态隔离
*   使用 `conversation_type` (ROLE | AGENT) 区分。如果是 Agent 模式，前端渲染器启用增强模式。

---

## 5. 最终推荐理由 (Conclusion)

**选择“方案二：功能合并集成”**。

1.  **开发成本 (Cost)**: 虽然初期需要重构 Message 组件，但长期看避免了维护两套相似页面的高昂成本。
2.  **用户体验 (UX)**: 统一的界面让产品概念更简单。Agent 只是“更聪明”的角色，而不是一个全新的物种。
3.  **系统稳定性 (Stability)**: 复用经过验证的 SSE 连接管理和重试机制 (`ChatService` + `ChatPage`)，风险更低。
