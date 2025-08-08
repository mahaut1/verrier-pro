// client/src/lib/useAuth.ts
import { useEffect, useState, useCallback } from 'react';

type Role = 'admin' | 'artisan' | 'client';
export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  createdAt: string;
}

type RegisterBody = {
  username: string;
  password: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: Role;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include', // 🔑 indispensable pour la session
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  // si Express renvoie HTML (index.html), on le détecte et on crie
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await res.text();
    throw new Error(`Réponse non-JSON (proxy Vite ?) -> ${res.status} ${res.statusText}\n${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as T;
  if (!res.ok) {
    // @ts-ignore – on tente d’extraire "message"
    throw new Error((data?.message as string) || `HTTP ${res.status}`);
  }
  return data;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const me = useCallback(async () => {
    try {
      setError(null);
      const u = await api<User>('/api/auth/user');
      setUser(u);
      return u;
    } catch (e: any) {
      setUser(null);
      // 401 en non connecté = normal
      if (!String(e.message).includes('401')) setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (body: RegisterBody) => {
    setError(null);
    const u = await api<User>('/api/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setUser(u);
    return u;
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    const u = await api<User>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    await api<{ message: string }>('/api/logout', { method: 'POST' });
    setUser(null);
  }, []);

  useEffect(() => {
    me();
  }, [me]);

  return { user, loading, error, register, login, logout, refresh: me };
}
