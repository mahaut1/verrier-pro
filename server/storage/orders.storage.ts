import { db } from "../db.js";
import * as schema from "../../shared/schema.js";
import { and, desc, eq, sql } from "drizzle-orm";
import {StorageBase, memory, type MemoryOrder} from "./storage.base.js";

type OrderInsert = typeof schema.orders.$inferInsert;
type OrderRow    = typeof schema.orders.$inferSelect;

type OrderClean  = Omit<OrderInsert, "id"|"userId"|"createdAt"|"updatedAt"|"totalAmount">;


// mémoire -> row (DECIMAL => string)
const memOrderToRow = (m: MemoryOrder): OrderRow => ({
  id: m.id,
  userId: m.userId,
  orderNumber: m.orderNumber,
  galleryId: m.galleryId,
  status: m.status,
  totalAmount: m.totalAmount.toString(),
  shippingAddress: m.shippingAddress,
  notes: m.notes,
  shippedAt: m.shippedAt,
  deliveredAt: m.deliveredAt,
  createdAt: m.createdAt,
  updatedAt: m.updatedAt,
});

export type OrderListQuery = {
  status?: schema.OrderStatus;
  limit?: number;
  offset?: number;
};

export class OrdersStorage extends StorageBase {

  async createOrder(userId: number, data: OrderClean): Promise<OrderRow> {
    if (this.useDatabase) {
      const [row] = await db
        .insert(schema.orders)
        .values({
          userId,
          orderNumber: data.orderNumber.trim(),
          galleryId: data.galleryId ?? null,
          status: data.status ?? "pending",
          totalAmount: null, // recalculé
          shippingAddress: data.shippingAddress ?? null,
          notes: data.notes ?? null,
          shippedAt: data.shippedAt ?? null,
          deliveredAt: data.deliveredAt ?? null,
        })
        .returning();
      // recalc total à la création (0 si pas d’item)
      await this.recalcTotal(userId, row.id!);
      return row as OrderRow;
    }
    const id = memory.orders.length ? Math.max(...memory.orders.map(o => o.id)) + 1 : 1;
    const now = new Date();
    const mem: MemoryOrder = {
      id,
      userId,
      orderNumber: data.orderNumber.trim(),
      galleryId: data.galleryId ?? null,
      status: (data.status ?? "pending") as MemoryOrder["status"],
      totalAmount: 0,
      shippingAddress: data.shippingAddress ?? null,
      notes: data.notes ?? null,
      shippedAt: data.shippedAt ?? null,
      deliveredAt: data.deliveredAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
    memory.orders.push(mem);
    return memOrderToRow(mem);
  }

  async listOrders(userId: number, q?: OrderListQuery): Promise<OrderRow[]> {
    const limit  = Math.min(Math.max(q?.limit ?? 50, 1), 200);
    const offset = Math.max(q?.offset ?? 0, 0);
    if (this.useDatabase) {
      const where = q?.status
        ? and(eq(schema.orders.userId, userId), eq(schema.orders.status, q.status))
        : eq(schema.orders.userId, userId);
      const rows = await db
        .select()
        .from(schema.orders)
        .where(where)
        .orderBy(desc(schema.orders.createdAt))
        .limit(limit)
        .offset(offset);
      return rows as OrderRow[];
    }
    let rows = memory.orders
      .filter(o => o.userId === userId && (q?.status ? o.status === q.status : true))
      .sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
    rows = rows.slice(offset, offset + limit);
    return rows.map(memOrderToRow);
  }

  async getOrderById(userId: number, id: number): Promise<OrderRow | null> {
    if (this.useDatabase) {
      const [row] = await db
        .select()
        .from(schema.orders)
        .where(and(eq(schema.orders.userId, userId), eq(schema.orders.id, id)))
        .limit(1);
      return (row as OrderRow | undefined) ?? null;
    }
    const found = memory.orders.find(o => o.userId === userId && o.id === id);
    return found ? memOrderToRow(found) : null;
  }

  async updateOrder(userId: number, id: number, patch: Partial<OrderClean>): Promise<OrderRow | null> {
    if (this.useDatabase) {
      const [row] = await db
        .update(schema.orders)
        .set({
          ...(patch.orderNumber !== undefined ? { orderNumber: patch.orderNumber.trim() } : {}),
          ...(patch.galleryId !== undefined ? { galleryId: patch.galleryId } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.shippingAddress !== undefined ? { shippingAddress: patch.shippingAddress ?? null } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes ?? null } : {}),
          ...(patch.shippedAt !== undefined ? { shippedAt: patch.shippedAt ?? null } : {}),
          ...(patch.deliveredAt !== undefined ? { deliveredAt: patch.deliveredAt ?? null } : {}),
          updatedAt: sql`now()`,
        })
        .where(and(eq(schema.orders.userId, userId), eq(schema.orders.id, id)))
        .returning();
      if (!row) return null;
      await this.recalcTotal(userId, id); // garde le total à jour
      return row as OrderRow;
    }
    const idx = memory.orders.findIndex(o => o.userId === userId && o.id === id);
    if (idx === -1) return null;
    const cur = memory.orders[idx];
    const next: MemoryOrder = {
      ...cur,
      ...(patch.orderNumber !== undefined ? { orderNumber: patch.orderNumber.trim() } : {}),
      ...(patch.galleryId !== undefined ? { galleryId: patch.galleryId } : {}),
      ...(patch.status !== undefined ? { status: patch.status as MemoryOrder["status"] } : {}),
      ...(patch.shippingAddress !== undefined ? { shippingAddress: patch.shippingAddress ?? null } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes ?? null } : {}),
      ...(patch.shippedAt !== undefined ? { shippedAt: patch.shippedAt ?? null } : {}),
      ...(patch.deliveredAt !== undefined ? { deliveredAt: patch.deliveredAt ?? null } : {}),
      updatedAt: new Date(),
    };
    memory.orders[idx] = next;
    return memOrderToRow(next);
  }

  async deleteOrder(userId: number, id: number): Promise<boolean> {
    if (this.useDatabase) {
      // pas de cascade -> supprimer d’abord les items liés
      await db.delete(schema.orderItems)
        .where(and(eq(schema.orderItems.userId, userId), eq(schema.orderItems.orderId, id)));
      const deleted = await db.delete(schema.orders)
        .where(and(eq(schema.orders.userId, userId), eq(schema.orders.id, id)))
        .returning({ id: schema.orders.id });
      return deleted.length > 0;
    }
    memory.orderItems = memory.orderItems.filter(i => !(i.userId === userId && i.orderId === id));
    const before = memory.orders.length;
    memory.orders = memory.orders.filter(o => !(o.userId === userId && o.id === id));
    return memory.orders.length < before;
  }

  // Recalc = SUM(order_items.price)
  async recalcTotal(userId: number, orderId: number): Promise<string> {
    if (this.useDatabase) {
      const [{ sum }] = await db
        .select({ sum: sql<string>`coalesce(sum(${schema.orderItems.price}), '0')` })
        .from(schema.orderItems)
        .where(and(eq(schema.orderItems.userId, userId), eq(schema.orderItems.orderId, orderId)));
      await db.update(schema.orders)
        .set({ totalAmount: sum, updatedAt: sql`now()` })
        .where(and(eq(schema.orders.userId, userId), eq(schema.orders.id, orderId)));
      return sum;
    }
    const total = memory.orderItems
      .filter(i => i.userId === userId && i.orderId === orderId)
      .reduce((acc, it) => acc + Number(it.price), 0);
    const idx = memory.orders.findIndex(o => o.userId === userId && o.id === orderId);
    if (idx !== -1) memory.orders[idx].totalAmount = total;
    return total.toString();
  }
}
