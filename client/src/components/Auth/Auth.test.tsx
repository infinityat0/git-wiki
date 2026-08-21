// @vitest-environment jsdom
/**
 * U7 — auth UI behaviour (Design.md §5; features spec §5/§10/§12; ADR-0005).
 *
 * The API client (F6) is mocked so wiring can be asserted in isolation; the
 * real F6 auth store is used (we assert its resulting state). `import.meta.env`
 * is stubbed per test to exercise the dev-mode vs production redirect branches,
 * and `window.location` is replaced so redirects are observable without real
 * navigation.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type Mock,
} from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import type { SessionUser } from '@wiki/contracts';

const mocks = vi.hoisted(() => ({
  devLogin: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../../api/index.js', () => ({
  apiClient: { devLogin: mocks.devLogin, logout: mocks.logout },
}));

import { SignInGate } from './SignInGate.js';
import SignInGateDefault from './SignInGate.js';
import { UserChip } from './UserChip.js';
import UserChipDefault from './UserChip.js';
import { IfCanWrite } from './IfCanWrite.js';
import IfCanWriteDefault from './IfCanWrite.js';
import { useAuthStore } from '../../stores/index.js';

const githubUser: SessionUser = {
  name: 'Ada Lovelace',
  email: 'ada@tapestry.app',
  provider: 'github',
  canWrite: true,
};

const firebaseUser: SessionUser = {
  name: 'Reed Only',
  email: 'reed@tapestry.app',
  provider: 'firebase',
  canWrite: false,
};

const originalLocation = window.location;

function mockLocation(href = 'https://wiki.test/docs/page') {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { href, assign: vi.fn() },
  });
}

function locationAssign(): Mock {
  return window.location.assign as unknown as Mock;
}

beforeEach(() => {
  mocks.devLogin.mockReset();
  mocks.logout.mockReset();
  useAuthStore.getState().clear();
  mockLocation();
  vi.stubEnv('VITE_SSO_LOGIN_URL', 'https://sso.test/login');
  vi.stubEnv('VITE_AUTH_DEV_MODE', 'false');
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

describe('SignInGate — production redirect', () => {
  test('shows a "Redirecting to sign-in…" state and redirects to the SSO URL', () => {
    render(<SignInGate />);

    expect(screen.getByText('Redirecting to sign-in…')).toBeTruthy();
    // No provider buttons and no dev card in production (Design §5).
    expect(screen.queryByText('Development sign-in')).toBeNull();

    const link = screen.getByRole('link', {
      name: 'Continue to sign-in',
    }) as HTMLAnchorElement;
    expect(link.href).toContain('https://sso.test/login');
    expect(link.href).toContain(
      encodeURIComponent('https://wiki.test/docs/page'),
    );

    // The effect fires the automatic redirect to the same URL.
    expect(locationAssign()).toHaveBeenCalledTimes(1);
    expect(locationAssign().mock.calls[0][0]).toContain(
      'https://sso.test/login',
    );
  });
});

describe('SignInGate — dev sign-in card', () => {
  test('renders only when dev mode is enabled and posts the entered credentials', async () => {
    vi.stubEnv('VITE_AUTH_DEV_MODE', 'true');
    mocks.devLogin.mockResolvedValue({ success: true, user: githubUser });
    const onSignedIn = vi.fn();

    render(<SignInGate onSignedIn={onSignedIn} />);

    // Dev card present; production redirect absent.
    expect(screen.getByText('Development sign-in')).toBeTruthy();
    expect(screen.queryByText('Redirecting to sign-in…')).toBeNull();

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'dev' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(mocks.devLogin).toHaveBeenCalledWith({
        username: 'dev',
        password: 'secret',
      }),
    );

    // On success the auth store is hydrated and the callback fires.
    await waitFor(() =>
      expect(useAuthStore.getState().authenticated).toBe(true),
    );
    expect(useAuthStore.getState().user).toEqual(githubUser);
    expect(onSignedIn).toHaveBeenCalledTimes(1);
    // Dev sign-in must never trigger an SSO redirect.
    expect(locationAssign()).not.toHaveBeenCalled();
  });

  test('renders an inline error when dev sign-in fails (features spec §10)', async () => {
    vi.stubEnv('VITE_AUTH_DEV_MODE', 'true');
    mocks.devLogin.mockRejectedValue(new Error('Invalid credentials'));

    render(<SignInGate />);
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'dev' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Invalid credentials');
    expect(useAuthStore.getState().authenticated).toBe(false);
  });

  test('is absent when dev mode is off (production build safety)', () => {
    render(<SignInGate />);
    expect(screen.queryByText('Development sign-in')).toBeNull();
  });
});

describe('UserChip', () => {
  test('renders nothing without a session user', () => {
    const { container } = render(<UserChip />);
    expect(container.firstChild).toBeNull();
  });

  test('shows the user and logs out via /api/auth/logout, following the redirect', async () => {
    useAuthStore.getState().setFromAuthMe({
      authenticated: true,
      user: githubUser,
    });
    mocks.logout.mockResolvedValue({
      success: true,
      redirect: 'https://sso.test/logout',
    });

    render(<UserChip />);
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(locationAssign()).toHaveBeenCalledWith('https://sso.test/logout'),
    );
    // The cached session is cleared on logout.
    expect(useAuthStore.getState().authenticated).toBe(false);
  });
});

describe('IfCanWrite', () => {
  test('hides children for a read-only (firebase) session', () => {
    useAuthStore.getState().setFromAuthMe({
      authenticated: true,
      user: firebaseUser,
    });
    render(
      <IfCanWrite>
        <button type="button">Edit</button>
      </IfCanWrite>,
    );
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  test('renders children for a writer (github) session', () => {
    useAuthStore.getState().setFromAuthMe({
      authenticated: true,
      user: githubUser,
    });
    render(
      <IfCanWrite>
        <button type="button">Edit</button>
      </IfCanWrite>,
    );
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  test('renders the fallback for a read-only session when provided', () => {
    useAuthStore.getState().setFromAuthMe({
      authenticated: true,
      user: firebaseUser,
    });
    render(
      <IfCanWrite fallback={<span>read-only</span>}>
        <button type="button">Edit</button>
      </IfCanWrite>,
    );
    expect(screen.getByText('read-only')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });
});

describe('exports', () => {
  test('each component is exported as both default and named', () => {
    expect(SignInGateDefault).toBe(SignInGate);
    expect(UserChipDefault).toBe(UserChip);
    expect(IfCanWriteDefault).toBe(IfCanWrite);
  });
});
