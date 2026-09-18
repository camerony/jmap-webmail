import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ login: vi.fn(), loginWithToken: vi.fn(async () => true), clearError: vi.fn(), push: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/stores/auth-store', () => ({ useAuthStore: () => ({ ...mocks, isLoading: false, error: null, isAuthenticated: false }) }));
vi.mock('@/hooks/use-config', () => ({ useConfig: () => ({ appName: 'Webmail', jmapServerUrl: 'https://api.fastmail.com', tokenAuthEnabled: true, oauthEnabled: false, oauthOnly: false, isLoading: false }) }));
import LoginPage from '../[locale]/login/page';
describe('token sign-in page', () => {
  it('replaces password sign-in and submits the personal token', async () => {
    render(<LoginPage />);
    expect(screen.queryByPlaceholderText('username_placeholder')).toBeNull();
    expect(screen.queryByPlaceholderText('password_placeholder')).toBeNull();
    const field = screen.getByLabelText('token_label');
    expect(field).toHaveAttribute('type', 'password');
    fireEvent.change(field, { target: { value: 'personal-token' } });
    fireEvent.click(screen.getByRole('button', { name: 'sign_in' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/'));
    expect(mocks.loginWithToken).toHaveBeenCalledWith('https://api.fastmail.com', 'personal-token');
    expect(mocks.login).not.toHaveBeenCalled();
    expect(field).toHaveValue('');
  });
});
