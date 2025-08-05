// Authenticated API utility
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Event emitter for auth events
export const authEvents = new EventTarget();

export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('auth_token');
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Check for 401 Unauthorized
  if (response.status === 401) {
    // Dispatch custom event for 401 error
    authEvents.dispatchEvent(new CustomEvent('unauthorized', {
      detail: { url, timestamp: new Date().toISOString() }
    }));
  }

  return response;
}

export { API_BASE_URL };