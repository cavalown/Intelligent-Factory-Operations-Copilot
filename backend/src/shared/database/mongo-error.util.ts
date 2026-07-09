// MongoDB duplicate-key error code, per machine-schema.md §8 idempotency
// pattern. Shared because multiple Kafka consumers independently need it —
// this is infrastructure (Mongo driver error shape), not business logic,
// per ai/rules/module-boundaries.md.
export function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}
