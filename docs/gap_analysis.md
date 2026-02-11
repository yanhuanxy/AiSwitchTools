# 缺失功能清单 (Gap Analysis)

| 模块 | 功能点 | 当前状态 | 优先级 | 缺失/待优化描述 |
| :--- | :--- | :--- | :--- | :--- |
| **LLM** | 输入预处理 | ⚠️ 部分完成 | P1 | `ChatService` 有简单的 prompt 构建，但缺乏统一的 Token 计算和截断逻辑。 |
| **LLM** | 模型调用 | ✅ 完成 | - | 支持 OpenAI/Anthropic，但在 `LlmService` 中硬编码了 fallback 逻辑。 |
| **LLM** | 输出后处理 | ❌ 缺失 | P1 | 缺乏结构化输出解析 (JSON fix)、敏感词过滤 (Safety 模块有但未集成到流式输出)。 |
| **LLM** | 超时重试 | ✅ 完成 | - | 已在 `WorkflowEngineService` 中实现指数退避重试 (3次)。 |
| **LLM** | 降级策略 | ⚠️ 部分完成 | P1 | 有简单的 Provider 切换，但无运行时自动降级（如 OpenAI 500 -> Anthropic）。 |
| **RAG** | 文档向量化 | ⚠️ 部分完成 | P0 | 仅支持纯文本 (`Buffer.toString`)，不支持 PDF/Word/Markdown 解析。 |
| **RAG** | 索引更新 | ✅ 完成 | - | 插入时实时更新 LanceDB。 |
| **RAG** | 相似度检索 | ✅ 完成 | - | 支持 TopK 检索，已增强为返回 Score + Metadata。 |
| **RAG** | 结果排序 | ❌ 缺失 | P2 | 无 Rerank (重排序) 步骤，完全依赖向量相似度。 |
| **RAG** | 缓存机制 | ❌ 缺失 | P1 | 无查询缓存 (Redis/Memory)，高频查询会重复消耗 Embedding Quota。 |
| **DB** | Schema | ⚠️ 部分完成 | P0 | 表结构存在但可能未同步到数据库，缺乏索引优化。 |
| **DB** | 基础数据 | ❌ 缺失 | P0 | 无默认角色、无系统配置、无测试用户/KB/Workflow。 |
| **Workflow**| 编排引擎 | ✅ 完成 | - | `WorkflowEngineService` 已实现 DAG 执行，支持语义分析、RAG、LLM 节点。 |
| **Workflow**| 异常处理 | ⚠️ 部分完成 | P1 | 已实现节点级重试，但缺乏 "OnError" 分支配置。 |
