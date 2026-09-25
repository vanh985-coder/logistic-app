const useProxy = process.env.NEXT_PUBLIC_USE_PROXY === 'true';
export const API_BASE_URL = useProxy
  ? (typeof window !== 'undefined' ? '/api/backend' : (process.env.API_INTERNAL_URL || 'http://localhost:3001'))
  : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

const DEFAULT_TIMEOUT_MS = 8000;

let inMemoryAccessToken: string | null = null;
let tokenRefreshListeners: ((token: string | null) => void)[] = [];
let activeRefreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
  tokenRefreshListeners.forEach((listener) => listener(token));
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function onTokenRefreshed(listener: (token: string | null) => void) {
  tokenRefreshListeners.push(listener);
  return () => {
    tokenRefreshListeners = tokenRefreshListeners.filter((l) => l !== listener);
  };
}

export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit & { _isRetry?: boolean },
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  // Set default timeout to prevent hanging connections
  const timeoutSignal =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
      : undefined;

  const headers: Record<string, string> = {
    ...((options?.headers as Record<string, string>) || {}),
  };

  // Attach auth token from memory if present
  if (inMemoryAccessToken && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  // If body is not FormData, default to application/json
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  if (!isFormData && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    credentials: 'include',
    signal: options?.signal ?? timeoutSignal,
    headers,
    ...options,
  });

  if (endpoint.startsWith('/health')) {
    const json = await res.json();
    return json as T;
  }

  // Handle 401 Unauthorized with single-flight token refresh retry
  if (res.status === 401 && !options?._isRetry && !endpoint.startsWith('/auth/')) {
    if (!activeRefreshPromise) {
      activeRefreshPromise = (async () => {
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newToken = refreshData.accessToken;
            if (newToken) {
              setAccessToken(newToken);
              return newToken;
            }
          }
          setAccessToken(null);
          return null;
        } catch {
          setAccessToken(null);
          return null;
        } finally {
          activeRefreshPromise = null;
        }
      })();
    }

    const newToken = await activeRefreshPromise;
    if (newToken) {
      return fetchApi<T>(endpoint, {
        ...options,
        _isRetry: true,
        headers: {
          ...headers,
          Authorization: `Bearer ${newToken}`,
        },
      });
    }
  }

  if (!res.ok) {
    let errorDetail: string;
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.message || errorJson.error || JSON.stringify(errorJson);
    } catch {
      errorDetail = `${res.status} ${res.statusText}`;
    }

    if (res.status === 403) {
      errorDetail =
        'Bạn không có quyền thực hiện thao tác này. Vui lòng liên hệ quản trị viên hoặc đăng nhập bằng tài khoản có quyền phù hợp.';
    }

    const err = new Error(errorDetail);
    (err as any).status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}
