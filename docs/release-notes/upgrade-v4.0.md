# 系统升级说明文档 V4.0 (System Upgrade Notes)

**版本**: 4.0.0  
**发布日期**: 2026-02-12  
**重要性**: **CRITICAL** (架构级重构)

---

## 1. 版本概述 (Overview)

V4.0 版本标志着平台从单纯的 **角色扮演 (Role-Play)** 向 **智能体平台 (Agent Platform)** 的彻底转型。
本版本引入了 **聚合层 (Aggregate Layer)**，统一了 Role 与 Agent 的运行时架构，实现了“角色即智能体”的愿景。

### 核心变更
*   **架构融合**: 移除独立的 Role Chat 逻辑，统一接入 Agent Runtime。
*   **智能路由**: 引入三层路由机制 (Command -> Intent -> Chat)，支持动态触发工作流。
*   **流式增强**: SSE 协议升级，支持输出“思维链 (Thought Chain)”与“工具调用状态”。

---

## 2. 架构变更 (Architecture Changes)

### Before (V3.x)
*   `ChatService` 直接判断 `workflowId` 硬绑定。
*   逻辑割裂：要么是纯聊天，要么是纯工作流执行。
*   无中间状态：用户只能看到最终结果。

### After (V4.0)
*   `ChatService` 调用 `AggregateService`。
*   `AggregateService` 维护统一上下文 (`SessionState`)。
*   **Router** 动态判断意图：
    *   命中工作流 -> 执行 Workflow (并推送 `tool_use` 事件)。
    *   未命中 -> 执行 Standard Chat。
*   **Fallback**: 异常自动降级。

---

## 3. 接口变更清单 (API Changes)

### 3.1 `POST /api/chat/tasks` (无破坏性变更)
*   **Request**: 保持不变。
*   **Response**: 保持不变。

### 3.2 SSE Events (协议升级)
客户端需适配新的事件类型：

| 事件名 | 含义 | Payload 示例 |
| :--- | :--- | :--- |
| `thought` | 思考过程 | `{ text: "正在分析用户意图..." }` |
| `tool_use` | 工具调用 | `{ tool: "workflow", name: "请假流程" }` |
| `tool_result` | 工具结果 | `{ status: "success", output: "..." }` |
| `delta` | 文本流 | `{ text: "你好" }` | (保持兼容)

---

## 4. 灰度与回滚策略 (Rollout & Rollback)

### 4.1 灰度策略
通过配置中心 (ConfigService) 控制 `FEATURE_AGENT_AGGREGATION` 开关。

1.  **Stage 1 (Internal)**: `whitelist_users = [admin_ids]`。
2.  **Stage 2 (Canary)**: `percentage = 10%`。
3.  **Stage 3 (GA)**: `percentage = 100%`。

### 4.2 回滚方案
若 P99 延迟超过阈值或错误率 > 1%：
1.  **即时止血**: 将 `FEATURE_AGENT_AGGREGATION` 设为 `false`。
2.  **降级逻辑**: 系统自动回退到 V3.x 的硬绑定逻辑 (Legacy Path)。

---

## 5. 运维手册 (Ops Manual)

### 监控指标
*   `agent_router_latency`: 路由决策耗时 (Target < 50ms)。
*   `workflow_trigger_rate`: 工作流触发率。
*   `fallback_count`: 降级触发次数。

### 常见问题 (FAQ)
*   **Q: 为什么 Agent 回复变慢了？**
    *   A: Agent 模式下增加了意图识别环节。请检查 `LanceDB` 检索延迟。
*   **Q: 旧的角色还能用吗？**
    *   A: 完全兼容。旧角色被视为 `capabilities=[]` 的 Agent。

---
