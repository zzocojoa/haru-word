import { createHash } from 'node:crypto';

// Text sources use one provenance representation across Git/Windows checkouts.
// Only CRLF is normalized; every other byte-level content change stays visible.
export function sourceFingerprint(bytes) {
  return createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
}
