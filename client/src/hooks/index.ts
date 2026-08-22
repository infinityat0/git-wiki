/*
 * Public surface of the React Query hooks. Downstream U* tasks import their
 * data needs from here: `import { useTree, useDoc, deriveAsyncStatus } from '@/hooks'`.
 */

export { queryKeys } from './queryKeys';
export {
  deriveAsyncStatus,
  isTreeEmpty,
  isSearchEmpty,
  isHistoryEmpty,
  type AsyncState,
  type AsyncStatus,
} from './status';

export { useHealth } from './useHealth';
export { useAuthMe } from './useAuthMe';
export { useTree } from './useTree';
export { useDoc } from './useDoc';
export { useHistory } from './useHistory';
export { useSearch } from './useSearch';
export { useSync } from './useSync';
export { useHydrateAuth } from './useHydrateAuth';
