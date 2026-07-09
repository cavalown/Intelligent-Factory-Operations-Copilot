// Matches docs/design/machine-schema.md §3. Lives in shared/ (not machines/)
// because it's referenced by 2+ modules (machines/, simulator/) — a plain
// type/vocabulary, not persistence access, per ai/rules/module-boundaries.md.
export const MACHINE_STATUSES = [
  'RUNNING',
  'IDLE',
  'WARNING',
  'ERROR',
  'MAINTENANCE',
] as const;

export type MachineStatus = (typeof MACHINE_STATUSES)[number];
