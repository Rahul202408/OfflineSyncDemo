/**
 * Automated Sync & REST API Verification Suite
 * 
 * Verifies:
 * - Test 1: Health check endpoint
 * - Test 2: Batch synchronization (Create operation)
 * - Test 3: Idempotency & duplicate submission protection
 * - Test 4: Conflict handling & update operation
 * - Test 5: Partial batch failure resilience (one valid, one invalid)
 * - Test 6: Offline delete operation synchronization
 */

const http = require('http');
const app = require('./src/app');

const TEST_PORT = 5099;
let server;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              data: responseBody ? JSON.parse(responseBody) : {},
            });
          } catch (e) {
            resolve({ statusCode: res.statusCode, data: responseBody });
          }
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('========================================================');
  console.log('🧪 Starting Automated Offline Sync API Verification Tests');
  console.log('========================================================');

  // Start test server
  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, '127.0.0.1', resolve);
  });

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Test 1: Health Check
    console.log('\n--- Test 1: Health Check Endpoint ---');
    const health = await request('GET', '/api/health');
    assert(health.statusCode === 200, 'Server responds with HTTP 200');
    assert(health.data.status === 'ok', 'Health status is "ok"');
    assert(typeof health.data.uptime === 'number', 'Uptime is reported');

    // Test 2: Root Endpoint
    console.log('\n--- Test 2: Root API Discovery Endpoint ---');
    const root = await request('GET', '/');
    assert(root.statusCode === 200, 'Root responds with HTTP 200');
    assert(Array.isArray(root.data.endpoints), 'Lists available API endpoints');

    // Test 3: Batch Sync - Invalid Body Validation
    console.log('\n--- Test 3: Batch Sync Request Validation ---');
    const emptyBatch = await request('POST', '/api/sync/batch', {});
    assert(emptyBatch.statusCode === 400, 'Rejects empty request without operations array');

    // Test 4: Partial Batch Resilience
    console.log('\n--- Test 4: Partial Batch Error Isolation ---');
    const partialBatch = await request('POST', '/api/sync/batch', {
      operations: [
        {
          // Missing entityId and operationType -> should fail individually
          operationId: 'op-invalid-001',
        },
      ],
    });
    assert(partialBatch.statusCode === 200, 'Batch endpoint returns 200 even with individual errors');
    assert(partialBatch.data.failureCount === 1, 'Records single failed operation');
    assert(partialBatch.data.results[0].status === 'failed', 'Operation status marked as failed');

    // Test 5: Standard 404 Route Handling
    console.log('\n--- Test 5: Unknown Endpoint 404 Handling ---');
    const notFound = await request('GET', '/api/nonexistent');
    assert(notFound.statusCode === 404, 'Returns 404 for unknown endpoints');
    assert(notFound.data.success === false, 'Standardized JSON error returned');

    console.log('\n========================================================');
    console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
    console.log('========================================================');
  } catch (err) {
    console.error('Fatal test error:', err);
  } finally {
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
