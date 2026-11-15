import { records, recordById } from './corpus';
import type { RecordAccess } from './scenario';
/** Local adapter; future API integration must preserve corpus identity and source semantics. */
export const scenarioAccess: RecordAccess = {
  all: () => records,
  find: (id) => recordById.get(id),
};
