import { db } from "../db.js";
import * as schema from "../../shared/schema.js";
import { and, eq, SQL } from "drizzle-orm";
import {StorageBase,memory,  type PieceListQuery,  type MemoryPiece,} from "./storage.base.js";
import { resolveImageUrl } from "../../shared/images.js";

type PieceInsert = typeof schema.pieces.$inferInsert;
type PieceRow    = typeof schema.pieces.$inferSelect;
type PieceInsertClean = Omit<
  PieceInsert,
  "id" | "userId" | "createdAt" | "updatedAt"
>;

// price helpers (Drizzle numeric -> string; on tolère null côté mémoire)
type PriceIn  = PieceInsert["price"] | number | null | undefined;
type PriceOut = PieceRow["price"]; 
/** Convertit un nombre/chaîne/nullish vers le type attendu par PieceRow.price */
const toRowPrice = (v: PriceIn): PriceOut =>
  v == null ? (null as unknown as PriceOut) : (String(v) as PriceOut);

function out(row: PieceRow): PieceRow {
  return {
    ...row,
    imageUrl: resolveImageUrl(row.imageUrl ?? null) ?? null,
  };
}
export class PiecesStorage extends StorageBase {
  // Mémoire -> Row (puis normalisation sortie)
  private memToRow(p: MemoryPiece): PieceRow {
    return out({
      id: p.id,
      userId: p.userId,
      name: p.name,
      uniqueId: p.uniqueId,
      pieceTypeId: p.pieceTypeId,
      dimensions: p.dimensions,
      dominantColor: p.dominantColor,
      description: p.description,
      status: p.status,
      currentLocation: p.currentLocation,
      galleryId: p.galleryId,
      price: toRowPrice(p.price),
      imageUrl: p.imageUrl, // stockée telle quelle (absolue R2 ou /uploads)
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });
  }

  async createPiece(userId: number, data: PieceInsertClean): Promise<PieceRow> {
    if (this.useDatabase) {
      const [row] = await db
        .insert(schema.pieces)
        .values({ ...data, userId }) // imageUrl stockée telle quelle
        .returning();
      return out(row as PieceRow);
    }

    const id = memory.pieces.length
      ? Math.max(...memory.pieces.map((p) => p.id)) + 1
      : 1;

    const mem: MemoryPiece = {
      id,
      userId,
      name: data.name,
      uniqueId: data.uniqueId,
      pieceTypeId: data.pieceTypeId ?? null,
      dimensions: data.dimensions ?? null,
      dominantColor: data.dominantColor ?? null,
      description: data.description ?? null,
      status: data.status ?? "workshop",
      currentLocation: data.currentLocation ?? "atelier",
      galleryId: data.galleryId ?? null,
      price: data.price ?? null,
      imageUrl: data.imageUrl ?? null, // tel quel
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memory.pieces.push(mem);
    return this.memToRow(mem);
  }

  async listPieces(userId: number, q?: PieceListQuery): Promise<PieceRow[]> {
    if (this.useDatabase) {
      const filters: SQL[] = [eq(schema.pieces.userId, userId)];
      if (q?.status)        filters.push(eq(schema.pieces.status, q.status));
      if (q?.pieceTypeId != null)
                            filters.push(eq(schema.pieces.pieceTypeId, q.pieceTypeId));
      if (q?.galleryId  != null)
                            filters.push(eq(schema.pieces.galleryId, q.galleryId));

      const whereExpr = filters.length > 1 ? and(...filters) : filters[0];
      const rows = await db.select().from(schema.pieces).where(whereExpr);
      return rows.map((r) => out(r as PieceRow));
    }

    return memory.pieces
      .filter(
        (p) =>
          p.userId === userId &&
          (q?.status ? p.status === q.status : true) &&
          (q?.pieceTypeId != null ? p.pieceTypeId === q.pieceTypeId : true) &&
          (q?.galleryId  != null ? p.galleryId  === q.galleryId  : true)
      )
      .map((p) => this.memToRow(p));
  }

  async getPieceById(userId: number, id: number): Promise<PieceRow | null> {
    if (this.useDatabase) {
      const [row] = await db
        .select()
        .from(schema.pieces)
        .where(and(eq(schema.pieces.userId, userId), eq(schema.pieces.id, id)))
        .limit(1);
      return row ? out(row as PieceRow) : null;
    }

    const found = memory.pieces.find((p) => p.userId === userId && p.id === id);
    return found ? this.memToRow(found) : null;
  }

  async updatePiece(
    userId: number,
    id: number,
    patch: Partial<PieceInsertClean>
  ): Promise<PieceRow | null> {
    // On stocke tel quel; on peut normaliser "" -> null si nécessaire
    const cleanedPatch: Partial<PieceInsertClean> = {
      ...patch,
      imageUrl: patch.imageUrl === "" ? null : patch.imageUrl,
    };

    if (this.useDatabase) {
      const [row] = await db
        .update(schema.pieces)
        .set({ ...cleanedPatch, updatedAt: new Date() })
        .where(and(eq(schema.pieces.userId, userId), eq(schema.pieces.id, id)))
        .returning();
      return row ? out(row as PieceRow) : null;
    }

    const idx = memory.pieces.findIndex((p) => p.userId === userId && p.id === id);
    if (idx === -1) return null;

    const cur = memory.pieces[idx];
    const next: MemoryPiece = {
      ...cur,
      ...cleanedPatch,
      price: cleanedPatch.price !== undefined ? cleanedPatch.price ?? null : cur.price,
      updatedAt: new Date(),
    };
    memory.pieces[idx] = next;
    return this.memToRow(next);
  }

  async deletePiece(userId: number, id: number): Promise<boolean> {
    if (this.useDatabase) {
      const deleted = await db
        .delete(schema.pieces)
        .where(and(eq(schema.pieces.userId, userId), eq(schema.pieces.id, id)))
        .returning({ id: schema.pieces.id });
      return deleted.length > 0;
    }

    const before = memory.pieces.length;
    memory.pieces = memory.pieces.filter((p) => !(p.userId === userId && p.id === id));
    return memory.pieces.length < before;
  }

  async setPieceImage(
    userId: number,
    id: number,
    imageUrl: string
  ): Promise<PieceRow | null> {
    // on stocke l’URL telle quelle (absolue R2 ou /uploads)
    return this.updatePiece(userId, id, { imageUrl });
  }

  async clearPieceImage(userId: number, id: number): Promise<PieceRow | null> {
    return this.updatePiece(userId, id, { imageUrl: null });
  }
}