/*
 * Editor UI state — v1 STUB (ADR-0004).
 *
 * v0 is read-only; editing lands in M5. This slice is scaffolded now so the
 * data-layer shape is frozen for downstream consumers, but it only tracks
 * unsaved buffers in memory (no persistence, no save transport yet). A buffer
 * is "dirty" when its working `draft` diverges from the `baseline` it opened
 * from — enough to later warn on navigation away from unsaved changes.
 */

import { create } from 'zustand';

/** An open edit buffer for a single document path. */
export interface EditorBuffer {
  /** Content as last loaded/saved — the clean reference. */
  baseline: string;
  /** Current working content. */
  draft: string;
}

interface EditorState {
  /** Path of the document currently focused in the editor, or `null`. */
  activePath: string | null;
  /** Open buffers keyed by document path. */
  buffers: Record<string, EditorBuffer>;
  /** Open (or focus) a buffer, seeding its baseline from loaded content. */
  openBuffer: (path: string, content: string) => void;
  /** Update the working draft for a path. No-op if the buffer is not open. */
  setDraft: (path: string, draft: string) => void;
  /** Mark a buffer saved: baseline := draft (clears dirty). */
  markSaved: (path: string) => void;
  /** Close a buffer, discarding its draft. */
  closeBuffer: (path: string) => void;
  /** True when the path's draft diverges from its baseline. */
  isDirty: (path: string) => boolean;
  /** True when any open buffer has unsaved changes. */
  hasUnsavedChanges: () => boolean;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  activePath: null,
  buffers: {},
  openBuffer: (path, content) =>
    set((s) => ({
      activePath: path,
      buffers: {
        ...s.buffers,
        // Preserve an existing draft if the buffer is already open.
        [path]: s.buffers[path] ?? { baseline: content, draft: content },
      },
    })),
  setDraft: (path, draft) =>
    set((s) => {
      const buffer = s.buffers[path];
      if (!buffer) return s;
      return { buffers: { ...s.buffers, [path]: { ...buffer, draft } } };
    }),
  markSaved: (path) =>
    set((s) => {
      const buffer = s.buffers[path];
      if (!buffer) return s;
      return {
        buffers: {
          ...s.buffers,
          [path]: { ...buffer, baseline: buffer.draft },
        },
      };
    }),
  closeBuffer: (path) =>
    set((s) => {
      if (!(path in s.buffers)) return s;
      const next = { ...s.buffers };
      delete next[path];
      return {
        buffers: next,
        activePath: s.activePath === path ? null : s.activePath,
      };
    }),
  isDirty: (path) => {
    const buffer = get().buffers[path];
    return buffer ? buffer.draft !== buffer.baseline : false;
  },
  hasUnsavedChanges: () =>
    Object.values(get().buffers).some((b) => b.draft !== b.baseline),
}));
