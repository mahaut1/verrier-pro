export type ResolveImageOpts = {
  base?: string;
  absolute?: boolean;
};

export function resolveImageUrl(
  input?: string | null,
  opts?: ResolveImageOpts
): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  // Déjà absolue (http, https, data:)
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;

  // Chemin relatif => garantir le slash initial
  const rel = raw.startsWith("/") ? raw : `/${raw}`;

  // Côté serveur (ou quand on veut stocker/retourner du relatif)
  if (opts?.absolute === false) return rel;

  // Côté client : si une base est fournie, construire l’URL absolue
  const base = opts?.base;
  if (!base) return rel;

  try {
    return new URL(rel, base).toString();
  } catch {
    return rel;
  }
}
