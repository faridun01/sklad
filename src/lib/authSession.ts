import { User } from '../core/domain';

type LoginResponse = {
  token: string;
  user: User;
};

export const getStoredAuthUser = (): User | null => {
  const saved = window.sessionStorage.getItem('sklad_user');
  if (!saved) return null;

  try {
    return JSON.parse(saved) as User;
  } catch {
    return null;
  }
};

export const clearStoredAuthSession = () => {
  window.sessionStorage.removeItem('sklad_token');
  window.sessionStorage.removeItem('sklad_user');
  window.localStorage.removeItem('sklad_token');
};

export const loginWithPassword = async (login: string, password: string): Promise<LoginResponse> => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || (response.status === 401 ? 'Invalid credentials' : 'Login failed'));
  }

  const data = payload as LoginResponse;
  window.sessionStorage.setItem('sklad_token', data.token);
  window.sessionStorage.setItem('sklad_user', JSON.stringify(data.user));
  window.localStorage.setItem('sklad_token', data.token);
  return data;
};

export const restoreSession = async (): Promise<User | null> => {
  const token = window.localStorage.getItem('sklad_token');
  if (!token) return null;
  
  try {
    const response = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const user = await response.json();
      window.sessionStorage.setItem('sklad_user', JSON.stringify(user));
      window.sessionStorage.setItem('sklad_token', token);
      return user;
    } else {
      clearStoredAuthSession();
      return null;
    }
  } catch {
    return null;
  }
};