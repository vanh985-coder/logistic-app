'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '../lib/api-client';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: string;
  companyId: string;
  companyName: string;
}

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (accessToken: string, user: AuthUser) => void;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize auth from localStorage, and attempt refresh if needed
  const initAuth = useCallback(async () => {
    try {
      if (typeof window === 'undefined') return;

      const storedToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      const storedUserStr = localStorage.getItem('user') || sessionStorage.getItem('user');

      if (storedToken && storedUserStr) {
        try {
          const parsedUser = JSON.parse(storedUserStr);
          setUser(parsedUser);
          setAccessToken(storedToken);
          // ensure synchronized across storage
          localStorage.setItem('accessToken', storedToken);
          localStorage.setItem('user', storedUserStr);
          setIsLoading(false);
          return;
        } catch {
          // invalid stored json
        }
      }

      // If no valid stored token, try refreshing session via httpOnly cookie
      const res = await fetchApi<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
      }).catch(() => null);

      if (res?.accessToken) {
        localStorage.setItem('accessToken', res.accessToken);
        sessionStorage.setItem('accessToken', res.accessToken);
        setAccessToken(res.accessToken);

        // Fetch current user info
        const me = await fetchApi<{
          id: string;
          email: string;
          fullName: string;
          phone?: string | null;
          role: string;
          company: { id: string; name: string; type: string };
        }>('/auth/me').catch(() => null);

        if (me) {
          const authUser: AuthUser = {
            id: me.id,
            email: me.email,
            fullName: me.fullName,
            phone: me.phone,
            role: me.role,
            companyId: me.company?.id,
            companyName: me.company?.name,
          };
          localStorage.setItem('user', JSON.stringify(authUser));
          sessionStorage.setItem('user', JSON.stringify(authUser));
          setUser(authUser);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = useCallback((token: string, newUser: AuthUser) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', token);
      localStorage.setItem('user', JSON.stringify(newUser));
      sessionStorage.setItem('accessToken', token);
      sessionStorage.setItem('user', JSON.stringify(newUser));
    }
    setAccessToken(token);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      sessionStorage.clear();
    }
    setAccessToken(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetchApi<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
      });
      if (res.accessToken) {
        localStorage.setItem('accessToken', res.accessToken);
        sessionStorage.setItem('accessToken', res.accessToken);
        setAccessToken(res.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isLoading,
      isAuthenticated: !!user && !!accessToken,
      login,
      logout,
      refreshAuth,
    }),
    [user, accessToken, isLoading, login, logout, refreshAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
