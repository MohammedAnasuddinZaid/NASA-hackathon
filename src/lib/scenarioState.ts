import { defaultScenario, validateScenario } from './scenario';
import type { Scenario } from './scenario';
const KEY = 'firetrace-scenario-v1';
export interface PlannerState {
  scenario: Scenario;
  selected: string[];
}
export function decodePlannerState(raw: string | null): PlannerState {
  const empty = { scenario: { ...defaultScenario }, selected: [] };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.scenario || Object.keys(defaultScenario).some((key) => !(key in parsed.scenario)))
      return empty;
    const scenario = Object.fromEntries(
      Object.keys(defaultScenario).map((key) => [key, parsed.scenario[key]]),
    ) as unknown as Scenario;
    if (validateScenario(scenario).length) return empty;
    return {
      scenario,
      selected: Array.isArray(parsed.selected)
        ? ([
            ...new Set(
              parsed.selected.filter(
                (id: unknown): id is string =>
                  typeof id === 'string' && /^(BASS2|SAFFIRE1)-[A-Za-z0-9]+$/.test(id),
              ),
            ),
          ].slice(0, 4) as string[])
        : [],
    };
  } catch {
    return empty;
  }
}
export function loadPlannerState(): PlannerState {
  try {
    return decodePlannerState(sessionStorage.getItem(KEY));
  } catch {
    return decodePlannerState(null);
  }
}
export function savePlannerState(state: PlannerState): boolean {
  if (validateScenario(state.scenario).length) return false;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
