# 向量数据库接入详细设计文档

## 1. 架构概览

向量数据库接入层 (`RagService`) 基于 LanceDB 实现本地/云端向量存储与检索。支持文档的非结构化数据处理、Embedding 生成、向量索引构建及语义检索。

## 2. 数据流向

### 写入流程 (Ingestion)
1. **上传**: 用户上传文件 (PDF/TXT/MD)
2. **解析**: `RagService` 调用解析器提取纯文本
3. **分块 (Chunking)**:
   - 策略: Sliding Window (Size: 500, Overlap: 50)
   - 优化: 按段落/句子边界切分 (TODO)
4. **向量化 (Embedding)**: 调用 `LlmService.getEmbedding` (Batch Size: 10)
5. **存储**:
   - SQLite: 存储 `Document` (Meta) 和 `Chunk` (Raw Text)
   - LanceDB: 存储 `Vector`, `ChunkID`, `DocID`

### 读取流程 (Retrieval)
1. **查询**: 用户输入 Query
2. **向量化**: 生成 Query Vector
3. **检索**: LanceDB ANN Search (Top K)
4. **重排 (Rerank)** (可选): 使用 Cross-Encoder 对 Top K 结果精排
5. **返回**: 返回文本片段列表

## 3. 索引结构

**Table: chunks**
| Column | Type | Description |
| :--- | :--- | :--- |
| id | String | Chunk UUID |
| vector | Float32Array[1536] | Embedding 向量 |
| content | String | 文本内容 |
| documentId | String | 关联文档 ID |
| knowledgeBaseId | String | 知识库隔离 ID |

## 4. 性能指标 (SLA)

- **Embedding 生成**: < 500ms (取决于模型服务)
- **向量检索 (100k 数据)**: < 100ms
- **端到端 RAG 延迟**: < 1.5s (不含 LLM 生成)

## 5. 异常处理

- **Embedding 失败**: 标记 Document 状态为 `failed`，记录错误日志。
- **检索为空**: 返回空数组，LLM 应回退到通用知识回答。
