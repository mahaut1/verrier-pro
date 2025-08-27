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

const toRel = (u?: string | null) => resolveImageUrl(u, { absolute: false });

const memToRow = (p: MemoryPiece): PieceRow => ({
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
  imageUrl: toRel(p.imageUrl),
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

function mapDbRow(row: PieceRow): PieceRow {
  return {
    ...row,
    imageUrl: toRel(row.imageUrl),
  };
}

export class PiecesStorage extends StorageBase {
  async createPiece(userId: number, data: PieceInsertClean): Promise<PieceRow> {
      const cleaned: PieceInsertClean = {
      ...data,
      imageUrl: toRel(data.imageUrl),
    };
    if (this.useDatabase) {
      const [row] = await db
        .insert(schema.pieces)
        .values({ ...data, userId })
        .returning();
      return row as PieceRow;
    } else {
      const id =
        memory.pieces.length
          ? Math.max(...memory.pieces.map((p) => p.id)) + 1
          : 1;

      // on enregistre en mémoire puis on renvoie au format PieceRow
        const mem: MemoryPiece = {
        id,
        userId,
        name: cleaned.name,
        uniqueId: cleaned.uniqueId,
        pieceTypeId: cleaned.pieceTypeId ?? null,
        dimensions: cleaned.dimensions ?? null,
        dominantColor: cleaned.dominantColor ?? null,
        description: cleaned.description ?? null,
        status: cleaned.status ?? "workshop",
        currentLocation: cleaned.currentLocation ?? "atelier",
        galleryId: cleaned.galleryId ?? null,
        price: cleaned.price ?? null,
        imageUrl: toRel(cleaned.imageUrl),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memory.pieces.push(mem);
      return memToRow(mem);
    }
  }

  async listPieces(userId: number, q?: PieceListQuery): Promise<PieceRow[]> {
    if (this.useDatabase) {
      const filters: SQL[] = [eq(schema.pieces.userId, userId)];
      if (q?.status) filters.push(eq(schema.pieces.status, q.status));
      if (q?.pieceTypeId != null)
        filters.push(eq(schema.pieces.pieceTypeId, q.pieceTypeId));
      if (q?.galleryId != null)
        filters.push(eq(schema.pieces.galleryId, q.galleryId));

      const whereExpr = filters.length > 1 ? and(...filters) : filters[0];
      return db.select().from(schema.pieces).where(whereExpr);
    } else {
      return memory.pieces
        .filter(
          (p) =>
            p.userId === userId &&
            (q?.status ? p.status === q.status : true) &&
            (q?.pieceTypeId != null ? p.pieceTypeId === q.pieceTypeId : true) &&
            (q?.galleryId != null ? p.galleryId === q.galleryId : true)
        )
        .map(memToRow);
    }
  }

  async getPieceById(userId: number, id: number): Promise<PieceRow | null> {
    if (this.useDatabase) {
      const [row] = await db
        .select()
        .from(schema.pieces)
        .where(and(eq(schema.pieces.userId, userId), eq(schema.pieces.id, id)))
        .limit(1);
      return (row as PieceRow | undefined) ?? null;
    } else {
      const found = memory.pieces.find(
        (p) => p.userId === userId && p.id === id
      );
      return found ? memToRow(found) : null;
    }
  }

   async updatePiece(
    userId: number,
    id: number,
    patch: Partial<PieceInsertClean>
  ): Promise<PieceRow | null> {
    const cleanedPatch: Partial<PieceInsertClean> = {
      ...patch,
      imageUrl:
        patch.imageUrl !== undefined ? toRel(patch.imageUrl) : undefined,
    };

    if (this.useDatabase) {
      const payload: Partial<PieceInsertClean> & { updatedAt: Date } = {
        ...cleanedPatch,
        updatedAt: new Date(),
      };
      const [row] = await db
        .update(schema.pieces)
        .set(payload)
        .where(and(eq(schema.pieces.userId, userId), eq(schema.pieces.id, id)))
        .returning();
      return row ? mapDbRow(row as PieceRow) : null;
    } else {
      const idx = memory.pieces.findIndex(
        (p) => p.userId === userId && p.id === id
      );
      if (idx === -1) return null;

      const cur = memory.pieces[idx];
      const next: MemoryPiece = {
        ...cur,
        ...cleanedPatch,
        price:
          cleanedPatch.price !== undefined ? cleanedPatch.price ?? null : cur.price,
        updatedAt: new Date(),
      };
      memory.pieces[idx] = next;
      return memToRow(next);
    }
  }

  async deletePiece(userId: number, id: number): Promise<boolean> {
    if (this.useDatabase) {
      const deleted = await db
        .delete(schema.pieces)
        .where(and(eq(schema.pieces.userId, userId), eq(schema.pieces.id, id)))
        .returning({ id: schema.pieces.id });
      return deleted.length > 0;
    } else {
      const before = memory.pieces.length;
      memory.pieces = memory.pieces.filter(
        (p) => !(p.userId === userId && p.id === id)
      );
      return memory.pieces.length < before;
    }
  }

  async setPieceImage(
    userId: number,
    id: number,
    imageUrl: string
  ): Promise<PieceRow | null> {
    return this.updatePiece(userId, id, { imageUrl: toRel(imageUrl) ?? null });  }

  async clearPieceImage(userId: number, id: number): Promise<PieceRow | null> {
    return this.updatePiece(userId, id, { imageUrl: null });
  }
}
