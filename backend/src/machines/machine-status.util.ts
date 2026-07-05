import { MachineStatus } from './schemas/machine.schema';

// docs/design/machine-schema.md §4.2 severity ranking.
const SEVERITY_RANK: Record<MachineStatus, number> = {
  ERROR: 4,
  MAINTENANCE: 3,
  WARNING: 2,
  RUNNING: 1,
  IDLE: 1,
};

// "An event's implied status only overwrites machine.status if its rank is
// greater than or equal to the current status's rank." (machine-schema.md §4.2)
export function raiseSeverity(
  current: MachineStatus,
  implied: MachineStatus,
): MachineStatus {
  return SEVERITY_RANK[implied] >= SEVERITY_RANK[current] ? implied : current;
}

export function clampHealthScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}
