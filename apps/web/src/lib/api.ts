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
    let errorMsg = `Request failed with status ${response.status}`;

    if (data?.message) {
      if (Array.isArray(data.message)) {
        errorMsg = data.message.join(', ');
      } else if (typeof data.message === 'object' && data.message.message) {
        errorMsg = data.message.message;
      } else {
        errorMsg = data.message;
      }
    }

    throw new Error(errorMsg);
  }

  return data;
}
