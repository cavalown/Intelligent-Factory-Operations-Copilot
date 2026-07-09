import mongoose from 'mongoose';

// Classifies "this message's content is wrong, retrying won't help" errors,
// per openspec/changes/kafka-consumer-error-classification/design.md Decision
// (Option B). Anything else propagates so kafkajs's own runner-level retrier
// (jittered, already a tested part of the kafkajs dependency) can handle it,
// instead of being retried by hand-rolled application logic.
export function isDataError(err: unknown): boolean {
  return (
    err instanceof SyntaxError ||
    err instanceof mongoose.Error.ValidationError ||
    err instanceof mongoose.Error.CastError
  );
}
