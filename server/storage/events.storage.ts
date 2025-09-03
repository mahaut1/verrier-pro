import { db } from "../db.js";
import { and, eq, like, gte, lte, desc, sql } from "drizzle-orm";
import { events, eventPieces } from "../../shared/schema.js";

export type EventListFilters = {
  status?: string;
  type?: string;
  q?: string;
  from?: Date;
  to?: Date;
};


type EventPatch = Partial<
  Omit<typeof events.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">
>;

type EventPieceInput = {
  pieceId: number;
  displayPrice?: string | null;
  sold?: boolean;
};

export class EventsStorage {
  async createEvent(
    userId: number,
    data: Omit<typeof events.$inferInsert, "userId" | "id" | "createdAt" | "updatedAt">
  ) {
    const row = await db.insert(events).values({ ...data, userId }).returning();
    return row[0] ?? null;
  }

  async listEvents(userId: number, filters: EventListFilters = {}) {
    const conditions = [eq(events.userId, userId)] as any[];
    if (filters.status) conditions.push(eq(events.status, filters.status));
    if (filters.type) conditions.push(eq(events.type, filters.type));
    if (filters.from) conditions.push(gte(events.startDate, filters.from));
    if (filters.to) conditions.push(lte(events.startDate, filters.to));
    if (filters.q) conditions.push(like(events.name, `%${filters.q}%`));

    return db
      .select()
      .from(events)
      .where(and(...conditions))
      .orderBy(desc(events.startDate));
  }

  async getEventById(userId: number, id: number) {
    const rows = await db
      .select()
      .from(events)
      .where(and(eq(events.userId, userId), eq(events.id, id)));
    return rows[0] ?? null;
  }

  async updateEvent(
    userId: number,
    id: number,
    patch: EventPatch
  ) {
    const rows = await db
      .update(events)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(events.userId, userId), eq(events.id, id)))
      .returning();
    return rows[0] ?? null;
  }

  async deleteEvent(userId: number, id: number) {
    const rows = await db
      .delete(events)
      .where(and(eq(events.userId, userId), eq(events.id, id)))
      .returning({ id: events.id });
    return rows.length > 0;
  }
   async updateEventWithPieces(
    userId: number,
    id: number,
    patch: EventPatch,
    piecesInput?: EventPieceInput[]
  ) {
    return db.transaction(async (tx) => {
      // 1) update évent
      const updated = await tx
        .update(events)
        .set({ ...patch, updatedAt: sql`now()` })
        .where(and(eq(events.userId, userId), eq(events.id, id)))
        .returning();

      const eventRow = updated[0];
      if (!eventRow) return null;

      if (!piecesInput) return eventRow;

      const wantedMap = new Map<number, { displayPrice: string | null; sold: boolean }>();
      for (const p of piecesInput) {
        wantedMap.set(p.pieceId, {
          displayPrice: p.displayPrice ?? null,
          sold: !!p.sold,
        });
      }

      const existing = await tx
        .select()
        .from(eventPieces)
        .where(and(eq(eventPieces.userId, userId), eq(eventPieces.eventId, id)));

      const existingByPiece = new Map<number, (typeof existing)[number]>();
      for (const row of existing) {
        if (row.pieceId != null) existingByPiece.set(row.pieceId, row);
      }

      for (const row of existing) {
        if (row.pieceId != null && !wantedMap.has(row.pieceId)) {
          await tx
            .delete(eventPieces)
            .where(and(eq(eventPieces.userId, userId), eq(eventPieces.id, row.id)));
        }
      }

      for (const [pieceId, data] of wantedMap.entries()) {
        const ex = existingByPiece.get(pieceId);
        if (!ex) {
          await tx.insert(eventPieces).values({
            userId,
            eventId: id,
            pieceId,
            displayPrice: data.displayPrice,
            sold: data.sold,
          });
        } else {
          const changed =
            (ex.displayPrice ?? null) !== (data.displayPrice ?? null) ||
            (ex.sold ?? false) !== (data.sold ?? false);

          if (changed) {
            await tx
              .update(eventPieces)
              .set({ displayPrice: data.displayPrice, sold: data.sold })
              .where(and(eq(eventPieces.userId, userId), eq(eventPieces.id, ex.id)));
          }
        }
      }

      return eventRow;
    });
  }
}

