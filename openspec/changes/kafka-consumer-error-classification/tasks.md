## 1. Revert Option C

- [x] 1.1 Delete `backend/src/shared/kafka/retry.util.ts` and `backend/src/shared/kafka/retry.util.spec.ts`
- [x] 1.2 In `backend/src/shared/kafka/kafka-consumer.base.ts`, remove the `withRetry` import and the `withRetry(() => this.handleMessage(payload))` call, reverting to a direct `await this.handleMessage(payload)` inside the try block (classification logic added in the next section)

## 2. Implement Option B (Error Classification)

- [x] 2.1 Create `backend/src/shared/kafka/error-classification.util.ts` exporting `isDataError(err: unknown): boolean`, returning `true` for `SyntaxError`, Mongoose `ValidationError`, and Mongoose `CastError`
- [x] 2.2 In `backend/src/shared/kafka/kafka-consumer.base.ts`'s `eachMessage` catch block: if `isDataError(err)`, log and swallow (return, same as today's behavior); otherwise rethrow the error so it propagates out of `eachMessage` to kafkajs's own runner-level retry mechanism
- [x] 2.3 Update the code comments referencing the (now reverted) retry-with-backoff design decision to point at Option B instead

## 3. Manual Verification (real running system, not just build)

- [x] 3.1 Rebuild and restart the `backend` container (`docker compose up -d --build backend`)
- [x] 3.2 Confirm the happy path is unaffected: POST a valid event via `/simulator/events`, verify normal processing with no added delay (`currentTemperature`/`lastEventId` updated correctly)
- [x] 3.3 Published a malformed (non-JSON) message directly to `machine.events`; confirmed all 3 consumers logged "Skipping unprocessable message" in the same second as the publish (no retry delay), container stayed up, and a subsequent valid event still processed normally
- [x] 3.4 Published a `STATUS_CHANGED` event with `currentStatus: "BOGUS_STATUS"` directly to Kafka (bypassing simulator's HTTP-boundary enum validation); confirmed Machine Service's Mongoose `ValidationError` was classified as a data error and logged as "Skipping unprocessable message" instead of crashing or retrying, and the machine's `status` field was not corrupted (stayed at its last valid value)
- [x] 3.5 Confirmed via `docker logs ifoc-backend`: correct classification for both cases, no crash/restart, no rebalance, container remained `Up` throughout
- [x] 3.6 Re-ran `npm test` — 9/9 pass (`sensor-failure-contract.spec.ts` 8 tests + `app.controller.spec.ts` 1 test); `retry.util.spec.ts` no longer exists

## 4. OpenSpec Closeout

- [x] 4.1 Run `openspec validate kafka-consumer-error-classification --strict` and confirm it passes
- [ ] 4.2 Archive the change once all tasks above are complete and verified
