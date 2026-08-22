import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthMe, SessionUser } from '@wiki/contracts';
import { useAuthStore } from './authStore';
import { useSearchStore } from './searchStore';
import { useEditorStore } from './editorStore';

const writer: SessionUser = {
  name: 'Engineer',
  email: 'eng@example.com',
  provider: 'github',
  canWrite: true,
};

describe('authStore', () => {
  beforeEach(() => useAuthStore.getState().clear());

  it('hydrates user + canWrite from an authenticated AuthMe', () => {
    const authMe: AuthMe = { authenticated: true, user: writer };
    useAuthStore.getState().setFromAuthMe(authMe);
    const s = useAuthStore.getState();
    expect(s.authenticated).toBe(true);
    expect(s.user?.canWrite).toBe(true);
  });

  it('stores no user for an unauthenticated AuthMe', () => {
    useAuthStore.getState().setFromAuthMe({ authenticated: false });
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('clear() drops the session', () => {
    useAuthStore
      .getState()
      .setFromAuthMe({ authenticated: true, user: writer });
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().authenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe('searchStore', () => {
  beforeEach(() => useSearchStore.setState({ open: false }));

  it('opens, closes, and toggles', () => {
    const { openSearch, closeSearch, toggleSearch } = useSearchStore.getState();
    openSearch();
    expect(useSearchStore.getState().open).toBe(true);
    closeSearch();
    expect(useSearchStore.getState().open).toBe(false);
    toggleSearch();
    expect(useSearchStore.getState().open).toBe(true);
  });
});

describe('editorStore (v1 stub)', () => {
  beforeEach(() => useEditorStore.setState({ activePath: null, buffers: {} }));

  it('opens a buffer clean and tracks dirtiness on edit', () => {
    const store = useEditorStore.getState();
    store.openBuffer('a.md', 'hello');
    expect(useEditorStore.getState().activePath).toBe('a.md');
    expect(useEditorStore.getState().isDirty('a.md')).toBe(false);

    store.setDraft('a.md', 'hello world');
    expect(useEditorStore.getState().isDirty('a.md')).toBe(true);
    expect(useEditorStore.getState().hasUnsavedChanges()).toBe(true);
  });

  it('markSaved clears dirtiness', () => {
    const store = useEditorStore.getState();
    store.openBuffer('a.md', 'hello');
    store.setDraft('a.md', 'changed');
    store.markSaved('a.md');
    expect(useEditorStore.getState().isDirty('a.md')).toBe(false);
  });

  it('re-opening an already-open buffer preserves its draft', () => {
    const store = useEditorStore.getState();
    store.openBuffer('a.md', 'hello');
    store.setDraft('a.md', 'edited');
    store.openBuffer('a.md', 'hello'); // e.g. re-focus
    expect(useEditorStore.getState().buffers['a.md'].draft).toBe('edited');
  });

  it('closeBuffer discards the draft and clears activePath', () => {
    const store = useEditorStore.getState();
    store.openBuffer('a.md', 'hello');
    store.closeBuffer('a.md');
    const s = useEditorStore.getState();
    expect(s.buffers['a.md']).toBeUndefined();
    expect(s.activePath).toBeNull();
    expect(s.hasUnsavedChanges()).toBe(false);
  });
});
