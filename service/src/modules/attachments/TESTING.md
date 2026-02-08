# Attachments 模块测试文档

## 1. 测试环境准备

### 1.1 数据库准备
```bash
# 确保数据库已初始化
npm run prisma:generate
npm run prisma:migrate
```

### 1.2 依赖安装
```bash
npm install
# 如果需要图片处理功能
npm install sharp
```

### 1.3 存储配置
```bash
# 本地存储模式（默认）
STORAGE_PROVIDER=local

# 对象存储模式（可选）
STORAGE_PROVIDER=s3
STORAGE_BUCKET=ai-app-uploads-dev
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=your-access-key
STORAGE_SECRET_KEY=your-secret-key
SIGNED_URL_EXPIRY=3600
```

## 2. 手动测试用例

### 2.1 获取附件信息

#### 2.1.1 获取已通过的附件
```bash
# 获取已通过扫描的附件
curl -X GET "http://localhost:3000/api/attachments/att_xxx" \
  -H "x-user-id: user_123" \
  -H "x-trace-id: tr_test_001"

# 期望响应
{
  "attachmentId": "att_xxx",
  "scanStatus": "passed",
  "viewUrl": "https://cdn.example.com/signed-url",
  "traceId": "tr_test_001"
}
```

#### 2.1.2 获取待扫描的附件
```bash
# 获取待扫描的附件
curl -X GET "http://localhost:3000/api/attachments/att_yyy" \
  -H "x-user-id: user_123"

# 期望响应
{
  "attachmentId": "att_yyy",
  "scanStatus": "pending",
  "viewUrl": null,
  "traceId": "tr_xxx"
}
```

#### 2.1.3 获取包含元数据的附件
```bash
# 获取包含元数据的附件信息
curl -X GET "http://localhost:3000/api/attachments/att_xxx?includeMetadata=true" \
  -H "x-user-id: user_123"

# 期望响应
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

#### 2.1.4 访问不存在的附件
```bash
# 访问不存在的附件
curl -X GET "http://localhost:3000/api/attachments/att_not_exist" \
  -H "x-user-id: user_123"

# 期望响应 - 404 Not Found
{
  "code": "NOT_FOUND",
  "message": "Attachment att_not_exist not found",
  "traceId": "tr_xxx"
}
```

#### 2.1.5 访问其他用户的附件
```bash
# 使用用户A的ID访问用户B的附件
curl -X GET "http://localhost:3000/api/attachments/user_b_attachment" \
  -H "x-user-id: user_a"

# 期望响应 - 404 Not Found（隐藏资源存在性）
{
  "code": "NOT_FOUND",
  "message": "Attachment user_b_attachment not found",
  "traceId": "tr_xxx"
}
```

### 2.2 获取附件列表

#### 2.2.1 获取默认附件列表
```bash
# 获取默认附件列表（20条）
curl -X GET "http://localhost:3000/api/attachments" \
  -H "x-user-id: user_123" \
  -H "x-trace-id: tr_test_002"

# 期望响应
{
  "items": [
    {
      "attachmentId": "att_xxx",
      "scanStatus": "passed",
      "viewUrl": "https://cdn.example.com/signed-url",
      "mime": "image/jpeg",
      "size": 1024000,
      "width": 1920,
      "height": 1080,
      "createdAt": "2026-01-28T10:00:00Z"
    }
  ],
  "nextCursor": "att_xxx",
  "traceId": "tr_test_002"
}
```

#### 2.2.2 分页查询
```bash
# 使用游标分页
curl -X GET "http://localhost:3000/api/attachments?cursor=att_xxx&limit=10" \
  -H "x-user-id: user_123"

# 期望响应包含下一页游标
{
  "items": [...],
  "nextCursor": "att_yyy",
  "traceId": "tr_xxx"
}
```

#### 2.2.3 限制最大数量
```bash
# 请求超过最大限制的数量
curl -X GET "http://localhost:3000/api/attachments?limit=200" \
  -H "x-user-id: user_123"

# 期望：limit被限制为100
```

#### 2.2.4 空列表测试
```bash
# 新用户获取附件列表
curl -X GET "http://localhost:3000/api/attachments" \
  -H "x-user-id: new_user_123"

# 期望响应
{
  "items": [],
  "nextCursor": null,
  "traceId": "tr_xxx"
}
```

### 2.3 删除附件

#### 2.3.1 成功删除附件
```bash
# 删除未被引用的附件
curl -X DELETE "http://localhost:3000/api/attachments/att_xxx" \
  -H "x-user-id: user_123" \
  -H "x-trace-id: tr_test_003"

# 期望响应 - 204 No Content
```

#### 2.3.2 删除被引用的附件
```bash
# 删除被消息引用的附件
curl -X DELETE "http://localhost:3000/api/attachments/att_referenced" \
  -H "x-user-id: user_123"

# 期望响应 - 409 Conflict
{
  "code": "CONFLICT",
  "message": "Attachment att_referenced is referenced by messages and cannot be deleted",
  "traceId": "tr_xxx"
}
```

#### 2.3.3 删除其他用户的附件
```bash
# 尝试删除其他用户的附件
curl -X DELETE "http://localhost:3000/api/attachments/other_user_attachment" \
  -H "x-user-id: user_a"

# 期望响应 - 404 Not Found
{
  "code": "NOT_FOUND",
  "message": "Attachment other_user_attachment not found",
  "traceId": "tr_xxx"
}
```

### 2.4 生成上传URL（直传对象存储）

#### 2.4.1 成功生成上传URL
```bash
# 生成直传URL
curl -X POST "http://localhost:3000/api/attachments/generate-upload-url" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -H "x-trace-id: tr_test_004" \
  -d '{
    "filename": "test.jpg",
    "mimeType": "image/jpeg",
    "size": 1024000
  }'

# 期望响应
{
  "attachmentId": "att_new_xxx",
  "uploadUrl": "https://s3.example.com/presigned-url",
  "storageKey": "uploads/user_123/att_new_xxx.jpg",
  "expiresAt": "2026-01-28T11:00:00Z",
  "traceId": "tr_test_004"
}
```

#### 2.4.2 文件类型不支持
```bash
# 请求不支持的文件类型
curl -X POST "http://localhost:3000/api/attachments/generate-upload-url" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -d '{
    "filename": "test.txt",
    "mimeType": "text/plain",
    "size": 1024
  }'

# 期望响应 - 409 Conflict
{
  "code": "CONFLICT",
  "message": "Unsupported file type: text/plain",
  "traceId": "tr_xxx"
}
```

#### 2.4.3 文件大小超过限制
```bash
# 请求超过大小限制的文件
curl -X POST "http://localhost:3000/api/attachments/generate-upload-url" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -d '{
    "filename": "large.jpg",
    "mimeType": "image/jpeg",
    "size": 20971520
  }'

# 期望响应 - 409 Conflict
{
  "code": "CONFLICT",
  "message": "File size exceeds limit: 20971520 > 10485760",
  "traceId": "tr_xxx"
}
```

### 2.5 扫描统计

#### 2.5.1 获取扫描统计
```bash
# 获取全局扫描统计
curl -X GET "http://localhost:3000/api/attachments/stats/scan" \
  -H "x-trace-id: tr_test_005"

# 期望响应
{
  "pending": 5,
  "passed": 100,
  "rejected": 2,
  "failed": 1,
  "traceId": "tr_test_005"
}
```

### 2.6 内部接口测试

#### 2.6.1 验证附件所有权
```bash
# 验证附件所有权
curl -X GET "http://localhost:3000/api/attachments/att_xxx/validate" \
  -H "x-user-id: user_123"

# 期望响应
{
  "valid": true,
  "traceId": "tr_xxx"
}
```

#### 2.6.2 批量验证附件所有权
```bash
# 批量验证附件所有权
curl -X POST "http://localhost:3000/api/attachments/validate-batch" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -d '{
    "attachmentIds": ["att_1", "att_2", "att_3"]
  }'

# 期望响应
{
  "valid": true,
  "traceId": "tr_xxx"
}
```

#### 2.6.3 过滤可用于模型的附件
```bash
# 过滤可用于模型理解的附件
curl -X POST "http://localhost:3000/api/attachments/filter-for-model" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -d '{
    "attachmentIds": ["att_1", "att_2", "att_3"]
  }'

# 期望响应（只返回passed状态的附件）
{
  "attachmentIds": ["att_1", "att_3"],
  "traceId": "tr_xxx"
}
```

#### 2.6.4 获取存储配置
```bash
# 获取存储配置
curl -X GET "http://localhost:3000/api/attachments/config/storage"

# 期望响应
{
  "provider": "local",
  "signedUrlExpiry": 3600,
  "traceId": "tr_xxx"
}
```

## 3. 扫描服务测试

### 3.1 获取待扫描附件
```bash
# 启动扫描服务，获取待扫描的附件
# 这个通常是内部服务调用，不是API接口
```

### 3.2 更新扫描结果
```bash
# 更新扫描结果（内部接口）
# 通常是扫描服务调用attachmentsService.updateScanResult()
```

## 4. 边界条件测试

### 4.1 分页边界
```bash
# 负数limit
curl -X GET "http://localhost:3000/api/attachments?limit=-10" \
  -H "x-user-id: user_123"

# 期望：使用默认值20

# 零limit
curl -X GET "http://localhost:3000/api/attachments?limit=0" \
  -H "x-user-id: user_123"

# 期望：使用默认值20
```

### 4.2 文件格式边界
```bash
# 测试各种支持的图片格式
curl -X POST "http://localhost:3000/api/attachments/generate-upload-url" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -d '{
    "filename": "test.webp",
    "mimeType": "image/webp",
    "size": 102400
  }'

# 应该成功
```

### 4.3 用户上传限制
```bash
# 测试用户上传数量限制
# 需要先创建大量附件达到限制，然后尝试新的上传

# 达到限制后的请求
curl -X POST "http://localhost:3000/api/attachments/generate-upload-url" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -d '{
    "filename": "test.jpg",
    "mimeType": "image/jpeg",
    "size": 1024
  }'

# 期望响应 - 409 Conflict
{
  "code": "CONFLICT",
  "message": "User user_123 has reached the maximum upload limit",
  "traceId": "tr_xxx"
}
```

## 5. 性能测试

### 5.1 大量附件列表
```bash
# 测试大量附件的分页性能
curl -X GET "http://localhost:3000/api/attachments?limit=100" \
  -H "x-user-id: user_with_many_attachments"

# 期望：响应时间 < 500ms
```

### 5.2 批量验证性能
```bash
# 测试批量验证大量附件
curl -X POST "http://localhost:3000/api/attachments/validate-batch" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -d '{
    "attachmentIds": ["att_1", "att_2", ..., "att_100"]
  }'

# 期望：响应时间 < 200ms
```

## 6. 错误处理测试

### 6.1 认证失败
```bash
# 不提供用户ID
curl -X GET "http://localhost:3000/api/attachments/att_xxx"

# 期望响应 - 401 Unauthorized
{
  "code": "AUTH_REQUIRED",
  "message": "Authentication required",
  "traceId": "tr_xxx"
}
```

### 6.2 参数验证失败
```bash
# 无效的attachmentId格式
curl -X GET "http://localhost:3000/api/attachments/invalid-id-format" \
  -H "x-user-id: user_123"

# 期望响应 - 400 Bad Request
{
  "code": "INVALID_PARAMS",
  "message": "Invalid attachment ID format",
  "traceId": "tr_xxx"
}
```

## 7. 存储模式测试

### 7.1 本地存储模式
```bash
# 设置 STORAGE_PROVIDER=local
# 验证文件存储在 data/uploads/{userId}/ 目录
# 验证viewUrl返回相对路径
```

### 7.2 S3存储模式（需要配置）
```bash
# 设置 STORAGE_PROVIDER=s3
# 配置AWS凭证和桶信息
# 验证生成预签名URL
# 验证文件上传到S3
```

## 8. 集成测试

### 8.1 完整上传流程
1. 生成上传URL
2. 使用上传URL上传文件
3. 获取附件信息（此时为pending状态）
4. 等待扫描完成（模拟或实际扫描）
5. 再次获取附件信息（此时为passed状态）
6. 验证viewUrl可访问

### 8.2 消息发送集成
1. 上传附件
2. 等待扫描通过
3. 在发送消息时引用附件
4. 验证附件被正确过滤（仅passed状态可用）

### 8.3 清理流程
1. 创建一些失败的附件
2. 调用清理接口
3. 验证超过时间的失败附件被删除

## 9. 安全测试

### 9.1 路径遍历防护
```bash
# 尝试路径遍历攻击
curl -X GET "http://localhost:3000/api/attachments/../../../etc/passwd" \
  -H "x-user-id: user_123"

# 期望：被正确拦截，返回400错误
```

### 9.2 MIME类型验证
```bash
# 上传可执行文件（伪装成图片）
curl -X POST "http://localhost:3000/api/attachments/generate-upload-url" \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_123" \
  -d '{
    "filename": "malicious.exe",
    "mimeType": "image/jpeg",
    "size": 1024
  }'

# 期望：通过后端的文件类型检查
```

## 10. 验证要点

### 10.1 功能验证
- [ ] 附件上传和存储
- [ ] 扫描状态管理
- [ ] viewUrl生成（仅passed状态）
- [ ] 权限验证（用户隔离）
- [ ] 分页查询
- [ ] 软删除（检查引用）
- [ ] 批量操作

### 10.2 安全验证
- [ ] 文件类型限制（jpg/png/webp）
- [ ] 文件大小限制（10MB）
- [ ] 用户上传数量限制
- [ ] 权限验证（只能访问自己的附件）
- [ ] 路径安全（防止目录遍历）

### 10.3 性能验证
- [ ] 分页查询性能
- [ ] 批量操作性能
- [ ] 文件上传性能
- [ ] 内存使用（大文件处理）

### 10.4 兼容性验证
- [ ] 不同图片格式支持
- [ ] 本地存储模式
- [ ] 对象存储模式（S3/MinIO）
- [ ] 跨平台兼容性

## 11. 已知问题和限制

1. **存储提供商**：当前只实现了本地存储，S3/MinIO需要额外实现
2. **扫描引擎**：扫描功能需要集成实际的扫描服务
3. **认证系统**：使用临时AuthGuard，需要集成正式JWT认证
4. **文件服务**：本地存储需要配置静态文件服务
5. **并发上传**：需要测试大量并发上传的性能

## 12. 下一步计划

### 12.1 高优先级
1. 集成扫描服务（NSFWJS/ClamAV）
2. 实现S3/MinIO存储提供商
3. 配置静态文件服务

### 12.2 中优先级
1. 优化大文件上传性能
2. 添加图片压缩和缩略图功能
3. 实现上传进度监控

### 12.3 低优先级
1. 添加图片EXIF信息处理
2. 实现CDN集成
3. 添加图片水印功能

---

**测试状态**: 📝 文档完成，等待实际测试执行
**最后更新**: 2026-01-28
**维护人员**: Personal Backend Engineer