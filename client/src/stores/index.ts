/*
 * Public surface of the Zustand UI-state stores (auth / search / editor).
 * Theme state is intentionally absent — it is owned by F5 (`@/theme`).
 */

export { useAuthStore, useAuthUser, useCanWrite } from './authStore';
export { useSearchStore } from './searchStore';
export { useEditorStore, type EditorBuffer } from './editorStore';
