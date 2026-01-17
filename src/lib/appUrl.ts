export function getPublicAppUrl(): string {
  const raw = (import.meta as any).env?.VITE_APP_URL;
  return String(raw || window.location.origin).replace(/\/+$/, '');
}
