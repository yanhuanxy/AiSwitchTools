# Agent 与 Role 聚合设计蓝图 (Aggregate Blueprint)

**版本**: 1.0  
**日期**: 2026-02-12  
**状态**: 设计中  
**作者**: Full Stack Engineer  

---

## 1. 核心定义 (Core Definitions)

*   **Role (角色)**: 基础对话实体，具备人设 (Persona) 和记忆 (Memory)，通过 Prompt Engineering 实现。
*   **Agent (智能体)**: 增强型对话实体，是 **Role + Capabilities**。Capabilities 包括工作流 (Workflow)、知识库 (Knowledge Base) 和工具 (Tools)。
*   **Aggregation Strategy (聚合策略)**: 将 Role 视为 Agent 的子集。
    *   **Role Mode**: `capabilities = []`
    *   **Agent Mode**: `capabilities = [Workflow, RAG, ...]`

## 2. 运行时架构 (Runtime Architecture)

### 2.1 聚合层 (Aggregate Layer)
位于 `ChatService` 与底层引擎之间，负责统一调度。

```mermaid
graph TD
    User[用户输入] --> API[Chat API]
    API --> Aggregator[Aggregate Layer]
    
    subgraph Aggregate_Layer
        Router[三层路由 (Command -> Intent -> Chat)]
        Context[统一上下文 (Redis + Memory)]
        Fallback[异常降级熔断]
    end
    
    Aggregator --> Agent_Engine[Agent Engine]
    
    subgraph Agent_Engine
        Planner[规划器]
        Memory_Mgr[记忆管理器]
        Skill_Dispatcher[技能分发器]
    end
    
    Skill_Dispatcher --> WF[工作流引擎]
    Skill_Dispatcher --> LLM[LLM 服务]
    Skill_Dispatcher --> RAG[RAG 服务]
```

### 2.2 关键模块设计

#### 2.2.1 统一指令路由 (Unified Router)
*   **输入**: `Message`
*   **逻辑**:
    1.  **Command Match**: 检查是否为 `/reset` 等系统指令。
    2.  **Intent Classification**: 使用 Embeddings 判断是否命中特定 Workflow。
    3.  **Standard Chat**: 若无命中，进入 LLM 自由对话。
*   **热插拔**: 路由规则存储在 Redis/Memory Cache，支持动态更新。

#### 2.2.2 统一会话上下文 (Unified Context)
*   **存储**:
    *   **L1 (Local)**: Node.js LRU Cache (用于极速访问当前活跃会话状态)。
    *   **L2 (Remote)**: Redis (持久化会话状态，支持多实例共享)。
*   **结构**:
    ```typescript
    interface SessionState {
      conversationId: string;
      mode: 'ROLE' | 'AGENT';
      currentWorkflowId?: string; // 若正在执行工作流
      status: 'IDLE' | 'THINKING' | 'EXECUTING' | 'AWAITING_INPUT';
      contextVariables: Record<string, any>; // 槽位/变量
    }
    ```

#### 2.2.3 异常降级 (Fallback)
*   **策略**:
    *   **Agent Failure**: 当 Workflow 执行失败或 LLM 无响应 -> 降级为 **Simple Role Chat** (仅回复: "我遇到了一些问题，但这是我的想法...")。
    *   **System Failure**: 熔断保护 -> 返回预设兜底回复。

## 3. 接口协议 (API Protocol)

### 3.1 统一任务接口
保持 `POST /api/chat/tasks` 不变，但在内部通过 `conversationId` 识别模式。

### 3.2 增强 SSE 协议
扩展 SSE 事件类型，支持 Agent 的思维链展示。

*   `event: meta` -> 任务元数据
*   `event: thought` -> **新增**: "正在思考用户意图..."
*   `event: tool_use` -> **新增**: "调用工作流: 请假流程"
*   `event: tool_result` -> **新增**: "工作流返回: 成功"
*   `event: delta` -> 标准文本流
*   `event: done` -> 结束

## 4. 安全与合规 (Security & Compliance)

*   **RBAC/ABAC**: 统一权限校验。Agent 的工具调用权限需显式授权。
*   **Privacy**: 所有敏感字段 (PII) 在进入 Log 和 Long-term Memory 前必须脱敏 (Masking)。

---

## 5. 灰度与回滚 (Canary & Rollback)

*   **Feature Flag**: `ENABLE_AGENT_MODE` (Global / User / Bot 级别)。
*   **策略**:
    *   V1: 仅内部白名单用户启用 Agent 路由。
    *   V2: 对 10% 流量开启。
    *   V3: 全量开启。
