let monotonicCounter = 0;

export function createId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  monotonicCounter = (monotonicCounter + 1) % 1000000;
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${monotonicCounter}-${rand}`;
}
