import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  connect: vi.fn(), disconnect: vi.fn(), getUsername: () => 'user@fastmail.com',
  getIdentities: vi.fn(async () => []), supportsContacts: () => false,
  supportsVacationResponse: () => false, supportsCalendars: () => false, supportsSieve: () => false,
}));
vi.mock('@/lib/jmap/client', () => ({ JMAPClient: { withBearer: vi.fn(() => client) } }));
vi.mock('../email-store', () => ({ useEmailStore: { setState: vi.fn() } }));
vi.mock('../identity-store', () => ({ useIdentityStore: { getState: () => ({
  setIdentities: vi.fn(), loadAccountIdentities: vi.fn(async () => {}), clearIdentities: vi.fn(),
}) } }));
vi.mock('../contact-store', () => ({ useContactStore: { getState: () => ({ setSupportsSync: vi.fn(), clearContacts: vi.fn() }) } }));
vi.mock('../vacation-store', () => ({ useVacationStore: { getState: () => ({ setSupported: vi.fn(), clearState: vi.fn() }) } }));
vi.mock('../calendar-store', () => ({ useCalendarStore: { getState: () => ({ clearState: vi.fn() }) } }));
vi.mock('../filter-store', () => ({ useFilterStore: { getState: () => ({ clearState: vi.fn() }) } }));
import { useAuthStore } from '../auth-store';
import { JMAPClient } from '@/lib/jmap/client';

const server = 'https://api.fastmail.com';
describe('JMAP token login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.connect.mockResolvedValue(undefined);
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    useAuthStore.setState({ isAuthenticated: false, client: null, authMode: 'basic',
      serverUrl: null, accessToken: null, rememberMe: false, error: null });
  });

  it('uses bearer auth without OAuth and stores the token only in sessionStorage', async () => {
    expect(await useAuthStore.getState().loginWithToken(server, ' secret-token ')).toBe(true);
    expect(JMAPClient.withBearer).toHaveBeenCalledWith(server, 'secret-token', '');
    expect(fetch).not.toHaveBeenCalled();
    expect(useAuthStore.getState().authMode).toBe('token');
    expect(localStorage.getItem('auth-storage')).not.toContain('secret-token');
    expect(JSON.parse(sessionStorage.getItem('jmap_token_session')!).token).toBe('secret-token');
    expect(await useAuthStore.getState().refreshAccessToken()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('restores a token session after reload without calling OAuth', async () => {
    await useAuthStore.getState().loginWithToken(server, 'secret-token');
    useAuthStore.setState({ client: null, accessToken: null });
    await useAuthStore.getState().checkAuth();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().client).toBe(client);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects invalid tokens and clears stored credentials', async () => {
    client.connect.mockRejectedValue(new Error('Authentication failed - token may be expired'));
    expect(await useAuthStore.getState().loginWithToken(server, 'bad-token')).toBe(false);
    expect(useAuthStore.getState().error).toBe('invalid_token');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(sessionStorage.getItem('jmap_token_session')).toBeNull();
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('requires sign-in if the session belongs to a different server', async () => {
    useAuthStore.setState({ authMode: 'token', serverUrl: server, isAuthenticated: true });
    sessionStorage.setItem('jmap_token_session', JSON.stringify({ serverUrl: 'https://other.example', token: 'secret' }));
    await useAuthStore.getState().checkAuth();
    expect(JMAPClient.withBearer).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(sessionStorage.getItem('jmap_token_session')).toBeNull();
  });

  it('clears the token on logout without OAuth revocation', async () => {
    await useAuthStore.getState().loginWithToken(server, 'secret-token');
    useAuthStore.getState().logout();
    expect(sessionStorage.getItem('jmap_token_session')).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/auth/session', { method: 'DELETE' });
  });
});
