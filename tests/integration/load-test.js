
const http = require('http');
const https = require('https');

// Configuration
const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000/api/chat/completion';
const CONCURRENCY = 1000;
const DURATION_MS = 10 * 60 * 1000; // 10 minutes
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'Bearer YOUR_TOKEN';

let totalRequests = 0;
let failedRequests = 0;
let totalLatency = 0;
let activeConnections = 0;
const startTime = Date.now();

const agent = new http.Agent({ keepAlive: true, maxSockets: CONCURRENCY });

function makeRequest() {
    if (Date.now() - startTime > DURATION_MS) return;

    activeConnections++;
    const reqStart = Date.now();
    
    const postData = JSON.stringify({
        conversationId: 'load-test-conv',
        clientMessageId: `msg-${Date.now()}-${Math.random()}`,
        content: 'Hello, world!',
        attachmentIds: []
    });

    const req = http.request(TARGET_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': AUTH_TOKEN,
            'Content-Length': Buffer.byteLength(postData)
        },
        agent: agent,
        timeout: 30000
    }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            const latency = Date.now() - reqStart;
            totalLatency += latency;
            totalRequests++;
            activeConnections--;
            
            if (res.statusCode >= 400) {
                failedRequests++;
                // console.error(`Request failed: ${res.statusCode} ${data}`);
            }

            // Maintain concurrency
            if (Date.now() - startTime < DURATION_MS) {
                makeRequest();
            }
        });
    });

    req.on('error', (e) => {
        failedRequests++;
        activeConnections--;
        // console.error(`Request error: ${e.message}`);
        if (Date.now() - startTime < DURATION_MS) {
            makeRequest();
        }
    });

    req.write(postData);
    req.end();
}

console.log(`Starting load test: ${CONCURRENCY} concurrency, ${DURATION_MS/1000}s duration...`);

// Ramp up
for (let i = 0; i < CONCURRENCY; i++) {
    makeRequest();
}

// Report loop
const reportInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const avgLatency = totalRequests > 0 ? (totalLatency / totalRequests).toFixed(2) : 0;
    const errorRate = totalRequests > 0 ? ((failedRequests / totalRequests) * 100).toFixed(2) : 0;
    const rps = (totalRequests / elapsed).toFixed(2);

    console.log(`[${elapsed.toFixed(0)}s] Req: ${totalRequests}, Fail: ${failedRequests} (${errorRate}%), Avg Latency: ${avgLatency}ms, RPS: ${rps}`);

    if (Date.now() - startTime > DURATION_MS) {
        clearInterval(reportInterval);
        console.log('Test completed.');
        if (parseFloat(errorRate) > 0.1) {
            console.error('FAIL: Error rate > 0.1%');
            process.exit(1);
        }
        console.log('PASS: Error rate <= 0.1%');
        process.exit(0);
    }
}, 5000);
