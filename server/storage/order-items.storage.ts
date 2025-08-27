import { db } from "../db.js";
import * as schema from "../../shared/schema.js";
import { and, desc, eq } from "drizzle-orm";
import {StorageBase, memory, type MemoryOrderItem} from "./storage.base.js";
import { OrdersStorage } from "./orders.storage.js";

type OrderItemInsert = typeof schema.orderItems.$inferInsert;
type OrderItemRow    = typeof schema.orderItems.$inferSelect;

type OrderItemClean  = Omit<OrderItemInsert, "id"|"userId"|"createdAt">;

// helpers
const toDecStr = (v: number | string): string =>
  typeof v === "number" ? v.toString() : v;

// mémoire -> row
const memItemToRow = (m: MemoryOrderItem): OrderItemRow => ({
  id: m.id,
  userId: m.userId,
  orderId: m.orderId,
  pieceId: m.pieceId,
  price: m.price.toString(),
  createdAt: m.createdAt,
});

const orders = new OrdersStorage();

export class OrderItemsStorage extends StorageBase {
  async createItem(userId: number, data: OrderItemClean): Promise<OrderItemRow> {
    if (this.useDatabase) {
      const [row] = await db
        .insert(schema.orderItems)
        .values({
          userId,
          orderId: data.orderId ?? null,
          pieceId: data.pieceId ?? null,
          price: toDecStr(data.price),
        })
        .returning();

      // recalc total
      if (row.orderId != null) await orders.recalcTotal(userId, row.orderId);
      return row as OrderItemRow;
    }

    const id = memory.orderItems.length ? Math.max(...memory.orderItems.map(i => i.id)) + 1 : 1;
    const now = new Date();
    const mem: MemoryOrderItem = {
      id,
      userId,
      orderId: data.orderId ?? null,
      pieceId: data.pieceId ?? null,
      price: Number(data.price),
      createdAt: now,
    };
    memory.orderItems.push(mem);

    if (mem.orderId != null) await orders.recalcTotal(userId, mem.orderId);
    return memItemToRow(mem);
  }

  async listItems(userId: number, orderId?: number): Promise<OrderItemRow[]> {
    if (this.useDatabase) {
      const where = orderId != null
        ? and(eq(schema.orderItems.userId, userId), eq(schema.orderItems.orderId, orderId))
        : eq(schema.orderItems.userId, userId);

      const rows = await db.select().from(schema.orderItems).where(where).orderBy(desc(schema.orderItems.createdAt));
      return rows as OrderItemRow[];
    }

    let items = memory.orderItems.filter(i => i.userId === userId);
    if (orderId != null) items = items.filter(i => i.orderId === orderId);
    items = items.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
    return items.map(memItemToRow);
  }

  async getItemById(userId: number, id: number): Promise<OrderItemRow | null> {
    if (this.useDatabase) {
      const [row] = await db
        .select()
        .from(schema.orderItems)
        .where(and(eq(schema.orderItems.userId, userId), eq(schema.orderItems.id, id)))
        .limit(1);
      return (row as OrderItemRow | undefined) ?? null;
    }

    const found = memory.orderItems.find(i => i.userId === userId && i.id === id);
    return found ? memItemToRow(found) : null;
  }

  async updateItem(userId: number, id: number, patch: Partial<OrderItemClean>): Promise<OrderItemRow | null> {
    if (this.useDatabase) {
      const [before] = await db
        .select({ orderId: schema.orderItems.orderId })
        .from(schema.orderItems)
        .where(and(eq(schema.orderItems.userId, userId), eq(schema.orderItems.id, id)))
        .limit(1);
      if (!before) return null;

      const [row] = await db
        .update(schema.orderItems)
        .set({
          ...(patch.orderId !== undefined ? { orderId: patch.orderId } : {}),
          ...(patch.pieceId !== undefined ? { pieceId: patch.pieceId } : {}),
          ...(patch.price !== undefined ? { price: toDecStr(patch.price) } : {}),
        })
        .where(and(eq(schema.orderItems.userId, userId), eq(schema.orderItems.id, id)))
        .returning();

      // recalc pour ancien et/ou nouveau orderId
      if (before.orderId != null) await orders.recalcTotal(userId, before.orderId);
      if (row.orderId != null)    await orders.recalcTotal(userId, row.orderId);

      return row as OrderItemRow;
    }

    const idx = memory.orderItems.findIndex(i => i.userId === userId && i.id === id);
    if (idx === -1) return null;
    const before = memory.orderItems[idx];
    const after: MemoryOrderItem = {
      ...before,
      ...(patch.orderId !== undefined ? { orderId: patch.orderId } : {}),
      ...(patch.pieceId !== undefined ? { pieceId: patch.pieceId ?? null } : {}),
      ...(patch.price !== undefined ? { price: Number(patch.price) } : {}),
    };
    memory.orderItems[idx] = after;

    if (before.orderId != null) await orders.recalcTotal(userId, before.orderId);
    if (after.orderId != null)  await orders.recalcTotal(userId, after.orderId);

    return memItemToRow(after);
  }

  async deleteItem(userId: number, id: number): Promise<boolean> {
    if (this.useDatabase) {
      const [existing] = await db
        .select({ orderId: schema.orderItems.orderId })
        .from(schema.orderItems)
        .where(and(eq(schema.orderItems.userId, userId), eq(schema.orderItems.id, id)))
        .limit(1);
      if (!existing) return false;

      const deleted = await db
        .delete(schema.orderItems)
        .where(and(eq(schema.orderItems.userId, userId), eq(schema.orderItems.id, id)))
        .returning({ id: schema.orderItems.id });

      if (existing.orderId != null) await orders.recalcTotal(userId, existing.orderId);
      return deleted.length > 0;
    }

    const idx = memory.orderItems.findIndex(i => i.userId === userId && i.id === id);
    if (idx === -1) return false;
    const [removed] = memory.orderItems.splice(idx, 1);
    if (removed.orderId != null) await orders.recalcTotal(userId, removed.orderId);
    return true;
  }
}
