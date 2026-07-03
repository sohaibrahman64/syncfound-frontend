export function generateIdempotencyKey(prefix = 'chat-msg') {
  const normalizedPrefix = String(prefix || 'chat-msg').trim() || 'chat-msg';

  if (typeof globalThis?.crypto?.randomUUID === 'function') {
    return `${normalizedPrefix}-${globalThis.crypto.randomUUID()}`.slice(0, 150);
  }

  const randomPart = Math.random().toString(36).slice(2);
  return `${normalizedPrefix}-${Date.now()}-${randomPart}`.slice(0, 150);
}
