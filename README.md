# AiSwitchTools Client

## 设计规范 (Design Specifications)

本项目遵循 Coze 智能体平台轻量化、高还原度设计规范。

### 1. 颜色体系 (Color System)

| Token | Hex Value | Usage |
|-------|-----------|-------|
| `primary` | `#0066FF` | 主品牌色，用于按钮、高亮、链接 |
| `primary-hover` | `#005CE6` | 主色悬停态 (Darken 8%) |
| `primary-active` | `#0052CC` | 主色点击态 (Darken 12%) |
| `primary-light` | `#F0F6FF` | 辅色/背景色，用于二级按钮、选中态 |
| `danger` | `#FF4D4F` | 错误、删除、警示 |
| `gray-text` | `#1D2129` | 主要文本颜色 |
| `gray-border` | `#E5E6EB` | 边框、分割线 |
| `bg-gray-50` | `#F7F7F7` | 页面背景色 |

### 2. 字体排印 (Typography)

- **Font Family**: "Source Han Sans" (思源黑体), "Noto Sans SC", sans-serif
- **Base Size**: 14px
- **Line Height**: 20px (1.5)
- **Weights**: 400 (Regular), 500 (Medium), 700 (Bold)

### 3. 间距与圆角 (Spacing & Radius)

- **Grid**: 12 Columns, 24px Gutter
- **Radius**: `8px` (Standard Component Radius)
- **Spacing Scale**: 0, 4, 8, 16, 32px
- **Max Width**: 1440px (Centered)

### 4. 组件规范 (Component Specs)

#### Buttons
- Height: 32px (sm), 40px (md - default), 48px (lg), 56px (xl)
- Radius: 8px
- Styles: Primary (Filled), Secondary (Light Background), Text

#### Inputs
- Height: 40px
- Border: 1px solid #E5E6EB
- Focus: 2px solid #0066FF
- Error: 2px solid #FF4D4F

#### Cards
- Bg: White
- Border: 1px solid #E5E6EB
- Hover Shadow: `0 4px 12px 0 rgba(0, 0, 0, 0.08)`

### 5. 构建与性能 (Build & Performance)

- **Framework**: Vue 3 + Vite + TypeScript
- **Styling**: Tailwind CSS 3.4
- **Compression**: Gzip + Brotli
- **Chunks**: Split into `vue-vendor`, `element-plus`, `editor`

## 故障排查 (Troubleshooting)

### 数据库与 Prisma 连接问题

若遇到 `Database connection failed` 或 `PrismaService or Document model not initialized` 错误，请尝试以下步骤：

1.  **检查数据库状态**: 确保 SQLite 文件 (`dev.db`) 存在且有读写权限。
2.  **重生成 Prisma Client**:
    ```bash
    cd service
    npx prisma generate
    ```
    此命令会根据 `schema.prisma` 重新生成类型定义和客户端代码，修复因 Schema 变更导致的模型缺失。
3.  **同步数据库结构**:
    ```bash
    npx prisma migrate deploy
    ```
4.  **验证连接**: 检查服务启动日志，确认 `PrismaService` 初始化成功。

### 向量库 (LanceDB)

*   **数据目录**: 向量数据存储在 `service/data/lancedb`。
*   **权限**: 确保 Node.js 进程对该目录有写入权限。

### PDF 支持 (PDF Support)

*   **依赖库**: 本项目使用 `pdf-parse` (v2.x) 进行 PDF 文本提取。
*   **兼容性**: 
    *   `pdf-parse` v2 API 与 v1 不同，需使用 `new PDFParse(buffer).getText()` 方式调用。
    *   在 Node.js 环境下，该库依赖 `pdfjs-dist`，可能会遇到 `experimental-vm-modules` 警告，这是已知现象，不影响基本功能。
*   **限制**: 
    *   目前仅支持提取文本内容，不支持 OCR (扫描版 PDF 无法提取)。
    *   对于加密或损坏的 PDF，可能会抛出异常，系统已做捕获处理 (返回 400 Bad Request)。

## 大模型管理 (LLM Management)

### 模型配置来源
系统通过以下优先级加载可用模型：
1.  **数据库 (ai_model 表)**: 优先读取 `ai_model` 表中 `enabled=true` 且 `deprecated=false` 的记录。
2.  **环境变量**: 若数据库中无匹配记录，读取 `AVAILABLE_MODELS` 环境变量。
    *   格式: `provider:modelName,provider2:modelName2`
    *   示例: `openai:gpt-4-turbo,anthropic:claude-3-opus-20240229`
3.  **默认回退**: 若以上均无配置，系统会根据已配置的 API Key 自动添加默认模型 (GPT-3.5/4, Claude 3 Opus)。

### 缓存机制
*   **TTL**: 300 秒 (5 分钟)。
*   **刷新**: 可通过 API `GET /llm/models/reload` 手动刷新缓存。

### 数据库表结构 (ai_model)
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| provider | String | 模型提供商 (openai, anthropic) |
| modelId | String | 模型唯一标识 (gpt-4, claude-3-sonnet) |
| name | String | 显示名称 |
| enabled | Boolean | 是否启用 |
| deprecated | Boolean | 是否废弃 |

