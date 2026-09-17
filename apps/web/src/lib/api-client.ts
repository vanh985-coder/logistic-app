const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const DEFAULT_TIMEOUT_MS = 8000;

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

  // Attach auth token from localStorage (fallback to sessionStorage) if present
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (token && !headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }
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

  // Handle 401 Unauthorized with token refresh retry
  if (res.status === 401 && !options?._isRetry && !endpoint.startsWith('/auth/')) {
    try {
      const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const newToken = refreshData.accessToken;
        if (newToken && typeof window !== 'undefined') {
          localStorage.setItem('accessToken', newToken);
          sessionStorage.setItem('accessToken', newToken);

          // Retry original request with new token
          return fetchApi<T>(endpoint, {
            ...options,
            _isRetry: true,
            headers: {
              ...headers,
              Authorization: `Bearer ${newToken}`,
            },
          });
        }
      } else {
        // Refresh failed, clear session
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          sessionStorage.clear();
        }
      }
    } catch {
      // ignore refresh error and let original 401 throw
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
    throw new Error(errorDetail);
  }

  return res.json() as Promise<T>;
}
