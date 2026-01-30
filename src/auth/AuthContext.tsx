import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { me as meApi } from '../api/auth';

import type { MeResponse } from '../api/types';

type AuthContextValue = {
  token: string | null;
  user: MeResponse | null;
  loading: boolean;
  setToken: (t: string | null) => void;
  logout: () => void;
  refreshMe: () => Promise<MeResponse>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const data = await meApi();
        if (!cancelled) {
          setUser(data);
        }
      } catch (e) {
        if (!cancelled) {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      setToken: (t: string | null) => {
        if (t) {
          localStorage.setItem('token', t);
        } else {
          localStorage.removeItem('token');
        }
        setToken(t);
      },
      logout: () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      },
      refreshMe: async () => {
        const data = await meApi();
        setUser(data);
        return data;
      },
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('AuthProvider missing');
  }
  return ctx;
}
