export function b64url(s: string) {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/,"");
}

export function resolveImageUrl(input?: string | null): string {
  if (!input) return "";
  if (/^(https?:\/\/|data:)/i.test(input)) return input;
  if (input.startsWith("/uploads/")) return input;
  return `/api/r2/object/${b64url(input)}`;
}
