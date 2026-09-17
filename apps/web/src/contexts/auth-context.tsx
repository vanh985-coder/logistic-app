'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi, setAccessToken as setApiClientToken, onTokenRefreshed } from '../lib/api-client';

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

  // Synchronize in-memory token between api-client and React state
  const handleUpdateToken = useCallback((token: string | null) => {
    setAccessToken(token);
    setApiClientToken(token);
  }, []);

  useEffect(() => {
    const unsubscribe = onTokenRefreshed((newToken) => {
      setAccessToken(newToken);
    });
    return unsubscribe;
  }, []);

  // Restore session exclusively via httpOnly cookie on startup / F5 / new tab
  const initAuth = useCallback(async () => {
    try {
      // Clear any legacy storage artifacts to prevent XSS exposure
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
      }

      // 1. Call /auth/refresh: browser automatically sends httpOnly sameSite=strict refreshToken cookie
      const refreshRes = await fetchApi<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
      }).catch(() => null);

      if (refreshRes?.accessToken) {
        handleUpdateToken(refreshRes.accessToken);

        // 2. Fetch current user profile using the new in-memory accessToken
        const me = await fetchApi<{
          id: string;
          email: string;
          fullName: string;
          phone?: string | null;
          role: string;
          company: { id: string; name: string; type: string };
        }>('/auth/me', {
          headers: {
            Authorization: `Bearer ${refreshRes.accessToken}`,
          },
        }).catch(() => null);

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
          setUser(authUser);
        } else {
          handleUpdateToken(null);
          setUser(null);
        }
      } else {
        handleUpdateToken(null);
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [handleUpdateToken]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = useCallback((token: string, newUser: AuthUser) => {
    handleUpdateToken(token);
    setUser(newUser);
  }, [handleUpdateToken]);

  const logout = useCallback(async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    handleUpdateToken(null);
    setUser(null);
    router.push('/login');
  }, [handleUpdateToken, router]);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetchApi<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
      });
      if (res?.accessToken) {
        handleUpdateToken(res.accessToken);
        return true;
      }
      return false;
    } catch {
      handleUpdateToken(null);
      setUser(null);
      return false;
    }
  }, [handleUpdateToken]);

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
