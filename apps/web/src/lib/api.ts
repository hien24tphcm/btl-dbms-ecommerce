const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function apiFetch<T = any>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    cache: 'no-store',
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      data?.message ||
      `HTTP ${res.status}: Request to ${endpoint} failed`;
    const err: any = new Error(msg);
    err.statusCode = res.status;
    err.errorCode = data?.errorCode;
    err.sqlErrorNumber = data?.sqlErrorNumber;
    throw err;
  }
  return data as T;
}
