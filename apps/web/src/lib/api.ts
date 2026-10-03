const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.message
      ? Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message
      : `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}
