-- DropIndex
DROP INDEX "CharacterVersion_characterId_status_version_idx";

-- CreateTable
CREATE TABLE "CharacterFavorite" (
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "characterId"),
    CONSTRAINT "CharacterFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CharacterFavorite_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "deprecated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerUserId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "characterVersionId" TEXT NOT NULL,
    "title" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversation_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversation_characterVersionId_fkey" FOREIGN KEY ("characterVersionId") REFERENCES "CharacterVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Conversation" ("characterId", "characterVersionId", "createdAt", "deletedAt", "id", "lastMessageAt", "ownerUserId", "title", "updatedAt") SELECT "characterId", "characterVersionId", "createdAt", "deletedAt", "id", "lastMessageAt", "ownerUserId", "title", "updatedAt" FROM "Conversation";
DROP TABLE "Conversation";
ALTER TABLE "new_Conversation" RENAME TO "Conversation";
CREATE INDEX "Conversation_ownerUserId_updatedAt_idx" ON "Conversation"("ownerUserId", "updatedAt");
CREATE INDEX "Conversation_ownerUserId_deletedAt_idx" ON "Conversation"("ownerUserId", "deletedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CharacterFavorite_userId_idx" ON "CharacterFavorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AiModel_provider_modelId_key" ON "AiModel"("provider", "modelId");
