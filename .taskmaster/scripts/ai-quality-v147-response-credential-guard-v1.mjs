// Inspect credential evidence without treating embedded provider ciphertext/IDs as credentials.
import { JUDGES } from './ai-quality-v147-calibration.mjs';
import { parseV3Json } from './ai-quality-v147-wire-v3.mjs';
const standalone = /(?:^|[^A-Za-z0-9_-])sk-(?:proj-)?[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])/;
const embedded = /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/;

export function inspectResponseCredentialsV1(raw, configuredKey) {
  let body, reason = null, embeddedMarkerIgnored = false;
  const exact = typeof configuredKey === 'string' && configuredKey.length >= 16;
  if (exact && raw.includes(configuredKey)) reason = 'configured-key';
  try { body = parseV3Json(raw, 262144); } catch { return { blocked: true, reason: reason ?? 'unparseable-json', metadata: {}, embeddedMarkerIgnored: false }; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { blocked: true, reason: reason ?? 'unparseable-json', metadata: {}, embeddedMarkerIgnored: false };
  function walk(value, field = '', parent = null) {
    if (typeof value === 'string') {
      // Check the configured key in every decoded value, including opaque metadata and JSON escapes.
      if (exact && value.includes(configuredKey)) reason = 'configured-key';
      const ciphertext = field === 'encrypted_content' && parent?.type === 'reasoning';
      if (!ciphertext && standalone.test(value) && reason !== 'configured-key') reason = 'standalone-key-shape';
      else if (embedded.test(value)) embeddedMarkerIgnored = true;
    } else if (Array.isArray(value)) value.forEach(v => walk(v));
    else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
      if (exact && key.includes(configuredKey)) reason = 'configured-key';
      else if (standalone.test(key) && reason !== 'configured-key') reason = 'standalone-key-shape';
      walk(item, key, value);
    }
  }
  walk(body);
  const metadata = {};
  if (typeof body.id === 'string' && /^resp_[A-Za-z0-9_-]{1,160}$/.test(body.id)
    && !(exact && body.id.includes(configuredKey)) && !standalone.test(body.id)) metadata.providerResponseId = body.id;
  if (JUDGES.includes(body.model)) metadata.providerModel = body.model;
  const u = body.usage;
  if (u && ['input_tokens','output_tokens','total_tokens'].every(k => Number.isSafeInteger(u[k]) && u[k] >= 0 && u[k] <= 1000000000)
    && u.total_tokens === u.input_tokens + u.output_tokens) metadata.providerUsage = Object.fromEntries(['input_tokens','output_tokens','total_tokens'].map(k => [k,u[k]]));
  return { blocked: reason !== null, reason, metadata, embeddedMarkerIgnored };
}
