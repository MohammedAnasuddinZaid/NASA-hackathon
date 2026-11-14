import { describe, expect, it } from 'vitest';
import { recordById, records } from '../src/lib/corpus';
import {
  comparabilityAudit,
  compareFields,
  comparisonBlockerCount,
  fieldDisplay,
  fieldStatus,
} from '../src/lib/compare';
import type { ExperimentRecord } from '../src/lib/types';

function get(id: string): ExperimentRecord {
  const record = recordById.get(id);
  if (!record) throw new Error(`Missing fixture record ${id}`);
  return record;
}

describe('compare field definitions', () => {
  it('covers sample, atmosphere, flow/gravity and outcome groups', () => {
    const groups = new Set(compareFields.map((field) => field.group));
    expect(groups).toEqual(new Set(['Sample', 'Atmosphere', 'Flow & gravity', 'Ignition & outcome']));
  });

  it('displays absent pressure as not reported, never zero', () => {
    expect(fieldDisplay(compareFields.find((field) => field.key === 'pressure')!, get('BASS2-B1'))).toBe('Not reported');
    expect(fieldDisplay(compareFields.find((field) => field.key === 'ppo2')!, get('BASS2-B1'))).toBe('Not reported');
  });

  it('retains the reported basis status for numeric values', () => {
    expect(fieldStatus(compareFields.find((field) => field.key === 'o2_initial')!, get('BASS2-B1'))).toBe('Reported · corrected');
    expect(fieldStatus(compareFields.find((field) => field.key === 'o2_initial')!, get('SAFFIRE1-S1'))).toBe('Reported · approximate');
    expect(fieldStatus(compareFields.find((field) => field.key === 'flow_derived')!, get('BASS2-B1'))).toBe('Derived');
  });

  it('leaves string fields without a numeric measurement status', () => {
    expect(fieldStatus(compareFields.find((field) => field.key === 'material')!, get('BASS2-B1'))).toBe('reported');
    expect(fieldDisplay(compareFields.find((field) => field.key === 'material')!, get('BASS2-B1'))).toBe(
      '100 micron PMMA film   2 cm wide',
    );
  });
});

describe('comparability audit', () => {
  it('blocks a direct BASS-II vs Saffire-I comparison', () => {
    const checks = comparabilityAudit([get('BASS2-B1'), get('SAFFIRE1-S1')]);
    const byId = Object.fromEntries(checks.map((check) => [check.id, check]));
    expect(byId.investigation.state).toBe('blocked');
    expect(byId.pressure.state).toBe('unknown');
    expect(byId.gravity.state).toBe('unknown');
    expect(byId.flow.state).toBe('blocked');
    expect(byId.outcome.state).toBe('unknown');
    expect(byId.thickness_mm.state).toBe('blocked');
    expect(byId.width_cm.state).toBe('blocked');
    expect(comparisonBlockerCount(checks)).toBeGreaterThan(5);
  });

  it('still blocks a same-investigation Saffire pair on pressure, gravity and outcome', () => {
    const checks = comparabilityAudit([get('SAFFIRE1-S1'), get('SAFFIRE1-S2')]);
    const byId = Object.fromEntries(checks.map((check) => [check.id, check]));
    expect(byId.investigation.state).toBe('shared');
    expect(byId.material.state).toBe('shared');
    expect(byId.pressure.state).toBe('unknown');
    expect(byId.gravity.state).toBe('unknown');
    expect(byId.outcome.state).toBe('unknown');
    expect(byId.flow_direction.state).toBe('blocked');
    expect(byId.flow_direction.detail).toContain('Concurrent versus Opposed');
    expect(byId.flow.detail).not.toContain('BASS-II');
    expect(byId.oxygen.detail).not.toContain('BASS-II');
    expect(comparisonBlockerCount(checks)).toBe(4);
  });

  it('does not treat investigation-level microgravity as a measured match', () => {
    const checks = comparabilityAudit([get('BASS2-B1'), get('BASS2-B2')]);
    const gravity = checks.find((check) => check.id === 'gravity');
    expect(gravity?.state).toBe('unknown');
    expect(gravity?.detail).toContain('No selected record has a measured g-level');
  });

  it('reports pressure coverage honestly for any selection', () => {
    const checks = comparabilityAudit(records.slice(0, 4));
    expect(checks.find((check) => check.id === 'pressure')?.state).toBe('unknown');
    expect(checks.find((check) => check.id === 'pressure')?.detail).toContain('No selected record reports total pressure');
  });

  it('returns no checks for an empty selection', () => {
    expect(comparabilityAudit([])).toEqual([]);
  });
});


it('flags different BASS film thickness and leaves missing direction unresolved', () => {
  const checks = comparabilityAudit([get('BASS2-B1'), get('BASS2-B2')]);
  expect(checks.find((check) => check.id === 'thickness_mm')?.state).toBe('blocked');
  expect(checks.find((check) => check.id === 'flow_direction')?.state).toBe('partial');
});
