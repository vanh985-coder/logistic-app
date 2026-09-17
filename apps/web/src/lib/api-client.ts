const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const DEFAULT_TIMEOUT_MS = 8000;

export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
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

  // Attach auth token from sessionStorage if present
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('accessToken');
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
