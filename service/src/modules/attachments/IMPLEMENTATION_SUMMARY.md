# Attachments 模块实现总结

## 1. 实现范围

### 1.1 已实现的API端点
- ✅ `GET /api/attachments/:id` - 获取附件信息
- ✅ `GET /api/attachments` - 获取附件列表（分页）
- ✅ `DELETE /api/attachments/:id` - 删除附件
- ✅ `POST /api/attachments/generate-upload-url` - 生成上传URL（直传对象存储）
- ✅ `GET /api/attachments/stats/scan` - 获取扫描统计
- ✅ `GET /api/attachments/:id/validate` - 验证附件所有权（内部接口）
- ✅ `POST /api/attachments/validate-batch` - 批量验证附件所有权（内部接口）
- ✅ `POST /api/attachments/filter-for-model` - 过滤可用于模型的附件（内部接口）
- ✅ `GET /api/attachments/config/storage` - 获取存储配置（内部接口）

### 1.2 核心业务逻辑
- ✅ 附件存储管理（本地存储 + 对象存储预留）
- ✅ 扫描状态管理（pending → passed/rejected/failed）
- ✅ viewUrl生成（仅passed状态返回真实URL）
- ✅ 权限验证（基于ownerUserId的数据隔离）
- ✅ 分页查询和批量操作
- ✅ 存储配额管理
- ✅ 文件元信息提取（宽度、高度）

## 2. 代码结构

```
src/modules/attachments/
├── attachments.module.ts          # 模块定义
├── attachments.controller.ts      # 控制器层
├── attachments.service.ts         # 服务层
├── attachments.repository.ts      # 数据访问层
├── attachments.provider.ts        # 存储提供商抽象
├── dto/                          # 数据传输对象
│   ├── attachment-response.dto.ts
│   └── index.ts
├── entities/                     # 实体定义
│   ├── attachment.entity.ts
│   └── index.ts
├── attachments.service.spec.ts   # 服务单元测试
├── TESTING.md                    # 测试文档
└── IMPLEMENTATION_SUMMARY.md     # 本文档
```

## 3. 数据模型

### 3.1 Attachment表结构
```sql
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,                    -- ULID格式
  ownerUserId TEXT NOT NULL,              -- 用户ID
  type TEXT NOT NULL,                     -- 类型（image）
  storageKey TEXT NOT NULL,               -- 存储路径
  mime TEXT NOT NULL,                     -- MIME类型
  size INTEGER NOT NULL,                  -- 文件大小（字节）
  width INTEGER,                           -- 图片宽度
  height INTEGER,                          -- 图片高度
  scanStatus TEXT NOT NULL,               -- 扫描状态
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (ownerUserId) REFERENCES users(id)
);

-- 索引
CREATE INDEX idx_attachments_owner_created ON attachments(ownerUserId, createdAt);
```

### 3.2 MessageAttachment关联表
```sql
CREATE TABLE message_attachments (
  messageId TEXT NOT NULL,
  attachmentId TEXT NOT NULL,
  PRIMARY KEY (messageId, attachmentId),
  FOREIGN KEY (messageId) REFERENCES messages(id),
  FOREIGN KEY (attachmentId) REFERENCES attachments(id)
);
```

## 4. 关键实现细节

### 4.1 存储提供商抽象
```typescript
// 支持多种存储方式：local、s3、minio
interface StorageConfig {
  provider: 'local' | 's3' | 'minio';
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
  signedUrlExpiry: number;
}
```

### 4.2 扫描状态管理
```typescript
// 扫描状态流转：单向流转
enum AttachmentScanStatus {
  pending = 'pending',    // 待扫描
  passed = 'passed',      // 扫描通过
  rejected = 'rejected',  // 扫描拒绝
  failed = 'failed',      // 扫描失败
}
```

### 4.3 viewUrl生成策略
```typescript
async generateViewUrl(storageKey: string, scanStatus: string): Promise<string | null> {
  if (scanStatus !== 'passed') {
    return null; // 仅passed状态返回真实URL
  }

  if (this.storageConfig.provider === 'local') {
    return `/${storageKey.replace(/\\/g, '/')}`; // 本地存储返回相对路径
  }

  // S3/MinIO模式返回预签名URL
  return this.generatePresignedUrl(storageKey);
}
```

### 4.4 权限验证
所有数据库查询都包含`ownerUserId`条件，确保数据隔离：
```typescript
where: {
  id: attachmentId,
  ownerUserId,  // 确保只能访问自己的数据
}
```

## 5. 存储路径规范

### 5.1 本地存储
```
data/
└── uploads/
    └── {userId}/
        └── {attachmentId}.{extension}
```

### 5.2 对象存储
```
{bucket}/
└── uploads/
    └── {userId}/
        └── {attachmentId}.{extension}
```

## 6. 核心功能实现

### 6.1 文件上传流程
1. 客户端请求生成上传URL
2. 服务端验证文件类型和大小
3. 检查用户上传配额
4. 创建附件记录（状态为pending）
5. 返回上传URL和attachmentId
6. 客户端直传到存储（本地或对象存储）
7. 扫描服务异步处理扫描

### 6.2 扫描服务集成
```typescript
// 获取待扫描附件
async getPendingAttachments(): Promise<AttachmentEntity[]> {
  return this.attachmentsRepository.findPendingForScan();
}

// 更新扫描结果
async updateScanResult(id: string, scanStatus: 'passed' | 'rejected' | 'failed'): Promise<AttachmentEntity> {
  // 获取文件元信息（仅passed状态）
  const metadata = scanStatus === 'passed'
    ? await this.attachmentsProvider.getFileMetadata(storageKey)
    : {};

  return this.attachmentsRepository.updateScanStatus(id, scanStatus, metadata);
}
```

### 6.3 消息发送时的附件过滤
```typescript
async filterAttachmentsForModel(attachmentIds: string[], ownerUserId: string): Promise<string[]> {
  const attachments = await this.attachmentsRepository.findByIdsAndOwner(attachmentIds, ownerUserId);
  return attachments
    .filter((attachment) => attachment.scanStatus === 'passed')
    .map((attachment) => attachment.id);
}
```

## 7. 安全机制

### 7.1 文件类型验证
- 支持的MIME类型：image/jpeg, image/png, image/webp
- 文件扩展名验证和映射
- 文件大小限制：10MB

### 7.2 用户配额管理
- 默认配额：1000个附件/用户
- 上传前检查配额
- 可配置的最大上传数量

### 7.3 权限控制
- 基于ownerUserId的数据隔离
- 批量验证附件所有权
- 删除时检查引用关系

### 7.4 路径安全
- 防止目录遍历攻击
- 标准化的存储路径结构
- 文件名安全处理

## 8. 性能优化

### 8.1 分页查询
- 基于游标的分页
- 默认20条，最大100条
- 按创建时间倒序排列

### 8.2 批量操作
- 批量验证所有权
- 批量获取附件信息
- 批量扫描处理

### 8.3 存储优化
- 本地存储模式直接文件访问
- 对象存储模式使用预签名URL
- 元信息缓存机制

## 9. API接口契约

### 9.1 获取附件信息
**请求:**
```
GET /api/attachments/:id?includeMetadata=true
```

**响应:**
```json
{
  "attachmentId": "att_xxx",
  "scanStatus": "passed",
  "viewUrl": "https://cdn.example.com/signed-url",
  "mime": "image/jpeg",
  "size": 1024000,
  "width": 1920,
  "height": 1080,
  "createdAt": "2026-01-28T10:00:00Z",
  "traceId": "tr_xxx"
}
```

### 9.2 生成上传URL
**请求:**
```json
POST /api/attachments/generate-upload-url
{
  "filename": "test.jpg",
  "mimeType": "image/jpeg",
  "size": 1024000
}
```

**响应:**
```json
{
  "attachmentId": "att_new_xxx",
  "uploadUrl": "https://s3.example.com/presigned-url",
  "storageKey": "uploads/user_123/att_new_xxx.jpg",
  "expiresAt": "2026-01-28T11:00:00Z",
  "traceId": "tr_xxx"
}
```

## 10. 错误处理

### 10.1 错误码定义
- `404 NOT_FOUND` - 附件不存在
- `403 FORBIDDEN` - 无权限访问
- `409 CONFLICT` - 资源冲突（被引用、配额超限、不支持文件类型）
- `400 INVALID_PARAMS` - 参数错误
- `401 AUTH_REQUIRED` - 认证失败

### 10.2 错误响应格式
```json
{
  "code": "NOT_FOUND",
  "message": "Attachment att_xxx not found",
  "traceId": "tr_xxx"
}
```

## 11. 测试覆盖

### 11.1 单元测试
- ✅ AttachmentsService核心逻辑测试
- ✅ 权限验证测试
- ✅ 错误处理测试
- ✅ 边界条件测试

### 11.2 集成测试
- 文件上传和下载流程
- 扫描状态流转
- 权限控制验证
- 存储提供商切换

### 11.3 手动测试
详见`TESTING.md`文档，包含：
- 各种存储模式的测试
- 安全性和性能测试
- 边界条件测试

## 12. 部署和配置

### 12.1 环境变量
```bash
# 存储配置
STORAGE_PROVIDER=local                    # local, s3, minio
STORAGE_BUCKET=ai-app-uploads-dev         # S3/MinIO桶名
STORAGE_REGION=us-east-1                  # S3区域
STORAGE_ENDPOINT=http://localhost:9000    # MinIO端点
STORAGE_ACCESS_KEY=your-access-key        # 访问密钥
STORAGE_SECRET_KEY=your-secret-key        # 秘密密钥
SIGNED_URL_EXPIRY=3600                    # 签名URL有效期（秒）

# 配额配置
MAX_UPLOADS_PER_USER=1000                 # 用户最大上传数量

# 扫描配置
SCAN_RETRY_INTERVAL=3600                  # 扫描重试间隔（秒）
SCAN_MAX_RETRIES=3                        # 最大重试次数
FAILED_ATTACHMENT_CLEANUP_HOURS=24        # 失败附件清理时间（小时）
```

### 12.2 静态文件服务（本地存储）
```typescript
// 需要配置静态文件服务
app.use('/uploads', express.static(path.join(process.cwd(), 'data', 'uploads')));
```

### 12.3 扫描服务部署
- 可以作为独立服务部署
- 支持队列模式处理
- 可配置扫描引擎（NSFW JS、ClamAV、云服务）

## 13. 已知限制和TODO

### 13.1 当前限制
- ⚠️ 仅实现了本地存储模式，S3/MinIO需要额外实现
- ⚠️ 扫描服务尚未集成实际的扫描引擎
- ⚠️ 认证系统使用临时AuthGuard
- ⚠️ 未实现图片压缩和缩略图功能

### 13.2 后续计划

#### 高优先级
1. 实现S3/MinIO存储提供商
2. 集成NSFW JS扫描引擎
3. 配置静态文件服务

#### 中优先级
1. 添加图片压缩和缩略图功能
2. 实现上传进度监控
3. 添加存储配额管理界面

#### 低优先级
1. 支持更多文件类型
2. 实现CDN集成
3. 添加图片水印功能

## 14. 监控和观测

### 14.1 关键指标
- 附件上传成功率
- 扫描通过率/拒绝率
- 存储使用量统计
- 扫描服务响应时间

### 14.2 告警规则
- 扫描失败率 > 10%
- 存储使用量 > 80%
- 上传响应时间 > 5秒

### 14.3 日志字段
- traceId - 请求跟踪ID
- userId - 用户ID
- attachmentId - 附件ID
- scanStatus - 扫描状态
- storageKey - 存储路径

## 15. 安全考虑

### 15.1 数据安全
- 文件内容扫描防止恶意文件
- 存储路径隔离防止越权访问
- 签名URL防止未授权访问

### 15.2 隐私保护
- 图片EXIF信息可选择性清理
- 用户数据隔离存储
- 访问日志脱敏处理

### 15.3 合规性
- 内容审核符合法规要求
- 数据存储符合地域要求
- 用户授权和撤销机制

---

**实现状态**: ✅ 基础功能完成，存储提供商和扫描引擎待完善
**最后更新**: 2026-01-28
**维护人员**: Personal Backend Engineer