import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyCloudFailure,
  createSyncCloudClient,
  timeoutFor,
  SYNC_TIMEOUTS,
  FAILOVER_COOLDOWN_MS,
  CloudSyncError,
} from '../sync/syncCloudClient.js';

function jsonResponse(status, body, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => (String(name).toLowerCase() === 'content-type' ? contentType : null)
    },
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
  };
}

test('classify: transport and platform errors fail over; auth and validation do not', () => {
  assert.equal(classifyCloudFailure({ status: 429, bodyText: 'rate' }), 'FAILOVER');
  assert.equal(classifyCloudFailure({ status: 503, bodyText: '' }), 'FAILOVER');
  assert.equal(classifyCloudFailure({ status: 502, bodyText: 'bad gateway' }), 'FAILOVER');
  assert.equal(classifyCloudFailure({ status: 504, bodyText: '' }), 'FAILOVER');
  assert.equal(classifyCloudFailure({
    status: 200,
    contentType: 'text/html',
    bodyText: 'This deployment has been paused due to usage limits'
  }), 'FAILOVER');
  assert.equal(classifyCloudFailure({ networkError: Object.assign(new Error('aborted'), { name: 'AbortError' }) }), 'FAILOVER');
  assert.equal(classifyCloudFailure({ networkError: Object.assign(new Error('fetch failed'), { code: 'ECONNRESET' }) }), 'FAILOVER');

  assert.equal(classifyCloudFailure({ status: 401, bodyText: '{"error":"Unauthorized device"}' }), 'AUTH');
  assert.equal(classifyCloudFailure({ status: 403, bodyText: 'forbidden' }), 'AUTH');
  assert.equal(classifyCloudFailure({ status: 409, bodyText: '{"conflicts":[]}' }), 'CONFLICT');
  assert.equal(classifyCloudFailure({ status: 400, bodyText: '{"error":"events array is required"}' }), 'CLIENT');
});

test('timeouts: primary 12s, cold fallback 90s, warm fallback 20s, fast 1.5s', () => {
  assert.equal(timeoutFor({ activeHost: 'primary' }), SYNC_TIMEOUTS.PRIMARY_MS);
  assert.equal(timeoutFor({ activeHost: 'fallback', fallbackWarm: false }), SYNC_TIMEOUTS.FALLBACK_WAKE_MS);
  assert.equal(timeoutFor({ activeHost: 'fallback', fallbackWarm: true }), SYNC_TIMEOUTS.FALLBACK_WARM_MS);
  assert.equal(timeoutFor({ activeHost: 'primary' }, { mode: 'fast' }), SYNC_TIMEOUTS.FAST_MS);
  assert.equal(timeoutFor({ activeHost: 'fallback', fallbackWarm: false }, { mode: 'fast' }), SYNC_TIMEOUTS.FAST_MS);
});

test('503 on primary hops once to fallback; never parallel', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push({ url, at: Date.now() });
    if (String(url).includes('primary.example')) {
      return jsonResponse(503, '');
    }
    return jsonResponse(200, { successful: ['a'], failed: [], conflicts: [] });
  };
  const client = createSyncCloudClient({
    primaryUrl: 'https://primary.example/api/v1',
    fallbackUrl: 'https://fallback.example/api/v1',
    fetchImpl
  });
  const result = await client.request('/sync/push', { method: 'POST', body: '{}' });
  assert.equal(result.host, 'fallback');
  assert.deepEqual(result.json.successful, ['a']);
  assert.equal(client.getState().activeHost, 'fallback');
  assert.equal(client.getState().fallbackWarm, true);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /primary\.example/);
  assert.match(calls[1].url, /fallback\.example/);
});

test('401 does not hop hosts', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(401, { error: 'Unauthorized device' });
  };
  const client = createSyncCloudClient({
    primaryUrl: 'https://primary.example/api/v1',
    fallbackUrl: 'https://fallback.example/api/v1',
    fetchImpl
  });
  await assert.rejects(
    () => client.request('/sync/pull'),
    (err) => err instanceof CloudSyncError && err.code === 'AUTH'
  );
  assert.equal(calls, 1);
  assert.equal(client.getState().activeHost, 'primary');
});

test('no fallback stays on primary and does not invent a second request', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(503, '');
  };
  const client = createSyncCloudClient({
    primaryUrl: 'https://primary.example/api/v1',
    fallbackUrl: '',
    fetchImpl
  });
  await assert.rejects(
    () => client.request('/sync/pull'),
    (err) => err instanceof CloudSyncError && err.code === 'FAILOVER'
  );
  assert.equal(calls, 1);
});

test('fast mode never waits on Render wake', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(503, '');
  };
  const client = createSyncCloudClient({
    primaryUrl: 'https://primary.example/api/v1',
    fallbackUrl: 'https://fallback.example/api/v1',
    fetchImpl
  });
  await assert.rejects(() => client.request('/sync/allocate-number', { method: 'POST' }, { mode: 'fast', timeoutMs: 1500 }));
  assert.equal(calls, 1);
  assert.equal(client.getState().activeHost, 'primary');
});

test('after cooldown a healthy primary probe switches back', async () => {
  let t = 1_000;
  const fetchImpl = async (url) => {
    if (String(url).includes('/health') && String(url).includes('primary.example')) {
      return jsonResponse(200, { status: 'ok', timestamp: 'x' });
    }
    if (String(url).includes('primary.example')) return jsonResponse(503, '');
    return jsonResponse(200, { successful: [], failed: [], conflicts: [] });
  };
  const client = createSyncCloudClient({
    primaryUrl: 'https://primary.example/api/v1',
    fallbackUrl: 'https://fallback.example/api/v1',
    fetchImpl,
    now: () => t
  });
  await client.request('/sync/push', { method: 'POST', body: '{}' });
  assert.equal(client.getState().activeHost, 'fallback');

  t += FAILOVER_COOLDOWN_MS - 1;
  await client.maybeFailBack();
  assert.equal(client.getState().activeHost, 'fallback');

  t += 2;
  await client.maybeFailBack();
  assert.equal(client.getState().activeHost, 'primary');
});
