import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { localBase, account, accountHeaders }=createRequire(import.meta.url)('./qa/runtime.cjs');
test('browser QA accepts only loopback origins before test account headers can be sent',()=>{
 for(const value of ['http://127.0.0.1:8787','http://localhost:9000','http://[::1]:8787'])assert.equal(localBase(value),value);
 for(const value of ['https://example.com','http://localhost.example.com','http://user:pass@localhost','http://127.0.0.1/path','file:///tmp/x'])assert.throws(()=>localBase(value));
});
test('QA accounts are unique across scripts and retain their scenario prefix',()=>{
 assert.notEqual(account('same'),account('same'));
 assert.match(accountHeaders('editor')['oai-authenticated-user-id'],/^editor_/);
});
