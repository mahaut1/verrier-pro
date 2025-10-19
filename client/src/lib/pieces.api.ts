import type { Piece } from "@shared/schema";

export type PieceWithSubtype = Piece & {
  pieceSubtypeId: number | null;
  pieceType?: { id: number; name: string } | null;
};

export type SubtypeOption = { id: number; name: string };

export type PaginatedPieces = {
  items: PieceWithSubtype[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type PiecesQueryParams = {
  page?: number;
  pageSize?: number;
  status?: string | "all";
  pieceTypeId?: number | "all";
  pieceSubtypeId?: number | "all";
  search?: string;
  paginated?: boolean;
};

export async function fetchPieces(params: PiecesQueryParams = {}): Promise<PieceWithSubtype[] | PaginatedPieces> {
  const search = new URLSearchParams();
  if (params.paginated) search.set("paginated", "true");
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.pieceTypeId && params.pieceTypeId !== "all") search.set("pieceTypeId", String(params.pieceTypeId));
  if (params.pieceSubtypeId && params.pieceSubtypeId !== "all") search.set("pieceSubtypeId", String(params.pieceSubtypeId));
  if (params.search && params.search.trim()) search.set("search", params.search.trim());

  const res = await fetch(`/api/pieces?${search.toString()}`, { credentials: "include" });
  if (!res.ok) throw new Error("Impossible de charger les pièces");
  return res.json();
}

export async function fetchPieceTypes(): Promise<{ id: number; name: string }[]> {
  const res = await fetch("/api/piece-types", { credentials: "include" });
  if (!res.ok) throw new Error("Impossible de charger les types");
  return res.json();
}

export async function fetchPieceSubtypes(pieceTypeId: number): Promise<SubtypeOption[]> {
  const params = new URLSearchParams({ onlyActive: "true", pieceTypeId: String(pieceTypeId) });
  const r = await fetch(`/api/piece-subtypes?${params.toString()}`, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as SubtypeOption[];
}

export async function fetchAllSubtypes(): Promise<SubtypeOption[]> {
  const r = await fetch(`/api/piece-subtypes?onlyActive=true`, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as SubtypeOption[];
}
