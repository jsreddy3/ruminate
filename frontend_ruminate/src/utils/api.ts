// Authenticated API utility
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('auth_token');
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

export { API_BASE_URL };