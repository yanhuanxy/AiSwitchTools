-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "identifierHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserRefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rotatedFromTokenId" TEXT,
    "deviceFingerprint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "UserRefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshLock" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarAttachmentId" TEXT,
    "bio" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Character_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CharacterVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "promptConfigJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workflowId" TEXT,
    "knowledgeBaseId" TEXT,
    CONSTRAINT "CharacterVersion_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CharacterVersion_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CharacterVersion_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "graphData" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    CONSTRAINT "Workflow_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgeBase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    CONSTRAINT "KnowledgeBase_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "knowledgeBaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Chunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Chunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerUserId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "characterVersionId" TEXT NOT NULL,
    "title" TEXT,
    "lastMessageAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversation_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversation_characterVersionId_fkey" FOREIGN KEY ("characterVersionId") REFERENCES "CharacterVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "clientMessageId" TEXT,
    "status" TEXT NOT NULL,
    "partial" BOOLEAN NOT NULL DEFAULT false,
    "supersededByMessageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "scanStatus" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "messageId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,

    PRIMARY KEY ("messageId", "attachmentId"),
    CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MessageAttachment_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GenerationTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "assistantMessageId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "tokenUsagePrompt" INTEGER,
    "tokenUsageCompletion" INTEGER,
    "tokenUsageTotal" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GenerationTask_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConversationSummary_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "ownerUserId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MagicLinkToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'login',
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_type_identifierHash_key" ON "UserIdentity"("type", "identifierHash");

-- CreateIndex
CREATE INDEX "UserRefreshToken_tokenHash_idx" ON "UserRefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "UserRefreshToken_userId_status_expiresAt_idx" ON "UserRefreshToken"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "Character_ownerUserId_updatedAt_idx" ON "Character"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "CharacterVersion_characterId_status_version_idx" ON "CharacterVersion"("characterId", "status", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterVersion_characterId_version_key" ON "CharacterVersion"("characterId", "version");

-- CreateIndex
CREATE INDEX "Workflow_ownerUserId_updatedAt_idx" ON "Workflow"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgeBase_ownerUserId_updatedAt_idx" ON "KnowledgeBase"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "Document_knowledgeBaseId_idx" ON "Document"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "Chunk_documentId_idx" ON "Chunk"("documentId");

-- CreateIndex
CREATE INDEX "Conversation_ownerUserId_updatedAt_idx" ON "Conversation"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_ownerUserId_deletedAt_idx" ON "Conversation"("ownerUserId", "deletedAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_id_idx" ON "Message"("conversationId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_clientMessageId_key" ON "Message"("conversationId", "clientMessageId");

-- CreateIndex
CREATE INDEX "Attachment_ownerUserId_createdAt_idx" ON "Attachment"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationTask_conversationId_createdAt_idx" ON "GenerationTask"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationSummary_conversationId_key" ON "ConversationSummary"("conversationId");

-- CreateIndex
CREATE INDEX "MagicLinkToken_email_expiresAt_idx" ON "MagicLinkToken"("email", "expiresAt");

-- CreateIndex
CREATE INDEX "MagicLinkToken_tokenHash_idx" ON "MagicLinkToken"("tokenHash");
