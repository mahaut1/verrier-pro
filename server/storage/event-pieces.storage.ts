import { db } from "../db.js";
import { and, eq } from "drizzle-orm";
import { eventPieces, pieces } from "../../shared/schema.js";
import { resolveImageUrl } from "../../shared/images.js";

export class EventPiecesStorage {
  async listEventPieces(userId: number, eventId: number) {
    const rows = await db
      .select({
        id: eventPieces.id,
        eventId: eventPieces.eventId,
        pieceId: eventPieces.pieceId,
        displayPrice: eventPieces.displayPrice,
        sold: eventPieces.sold,
        createdAt: eventPieces.createdAt,        pieceName: pieces.name,
        pieceUniqueId: pieces.uniqueId,
        pieceStatus: pieces.status,
        piecePrice: pieces.price,
        pieceImageUrl: pieces.imageUrl, 
      })
      .from(eventPieces)
      .leftJoin(pieces, eq(pieces.id, eventPieces.pieceId))
      .where(and(eq(eventPieces.userId, userId), eq(eventPieces.eventId, eventId)));

return rows.map(r => ({
      ...r,
      pieceImageUrl: resolveImageUrl(r.pieceImageUrl ?? null) ?? null,
    }));
  }

  async getEventPieceById(userId: number, id: number) {
    const rows = await db
      .select()
      .from(eventPieces)
      .where(and(eq(eventPieces.userId, userId), eq(eventPieces.id, id)));
    return rows[0] ?? null;
  }

  async addEventPiece(
    userId: number,
    eventId: number,
    pieceId: number,
    displayPrice?: string | null,
    sold?: boolean
  ) {
    const row = await db
      .insert(eventPieces)
      .values({
        userId,
        eventId,
        pieceId,
        displayPrice: displayPrice ?? null,
        sold: sold ?? false,
      })
      .returning();
    return row[0] ?? null;
  }

  async updateEventPiece(
    userId: number,
    id: number,
    patch: Partial<Omit<typeof eventPieces.$inferInsert, "id" | "userId" | "createdAt">>
  ) {
    const rows = await db
      .update(eventPieces)
      .set(patch)
      .where(and(eq(eventPieces.userId, userId), eq(eventPieces.id, id)))
      .returning();
    return rows[0] ?? null;
  }

  async deleteEventPiece(userId: number, id: number) {
    const rows = await db
      .delete(eventPieces)
      .where(and(eq(eventPieces.userId, userId), eq(eventPieces.id, id)))
      .returning({ id: eventPieces.id });
    return rows.length > 0;
  }
}
