
import axios from 'axios';

const baseURL = 'http://localhost:3100/api';
const client = axios.create({ baseURL, validateStatus: () => true });

async function runTests() {
  const results = [];
  let token = '';
  let roleId = 'dummy-role-id';
  let versionId = 'dummy-version-id';
  let conversationId = 'dummy-conv-id';

  console.log('Starting API Tests...');

  // 1. Auth: Anon Login
  try {
    console.log('Testing POST /auth/anon...');
    const res = await client.post('/auth/anon');
    results.push({
      endpoint: 'POST /auth/anon',
      status: res.status,
      data: res.data,
      success: res.status === 200 || res.status === 201
    });
    if (res.data && res.data.accessToken) {
      token = res.data.accessToken;
      client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      console.log('Token obtained.');
    } else {
      console.error('Failed to get token. Status:', res.status);
    }
  } catch (e) {
    results.push({ endpoint: 'POST /auth/anon', error: e.message, success: false });
  }

  // 2. Roles: List
  try {
    console.log('Testing GET /characters...');
    const res = await client.get('/characters');
    results.push({
      endpoint: 'GET /characters',
      status: res.status,
      success: res.status === 200
    });
  } catch (e) {
    results.push({ endpoint: 'GET /characters', error: e.message, success: false });
  }

  // 3. Roles: Create
  try {
    console.log('Testing POST /characters...');
    const res = await client.post('/characters', {
      name: 'Test Role',
      bio: 'A test role for API integration.'
    });
    results.push({
      endpoint: 'POST /characters',
      status: res.status,
      success: res.status === 200 || res.status === 201
    });
    if (res.data && res.data.id) {
      roleId = res.data.id;
    }
  } catch (e) {
    results.push({ endpoint: 'POST /characters', error: e.message, success: false });
  }

  // 4. Roles: Detail
  try {
    console.log(`Testing GET /characters/${roleId}...`);
    const res = await client.get(`/characters/${roleId}`);
    results.push({
      endpoint: `GET /characters/:id`,
      status: res.status,
      success: res.status === 200
    });
  } catch (e) {
    results.push({ endpoint: `GET /characters/:id`, error: e.message, success: false });
  }

  // 5. Roles: Create Version
  try {
    console.log(`Testing POST /characters/${roleId}/versions...`);
    const res = await client.post(`/characters/${roleId}/versions`, {
      status: 'draft',
      promptConfig: {
        backgroundStory: 'Story',
        personalityTags: ['tag1'],
        speakingStyle: 'Normal',
        fewShotExamples: [],
        tabooAndBoundaries: 'None'
      }
    });
    results.push({
      endpoint: `POST /characters/:id/versions`,
      status: res.status,
      success: res.status === 200 || res.status === 201
    });
    if (res.data && res.data.versionId) {
      versionId = res.data.versionId;
    }
  } catch (e) {
    results.push({ endpoint: `POST /characters/:id/versions`, error: e.message, success: false });
  }

  // 6. Conversations: Create
  try {
    console.log('Testing POST /conversations...');
    const res = await client.post('/conversations', { characterId: roleId });
    results.push({
      endpoint: 'POST /conversations',
      status: res.status,
      success: res.status === 200 || res.status === 201
    });
    if (res.data && res.data.conversationId) {
      conversationId = res.data.conversationId;
    }
  } catch (e) {
    results.push({ endpoint: 'POST /conversations', error: e.message, success: false });
  }

  // 7. Conversations: List
  try {
    console.log('Testing GET /conversations...');
    const res = await client.get('/conversations');
    results.push({
      endpoint: 'GET /conversations',
      status: res.status,
      success: res.status === 200
    });
  } catch (e) {
    results.push({ endpoint: 'GET /conversations', error: e.message, success: false });
  }

  // 8. Conversations: Messages
  try {
    console.log(`Testing GET /conversations/${conversationId}/messages...`);
    const res = await client.get(`/conversations/${conversationId}/messages`);
    results.push({
      endpoint: `GET /conversations/:id/messages`,
      status: res.status,
      success: res.status === 200
    });
  } catch (e) {
    results.push({ endpoint: `GET /conversations/:id/messages`, error: e.message, success: false });
  }

  // 9. Attachments: Upload
  try {
    console.log('Testing POST /uploads/images...');
    // Mock FormData since we are in node, simpler to just check if endpoint responds
    // sending empty body or partial data to see if we get 400/401 instead of 404/500
    const res = await client.post('/uploads/images');
    results.push({
      endpoint: 'POST /uploads/images',
      status: res.status,
      success: res.status === 200 || res.status === 201
    });
  } catch (e) {
    results.push({ endpoint: 'POST /uploads/images', error: e.message, success: false });
  }

  console.log('Tests completed.');
  console.log(JSON.stringify(results, null, 2));
}

runTests();
