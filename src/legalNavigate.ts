/** Client-side navigation for standalone legal routes (no react-router). */
export function navigateTo(path: string): void {
  const normalized = path.replace(/\/+$/, '') || '/';
  window.history.pushState({}, '', normalized);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function goHome(): void {
  navigateTo('/');
}
