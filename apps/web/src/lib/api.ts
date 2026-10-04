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

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  } catch {
    throw new Error('Cannot connect right now. Check your connection and try again.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(endpoint === '/auth/login' ? 'That email or password did not work. Please try again.' : 'Your session has ended. Sign in again to continue.');
    }
    if (response.status === 403) throw new Error('You do not have access to do that.');
    if (response.status >= 500) throw new Error('Something went wrong on our side. Please try again shortly.');

    let errorMsg = 'We could not complete that request. Please check the details and try again.';

    if (data?.message) {
      if (Array.isArray(data.message)) {
        errorMsg = data.message.join(', ');
      } else if (typeof data.message === 'object' && data.message.message) {
        errorMsg = data.message.message;
      } else {
        errorMsg = String(data.message);
      }
    }

    if (/\b(P\d{4}|Prisma|SQL|database constraint|property \w+ should not exist|must be a UUID)\b/i.test(errorMsg)) {
      errorMsg = 'Some details are missing or invalid. Check your entries and try again.';
    }

    throw new Error(errorMsg);
  }

  return data;
}
