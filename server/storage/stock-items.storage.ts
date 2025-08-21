import { db } from "../db";
import * as schema from "@shared/schema";
import { and, eq, like, SQL } from "drizzle-orm";
import {
  StorageBase,
  memory,
  type MemoryStockItem,
} from "./storage.base";

type StockItemInsert = typeof schema.stockItems.$inferInsert;
type StockItemRow    = typeof schema.stockItems.$inferSelect;
type StockItemClean  = Omit<StockItemInsert, "id" | "userId" | "createdAt" | "updatedAt">;

// drizzle numeric => string
const toDecStr = (v: number | string): string =>
  (typeof v === "number" ? v.toString() : v);

// mémoire -> row
const memItemToRow = (m: MemoryStockItem): StockItemRow => ({
  id: m.id,
  userId: m.userId,
  name: m.name,
  type: m.type,
  category: m.category,
  currentQuantity: m.currentQuantity.toString(),
  unit: m.unit,
  minimumThreshold: m.minimumThreshold.toString(),
  supplier: m.supplier,
  notes: m.notes,
  createdAt: m.createdAt,
  updatedAt: m.updatedAt,
});

export type StockItemListQuery = {
  type?: string;
  category?: string;
  q?: string;
  lowOnly?: boolean;
};

export class StockItemsStorage extends StorageBase {
  async createItem(userId: number, data: StockItemClean): Promise<StockItemRow> {
    if (this.useDatabase) {
      const [row] = await db
        .insert(schema.stockItems)
        .values({
          userId,
          name: data.name.trim(),
          type: data.type,
          category: data.category,
          currentQuantity: toDecStr(data.currentQuantity),
          unit: data.unit,
          minimumThreshold: toDecStr(data.minimumThreshold),
          supplier: data.supplier?.trim() ?? null,
          notes: data.notes?.trim() ?? null,
        })
        .returning();
      return row as StockItemRow;
    } else {
      const id = memory.stockItems.length ? Math.max(...memory.stockItems.map(i => i.id)) + 1 : 1;
      const now = new Date();
      const mem: MemoryStockItem = {
        id,
        userId,
        name: data.name.trim(),
        type: data.type,
        category: data.category,
        currentQuantity: Number(data.currentQuantity),
        unit: data.unit,
        minimumThreshold: Number(data.minimumThreshold),
        supplier: data.supplier?.trim() ?? null,
        notes: data.notes?.trim() ?? null,
        createdAt: now,
        updatedAt: now,
      };
      memory.stockItems.push(mem);
      return memItemToRow(mem);
    }
  }

  async listItems(userId: number, q?: StockItemListQuery): Promise<StockItemRow[]> {
    if (this.useDatabase) {
      const filters: SQL[] = [eq(schema.stockItems.userId, userId)];
      if (q?.type)     filters.push(eq(schema.stockItems.type, q.type));
      if (q?.category) filters.push(eq(schema.stockItems.category, q.category));
      if (q?.q)        filters.push(like(schema.stockItems.name, `%${q.q}%`));

      // lowOnly: filtre applicatif (numeric renvoyé en string)
      const where = filters.length > 1 ? and(...filters) : filters[0];
      const rows = await db.select().from(schema.stockItems).where(where);

      return (q?.lowOnly === true)
        ? rows.filter(r => Number(r.currentQuantity) <= Number(r.minimumThreshold)) as StockItemRow[]
        : rows;
    } else {
      return memory.stockItems
        .filter(i =>
          i.userId === userId &&
          (q?.type ? i.type === q.type : true) &&
          (q?.category ? i.category === q.category : true) &&
          (q?.q ? i.name.toLowerCase().includes(q.q.toLowerCase()) : true) &&
          (q?.lowOnly ? i.currentQuantity <= i.minimumThreshold : true)
        )
        .map(memItemToRow);
    }
  }

  async getItemById(userId: number, id: number): Promise<StockItemRow | null> {
    if (this.useDatabase) {
      const [row] = await db
        .select()
        .from(schema.stockItems)
        .where(and(eq(schema.stockItems.userId, userId), eq(schema.stockItems.id, id)))
        .limit(1);
      return (row as StockItemRow | undefined) ?? null;
    } else {
      const found = memory.stockItems.find(i => i.userId === userId && i.id === id);
      return found ? memItemToRow(found) : null;
    }
  }

  async updateItem(
    userId: number,
    id: number,
    patch: Partial<StockItemClean>
  ): Promise<StockItemRow | null> {
    if (this.useDatabase) {
      const [row] = await db
        .update(schema.stockItems)
        .set({
          ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.category !== undefined ? { category: patch.category } : {}),
          ...(patch.currentQuantity !== undefined ? { currentQuantity: toDecStr(patch.currentQuantity) } : {}),
          ...(patch.unit !== undefined ? { unit: patch.unit } : {}),
          ...(patch.minimumThreshold !== undefined ? { minimumThreshold: toDecStr(patch.minimumThreshold) } : {}),
          ...(patch.supplier !== undefined ? { supplier: patch.supplier?.trim() ?? null } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes?.trim() ?? null } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(schema.stockItems.userId, userId), eq(schema.stockItems.id, id)))
        .returning();
      return (row as StockItemRow | undefined) ?? null;
    } else {
      const idx = memory.stockItems.findIndex(i => i.userId === userId && i.id === id);
      if (idx === -1) return null;
      const cur = memory.stockItems[idx];
      const next: MemoryStockItem = {
        ...cur,
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.currentQuantity !== undefined ? { currentQuantity: Number(patch.currentQuantity) } : {}),
        ...(patch.unit !== undefined ? { unit: patch.unit } : {}),
        ...(patch.minimumThreshold !== undefined ? { minimumThreshold: Number(patch.minimumThreshold) } : {}),
        ...(patch.supplier !== undefined ? { supplier: patch.supplier?.trim() ?? null } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes?.trim() ?? null } : {}),
        updatedAt: new Date(),
      };
      memory.stockItems[idx] = next;
      return memItemToRow(next);
    }
  }

  async deleteItem(userId: number, id: number): Promise<boolean> {
    if (this.useDatabase) {
      await db
        .update(schema.stockMovements)
        .set({ stockItemId: null })
        .where(and(eq(schema.stockMovements.userId, userId), eq(schema.stockMovements.stockItemId, id)));

      const deleted = await db
        .delete(schema.stockItems)
        .where(and(eq(schema.stockItems.userId, userId), eq(schema.stockItems.id, id)))
        .returning({ id: schema.stockItems.id });
      return deleted.length > 0;
    } else {
      const before = memory.stockItems.length;
      memory.stockItems = memory.stockItems.filter(i => !(i.userId === userId && i.id === id));
      memory.stockMovements = memory.stockMovements.map(m =>
        m.userId === userId && m.stockItemId === id ? { ...m, stockItemId: null } : m
      );
      return memory.stockItems.length < before;
    }
  }
}
