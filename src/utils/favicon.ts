export function applyFavicon(url: string | null | undefined) {
  const clean = url && url.trim() ? url.trim() : '';
  if (!clean) return;
  const bust = localStorage.getItem('systemFaviconBust');
  const withBust = bust ? `${clean}${clean.includes('?') ? '&' : '?'}v=${encodeURIComponent(bust)}` : clean;
  const existing = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (existing) {
    existing.href = withBust;
    return;
  }
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = withBust;
  document.head.appendChild(link);
}
