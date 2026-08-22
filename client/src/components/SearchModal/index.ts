/*
 * Public surface of the U4 search modal. The integrator mounts a single
 * `<SearchModal/>` once near the app root (inside the router + DataProvider so
 * `useNavigate`, `useSearch`, and `useHealth` resolve); it self-manages
 * visibility from the U4 `useSearchStore`:
 *   `import SearchModal from '../components/SearchModal'`  (or the named export).
 */

export { SearchModal, default } from './SearchModal.js';
export { renderSnippet } from './highlight.js';
