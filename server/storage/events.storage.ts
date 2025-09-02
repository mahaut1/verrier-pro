import { db } from "../db.js";
import { and, eq, like, gte, lte, desc, sql } from "drizzle-orm";
import { events } from "../../shared/schema.js";

export type EventListFilters = {
  status?: string;
  type?: string;
  q?: string;
  from?: Date;
  to?: Date;
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
    patch: Partial<Omit<typeof events.$inferInsert, "id" | "userId" | "createdAt" | "updatedAt">>
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
}
