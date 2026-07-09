import { isStatusChangedSensorFailure as machineServiceCheck } from '../machines/machine-projection-consumer.service';
import { isStatusChangedSensorFailure as alertServiceCheck } from '../alerts/alert-consumer.service';
import { MACHINE_STATUSES } from './types/machine-status.types';

// Contract test: Machine Service and Alert Service each independently
// implement "is this STATUS_CHANGED event a sensor failure" (deliberately
// not shared code — see docs/design/machine-schema.md §5.4 and
// openspec/changes/duplicate-logic-cleanup/design.md Decision 2). This test
// is the safety net that catches the two definitions drifting apart, since
// nothing else structurally guarantees they agree.
describe('STATUS_CHANGED sensor-failure classification contract', () => {
  const fixtures = [...MACHINE_STATUSES, 'BOGUS_STATUS'];

  it.each(fixtures)(
    'Machine Service and Alert Service agree on currentStatus=%s',
    (currentStatus) => {
      expect(machineServiceCheck(currentStatus)).toBe(
        alertServiceCheck(currentStatus),
      );
    },
  );

  it('both classify WARNING as a sensor failure', () => {
    expect(machineServiceCheck('WARNING')).toBe(true);
    expect(alertServiceCheck('WARNING')).toBe(true);
  });

  it('both classify every non-WARNING status as not a sensor failure', () => {
    for (const status of MACHINE_STATUSES) {
      if (status === 'WARNING') continue;
      expect(machineServiceCheck(status)).toBe(false);
      expect(alertServiceCheck(status)).toBe(false);
    }
  });
});
