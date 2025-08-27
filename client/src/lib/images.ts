export function resolveImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  try {
    // si absolue, on ne garde que le pathname -> redevient relative
    const u = new URL(url, window.location.origin);
    return u.pathname.startsWith("/") ? u.pathname : `/${u.pathname}`;
  } catch {
    // déjà relative
    return url.startsWith("/") ? url : `/${url}`;
  }
}