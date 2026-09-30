import test from 'node:test';
import assert from 'node:assert/strict';
import uri from 'fast-uri';
import { BalancedPool } from 'undici';

test('encoded scheme-relative hosts use the same canonical host', () => {
  for (const reference of ['//%41.com', '//A.com', '//a.com']) {
    assert.equal(uri.parse(reference).host, 'a.com');
    assert.equal(uri.normalize(reference), '//a.com');
    assert.equal(uri.equal(reference, '//a.com'), true);
  }
});

test('BalancedPool preserves a custom connector and its rejection', async () => {
  const rejected = new Error('Synthetic connector rejects the connection');
  let calls = 0;
  // A regressed default connector can reach only this closed loopback port.
  const pool = new BalancedPool(['http://127.0.0.1:1'], {
    connect(_options, callback) {
      calls++;
      callback(rejected);
    },
    connectTimeout: 1000,
  });
  try {
    await assert.rejects(pool.request({ method: 'GET', path: '/' }), error => error === rejected);
    assert.equal(calls, 1);
  } finally {
    await pool.close();
  }
});
