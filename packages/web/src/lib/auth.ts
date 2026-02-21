export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('useai_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function logout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('useai_token');
  localStorage.removeItem('useai_user');
  window.location.href = '/login';
}
