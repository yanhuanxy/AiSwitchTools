
# End-to-End Test Scripts

## 1. CURL Example
Test the V2 completion endpoint (Standard HTTP):
```bash
curl -X POST http://localhost:3000/api/chat/completion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "conversationId": "conv-123",
    "clientMessageId": "msg-001",
    "content": "Hello aggregate service",
    "attachmentIds": []
  }'
```

Test the SSE Stream endpoint:
```bash
curl -N --http2 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: text/event-stream" \
  http://localhost:3000/api/chat/stream?taskId=task-123
```

## 2. JavaScript (Browser/Node) SSE Client
```javascript
const taskId = 'task-123';
const token = 'YOUR_TOKEN';
const eventSource = new EventSource(`http://localhost:3000/api/chat/stream?taskId=${taskId}&token=${token}`);

eventSource.onopen = () => {
    console.log('Connection opened');
};

eventSource.onmessage = (event) => {
    // Standard message event? Usually we use custom events or 'message'
    console.log('Message:', event.data);
};

eventSource.addEventListener('message', (e) => {
    const data = JSON.parse(e.data);
    console.log('Received chunk:', data.content);
});

// Listen for heartbeat (comment line usually doesn't trigger event, but keep-alive might be handled by browser)

eventSource.onerror = (err) => {
    console.error('EventSource failed:', err);
    eventSource.close();
    // Implement retry logic here if needed (browser retries automatically)
};
```

## 3. Postman Collection
Create a new request in Postman:
1. **Method**: GET
2. **URL**: `http://localhost:3000/api/chat/stream?taskId={{taskId}}`
3. **Headers**:
    - `Authorization`: `Bearer {{token}}`
    - `Accept`: `text/event-stream`
4. **Settings**:
    - Enable "Scroll automatically" in response body.
    - Note: Postman supports SSE visualization.

### Test Scenarios to Cover
1. **Normal Message**: Send "Hello", verify stream receives chunks and completes.
2. **Exception**: Trigger error (e.g., invalid task ID), verify error event or 4xx status.
3. **Network Disconnect**:
    - Start stream.
    - Disconnect network.
    - Verify client attempts reconnection (browser default or custom logic).
    - Reconnect network.
    - Verify stream resumes (if backend supports resume, or new connection starts).
4. **Multi-Tab Concurrency**: Open 5 tabs with same stream URL, verify all receive data.
