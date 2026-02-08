
import axios from 'axios';
import FormData from 'form-data';

const baseURL = 'http://localhost:3100/';
const client = axios.create({ baseURL, validateStatus: () => true });

async function runTests() {
  const results = [];
  let token = '';
  let refreshToken = '';
  let characterId = '';
  let versionId = '';
  let conversationId = '';
  let taskId = '';
  let assistantMessageId = '';
  let attachmentId = '';

  console.log('Starting Comprehensive API Controller Tests...');

  // Helper to log result
  const log = (endpoint, method, res, description = '') => {
    const success = res.status >= 200 && res.status < 300;
    const result = {
      endpoint: `${method} ${endpoint}`,
      status: res.status,
      success,
      description,
      data: success ? (typeof res.data === 'object' ? 'OK (JSON)' : 'OK') : res.data
    };
    results.push(result);
    console.log(`[${method}] ${endpoint} -> ${res.status} ${success ? '✅' : '❌'} ${description}`);
    return result;
  };

  // ==========================================
  // 1. Auth Module
  // ==========================================
  try {
    console.log('\n--- Auth Module ---');
    
    // POST /auth/anon
    let res = await client.post('/auth/anon');
    log('/auth/anon', 'POST', res, 'Create Anon User');
    if (res.data && res.data.accessToken) {
      token = res.data.accessToken;
      refreshToken = res.data.refreshToken;
      client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    // POST /auth/token/refresh
    if (refreshToken) {
        res = await client.post('/auth/token/refresh', { refreshToken });
        log('/auth/token/refresh', 'POST', res, 'Refresh Token');
    }

    // POST /auth/magic-link/start
    res = await client.post('/auth/magic-link/start', { email: 'test@example.com' });
    log('/auth/magic-link/start', 'POST', res, 'Start Magic Link');
  } catch (e) {
    console.error('Auth Error:', e.message);
  }

  // ==========================================
  // 2. Characters Module
  // ==========================================
  try {
    console.log('\n--- Characters Module ---');

    // POST /characters
    let res = await client.post('/characters', {
      name: 'Test Controller Role',
      bio: 'Created by test script',
      visibility: 'private'
    });
    log('/characters', 'POST', res, 'Create Character');
    if (res.data && res.data.id) characterId = res.data.id;

    // GET /characters
    res = await client.get('/characters?limit=10');
    log('/characters', 'GET', res, 'List Characters');

    // GET /characters/:id
    if (characterId) {
      res = await client.get(`/characters/${characterId}`);
      log(`/characters/${characterId}`, 'GET', res, 'Get Character Detail');
    }
  } catch (e) {
    console.error('Characters Error:', e.message);
  }

  // ==========================================
  // 3. Character Versions Module
  // ==========================================
  try {
    console.log('\n--- Character Versions Module ---');

    // POST /characters/:characterId/versions
    if (characterId) {
      let res = await client.post(`/characters/${characterId}/versions`, {
        status: 'draft',
        promptConfig: {
            backgroundStory: "You are a test assistant.",
            personalityTags: ["helpful", "test"],
            speakingStyle: "concise"
        }
      });
      log(`/characters/${characterId}/versions`, 'POST', res, 'Create Version');
      if (res.data && res.data.versionId) versionId = res.data.versionId;

      // GET /characters/:characterId/versions
      res = await client.get(`/characters/${characterId}/versions`);
      log(`/characters/${characterId}/versions`, 'GET', res, 'List Versions');
    }

    // PUT /character-versions/:versionId
    if (versionId) {
      let res = await client.put(`/character-versions/${versionId}`, {
        promptConfig: {
             backgroundStory: "You are an updated test assistant."
        }
      });
      log(`/character-versions/${versionId}`, 'PUT', res, 'Update Version Draft');

      // POST /character-versions/:versionId/publish
      res = await client.post(`/character-versions/${versionId}/publish`);
      log(`/character-versions/${versionId}/publish`, 'POST', res, 'Publish Version');
    }
  } catch (e) {
    console.error('Character Versions Error:', e.message);
  }

  // ==========================================
  // 4. Conversations Module
  // ==========================================
  try {
    console.log('\n--- Conversations Module ---');

    // POST /conversations
    if (characterId) {
      let res = await client.post('/conversations', { characterId });
      log('/conversations', 'POST', res, 'Create Conversation');
      if (res.data && res.data.conversationId) conversationId = res.data.conversationId;
    }

    // GET /conversations
    let res = await client.get('/conversations?limit=5');
    log('/conversations', 'GET', res, 'List Conversations');

    // GET /conversations/:id
    if (conversationId) {
      res = await client.get(`/conversations/${conversationId}`);
      log(`/conversations/${conversationId}`, 'GET', res, 'Get Conversation Detail');

      // PATCH /conversations/:id
      res = await client.patch(`/conversations/${conversationId}`, { title: 'Updated Test Conversation' });
      log(`/conversations/${conversationId}`, 'PATCH', res, 'Update Conversation Title');
    }
  } catch (e) {
    console.error('Conversations Error:', e.message);
  }

  // ==========================================
  // 5. Chat & Tasks Module
  // ==========================================
  try {
    console.log('\n--- Chat & Tasks Module ---');

    // POST /chat/tasks
    if (conversationId) {
      let res = await client.post('/chat/tasks', {
        conversationId,
        clientMessageId: `msg_${Date.now()}`,
        content: "Hello, this is a test message.",
        attachmentIds: []
      });
      log('/chat/tasks', 'POST', res, 'Create Chat Task');
      
      if (res.data) {
        taskId = res.data.taskId;
        assistantMessageId = res.data.assistantMessageId;
      }

      // POST /chat/tasks/:taskId/cancel
      // Note: This might fail if task is already completed, but we test the endpoint
      if (taskId) {
        res = await client.post(`/chat/tasks/${taskId}/cancel`);
        log(`/chat/tasks/${taskId}/cancel`, 'POST', res, 'Cancel Task');
      }

      // POST /chat/messages/:assistantMessageId/retry
      // Note: This expects failed/canceled status. Might return 400 if generating/completed.
      if (assistantMessageId) {
        res = await client.post(`/chat/messages/${assistantMessageId}/retry`);
        log(`/chat/messages/${assistantMessageId}/retry`, 'POST', res, 'Retry Message (may fail if not eligible)');
      }

      // POST /chat/messages/:assistantMessageId/continue
      if (assistantMessageId) {
        res = await client.post(`/chat/messages/${assistantMessageId}/continue`);
        log(`/chat/messages/${assistantMessageId}/continue`, 'POST', res, 'Continue Message (may fail if not eligible)');
      }
    }
  } catch (e) {
    console.error('Chat Error:', e.message);
  }

  // ==========================================
  // 6. Messages Module
  // ==========================================
  try {
    console.log('\n--- Messages Module ---');

    // GET /conversations/:id/messages
    if (conversationId) {
      let res = await client.get(`/conversations/${conversationId}/messages`);
      log(`/conversations/${conversationId}/messages`, 'GET', res, 'List Messages');
    }
  } catch (e) {
    console.error('Messages Error:', e.message);
  }

  // ==========================================
  // 7. Summaries Module
  // ==========================================
  try {
    console.log('\n--- Summaries Module ---');

    if (conversationId) {
        // POST /summaries
        let res = await client.post('/summaries', {
            conversationId,
            content: "Manual summary content"
        });
        log('/summaries', 'POST', res, 'Create Manual Summary');

        // GET /summaries/conversation/:conversationId
        res = await client.get(`/summaries/conversation/${conversationId}`);
        log(`/summaries/conversation/${conversationId}`, 'GET', res, 'Get Summary');

        // PUT /summaries/conversation/:conversationId
        res = await client.put(`/summaries/conversation/${conversationId}`, {
            content: "Updated summary content"
        });
        log(`/summaries/conversation/${conversationId}`, 'PUT', res, 'Update Summary');

        // POST /summaries/conversation/:conversationId/generate
        res = await client.post(`/summaries/conversation/${conversationId}/generate?force=true`);
        log(`/summaries/conversation/${conversationId}/generate`, 'POST', res, 'Generate Summary');
        
        // GET /summaries
        res = await client.get('/summaries');
        log('/summaries', 'GET', res, 'List Summaries');
    }
  } catch (e) {
    console.error('Summaries Error:', e.message);
  }

  // ==========================================
  // 8. Uploads & Attachments Module
  // ==========================================
  try {
    console.log('\n--- Uploads & Attachments Module ---');

    // POST /uploads/images
    // Creating a dummy form data
    const form = new FormData();
    // In node, we might need a real buffer or file stream. 
    // For simplicity, we check if the endpoint is reachable.
    // If we can't easily mock file upload in this script without external deps, 
    // we accept 400 Bad Request (missing file) as "Endpoint Reachable"
    
    let res = await client.post('/uploads/images', {}, {
        headers: { 'Content-Type': 'multipart/form-data' } // Missing boundary/file will cause 400
    });
    // Expect 400 or 500 if file missing, but endpoint exists
    log('/uploads/images', 'POST', res, 'Upload Image (Expect 400/500 without real file)');

    // GET /attachments
    res = await client.get('/attachments');
    log('/attachments', 'GET', res, 'List Attachments');
    
    // Pick an attachment if exists
    if (res.data && res.data.items && res.data.items.length > 0) {
        attachmentId = res.data.items[0].id;
        
        // GET /attachments/:id
        res = await client.get(`/attachments/${attachmentId}`);
        log(`/attachments/${attachmentId}`, 'GET', res, 'Get Attachment Info');

        // GET /attachments/:id/download
        res = await client.get(`/attachments/${attachmentId}/download`);
        log(`/attachments/${attachmentId}/download`, 'GET', res, 'Download Attachment');

        // DELETE /attachments/:id
        // res = await client.delete(`/attachments/${attachmentId}`);
        // log(`/attachments/${attachmentId}`, 'DELETE', res, 'Delete Attachment');
    }

  } catch (e) {
    console.error('Uploads Error:', e.message);
  }

  // ==========================================
  // 9. Observability Module
  // ==========================================
  try {
    console.log('\n--- Observability Module ---');

    // GET /observability/metrics
    let res = await client.get('/observability/metrics');
    log('/observability/metrics', 'GET', res, 'Get Metrics');
  } catch (e) {
    console.error('Observability Error:', e.message);
  }

  // ==========================================
  // Cleanup
  // ==========================================
  try {
    console.log('\n--- Cleanup ---');
    
    if (conversationId) {
        let res = await client.delete(`/conversations/${conversationId}`);
        log(`/conversations/${conversationId}`, 'DELETE', res, 'Delete Conversation');
    }
    
    if (characterId && false) { // Optional: Delete character if endpoint exists (not implemented in controller?)
        // res = await client.delete(`/characters/${characterId}`);
        // log(`/characters/${characterId}`, 'DELETE', res, 'Delete Character');
    }

    // POST /auth/logout
    let res = await client.post('/auth/logout');
    log('/auth/logout', 'POST', res, 'Logout');

  } catch (e) {
    console.error('Cleanup Error:', e.message);
  }

  console.log('\nTests Completed.');
  console.log('Summary:', results.filter(r => r.success).length, 'Success,', results.filter(r => !r.success).length, 'Failed');
}

runTests();
