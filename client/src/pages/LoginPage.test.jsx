import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../state/AuthContext.jsx';
import { ToastProvider } from '../state/ToastContext.jsx';
import LoginPage from './LoginPage.jsx';

function renderLoginPage() {
  return render(<ToastProvider><AuthProvider><LoginPage /></AuthProvider></ToastProvider>);
}

vi.mock('../api/client.js', () => ({
  api: vi.fn(),
  ApiError: class ApiError extends Error {},
  OfflineError: class OfflineError extends Error {}
}));

import { api } from '../api/client.js';

describe('LoginPage', () => {
  beforeEach(() => {
    api.mockReset();
    api.mockImplementation((path) => {
      if (path === '/auth/me') return Promise.resolve({ oauthEnabled: false });
      if (path === '/auth/dev-login') return Promise.resolve({ email: 'op@example.com', role: 'OPERATOR' });
      return Promise.reject(new Error(`unexpected call to ${path}`));
    });
  });

  it('shows the local dev sign-in form when OAuth is not configured', async () => {
    renderLoginPage();
    await waitFor(() => expect(screen.getByLabelText(/Email/)).toBeInTheDocument());
    expect(screen.queryByText(/Sign in with Google/)).not.toBeInTheDocument();
  });

  it('submits the dev-login form and calls the API with the chosen role', async () => {
    renderLoginPage();
    await waitFor(() => screen.getByLabelText(/Email/));
    fireEvent.change(screen.getByLabelText(/Role/), { target: { value: 'ADMIN' } });
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/auth/dev-login', expect.objectContaining({ body: expect.objectContaining({ role: 'ADMIN' }) })));
  });
});
