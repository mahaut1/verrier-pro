const IMG_PROXY = "/api/r2/object/";

function b64url(s: string) {
  const b64 = btoa(unescape(encodeURIComponent(s)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/,"");
}

function extractR2KeyFromUrl(u: URL): string | null {
  const host = u.hostname;
  if (!/\br2\.(dev|cloudflarestorage\.com)$/.test(host)) return null;

  const path = u.pathname.replace(/^\/+/, ""); // ex: "verrierpro/pieces/3/x.jpg" ou "pieces/3/x.jpg"
  if (!path) return null;

  const maybe = path.startsWith("verrierpro/") ? path.replace(/^verrierpro\//, "") : path;
  return maybe; 
}

export function resolveImageUrl(input?: string | null): string {
  if (!input) return "";

  if (input.startsWith(IMG_PROXY)) return input;

  if (input.startsWith("data:")) return input;

  if (/^https?:\/\//i.test(input)) {
    try {
      const u = new URL(input);
      const key = extractR2KeyFromUrl(u);
      if (key) return IMG_PROXY + b64url(key);
    } catch {
    }
    return input; 
  }

  if (input.startsWith("/uploads/")) return input;

  if (input.startsWith("/")) {
    const maybe = input.replace(/^\/+/, "");
    if (maybe.startsWith("pieces/") || maybe.startsWith("verrierpro/pieces/")) {
      const key = maybe.replace(/^verrierpro\//, "");
      return IMG_PROXY + b64url(key);
    }
    return input;
  }

  return IMG_PROXY + b64url(input);
}
