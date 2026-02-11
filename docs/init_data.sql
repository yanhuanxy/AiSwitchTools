-- Initialize Basic Data
-- Platform: SQLite (Compatible with PostgreSQL syntax for simple inserts)

-- 1. Create Default User (Admin)
-- Note: Password/Auth handled by external provider or UserIdentity table
INSERT INTO "User" ("id", "createdAt", "tokenVersion") 
VALUES ('admin-user-id', CURRENT_TIMESTAMP, 0);

-- 2. Create Default Knowledge Base
INSERT INTO "KnowledgeBase" ("id", "name", "description", "ownerUserId", "createdAt", "updatedAt") 
VALUES ('kb-default-001', 'Default KB', 'System default knowledge base', 'admin-user-id', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 3. Create Standard RAG Workflow
-- Includes Semantic Analysis -> Vector Search -> LLM Generation
INSERT INTO "Workflow" ("id", "name", "description", "graphData", "published", "ownerUserId", "createdAt", "updatedAt")
VALUES (
  'wf-rag-standard', 
  'Standard RAG', 
  'Default RAG workflow with Semantic Analysis', 
  '{
    "nodes": [
      {"id": "1", "type": "start", "position": {"x": 0, "y": 0}},
      {"id": "2", "type": "semantic-analysis", "position": {"x": 200, "y": 0}},
      {"id": "3", "type": "knowledge-base", "data": {"knowledgeBaseId": "kb-default-001"}, "position": {"x": 400, "y": 0}},
      {"id": "4", "type": "llm", "data": {"prompt": "Context: {{context}}\\n\\nUser Query: {{user_input}}\\n\\nAnswer the query based on the context.", "model": "gpt-4"}, "position": {"x": 600, "y": 0}},
      {"id": "5", "type": "end", "position": {"x": 800, "y": 0}}
    ],
    "edges": [
      {"id": "e1-2", "source": "1", "target": "2"},
      {"id": "e2-3", "source": "2", "target": "3"},
      {"id": "e3-4", "source": "3", "target": "4"},
      {"id": "e4-5", "source": "4", "target": "5"}
    ]
  }',
  1, 
  'admin-user-id', 
  CURRENT_TIMESTAMP, 
  CURRENT_TIMESTAMP
);

-- 4. Missing Tables (Gap Analysis Finding)
-- The following tables are required by business logic but missing in Schema:
-- - Role / Permission
-- - SystemConfig
-- - Dictionary
