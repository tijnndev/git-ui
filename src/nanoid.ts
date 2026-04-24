/** Tiny ID generator — no external dependency needed. */
export function nanoid(): string {
  return crypto.randomUUID();
}
