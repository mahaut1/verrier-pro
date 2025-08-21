import { db } from "../db";
import * as schema from "@shared/schema";
import { and, eq, gte, lte, SQL } from "drizzle-orm";
import {
  StorageBase,
  memory,
  type MemoryStockMovement,
} from "./storage.base";

// drizzle numeric => string
const toDecStr = (v: number | string): string =>
  (typeof v === "number" ? v.toString() : v);

// mémoire -> row
type StockMovementInsert = typeof schema.stockMovements.$inferInsert;
type StockMovementRow    = typeof schema.stockMovements.$inferSelect;
type StockMovementClean  = Omit<StockMovementInsert, "id" | "userId" | "createdAt">;

const memMoveToRow = (m: MemoryStockMovement): StockMovementRow => ({
  id: m.id,
  userId: m.userId,
  stockItemId: m.stockItemId,
  type: m.type,
  quantity: m.quantity.toString(),
  reason: m.reason,
  notes: m.notes,
  createdAt: m.createdAt,
});

export type MovementListQuery = {
  itemId?: number;
  from?: string; // ISO
  to?: string;   // ISO
  limit?: number;
};

export class StockMovementsStorage extends StorageBase {
  /** CREATE **/
  async createMovement(userId: number, data: StockMovementClean): Promise<StockMovementRow> {
    if (data.type !== "in" && data.type !== "out") {
      throw new Error("Type de mouvement invalide (attendu: 'in' ou 'out').");
    }

    if (this.useDatabase) {
      // si lié à un item, contrôler le stock
      if (data.stockItemId != null) {
        const [item] = await db
          .select()
          .from(schema.stockItems)
          .where(and(eq(schema.stockItems.userId, userId), eq(schema.stockItems.id, data.stockItemId)))
          .limit(1);

        if (item && data.type === "out") {
          const newQty = Number(item.currentQuantity) - Number(data.quantity);
          if (newQty < 0) throw new Error("Stock insuffisant.");
        }
      }

      const movement = await db.transaction(async (tx) => {
        const [mv] = await tx
          .insert(schema.stockMovements)
          .values({
            userId,
            stockItemId: data.stockItemId ?? null,
            type: data.type,
            quantity: toDecStr(data.quantity),
            reason: data.reason.trim(),
            notes: data.notes?.trim() ?? null,
          })
          .returning();

        if (data.stockItemId != null) {
          const [item] = await tx
            .select()
            .from(schema.stockItems)
            .where(and(eq(schema.stockItems.userId, userId), eq(schema.stockItems.id, data.stockItemId)))
            .limit(1);
          const sign = data.type === "in" ? +1 : -1;
          const next = Number(item?.currentQuantity ?? 0) + sign * Number(data.quantity);

          await tx
            .update(schema.stockItems)
            .set({ currentQuantity: next.toString(), updatedAt: new Date() })
            .where(and(eq(schema.stockItems.userId, userId), eq(schema.stockItems.id, data.stockItemId)));
        }
        return mv as StockMovementRow;
      });

      return movement;
    } else {
      const id = memory.stockMovements.length ? Math.max(...memory.stockMovements.map(m => m.id)) + 1 : 1;
      const now = new Date();

      if (data.stockItemId != null) {
        const idx = memory.stockItems.findIndex(i => i.userId === userId && i.id === data.stockItemId);
        if (idx === -1) throw new Error("Article introuvable.");
        const sign = data.type === "in" ? +1 : -1;
        const nextQty = memory.stockItems[idx].currentQuantity + sign * Number(data.quantity);
        if (nextQty < 0) throw new Error("Stock insuffisant.");
        memory.stockItems[idx] = { ...memory.stockItems[idx], currentQuantity: nextQty, updatedAt: now };
      }

      const mem: MemoryStockMovement = {
        id,
        userId,
        stockItemId: data.stockItemId ?? null,
        type: data.type,
        quantity: Number(data.quantity),
        reason: data.reason.trim(),
        notes: data.notes?.trim() ?? null,
        createdAt: now,
      };
      memory.stockMovements.push(mem);
      return memMoveToRow(mem);
    }
  }

  /** LIST **/
  async listMovements(userId: number, q?: MovementListQuery): Promise<StockMovementRow[]> {
    const limit = q?.limit && q.limit > 0 ? q.limit : 100;

    if (this.useDatabase) {
      const filters: SQL[] = [eq(schema.stockMovements.userId, userId)];
      if (q?.itemId != null) filters.push(eq(schema.stockMovements.stockItemId, q.itemId));
      if (q?.from) filters.push(gte(schema.stockMovements.createdAt, new Date(q.from)));
      if (q?.to)   filters.push(lte(schema.stockMovements.createdAt, new Date(q.to)));

      const where = filters.length > 1 ? and(...filters) : filters[0];
      return db
        .select()
        .from(schema.stockMovements)
        .where(where)
        .limit(limit)
        .orderBy(schema.stockMovements.createdAt);
    } else {
      return memory.stockMovements
        .filter(m =>
          m.userId === userId &&
          (q?.itemId != null ? m.stockItemId === q.itemId : true) &&
          (q?.from ? m.createdAt >= new Date(q.from) : true) &&
          (q?.to ? m.createdAt <= new Date(q.to) : true)
        )
        .slice(-limit)
        .map(memMoveToRow);
    }
  }

  /** GET ONE **/
  async getStockMovementById(userId: number, id: number): Promise<StockMovementRow | null> {
    if (this.useDatabase) {
      const [row] = await db
        .select()
        .from(schema.stockMovements)
        .where(and(eq(schema.stockMovements.userId, userId), eq(schema.stockMovements.id, id)))
        .limit(1);
      return (row as StockMovementRow | undefined) ?? null;
    } else {
      const found = memory.stockMovements.find(m => m.userId === userId && m.id === id);
      return found ? memMoveToRow(found) : null;
    }
  }

  /** PATCH **/
  async updateMovement(
    userId: number,
    id: number,
    patch: Partial<StockMovementClean>
  ): Promise<StockMovementRow | null> {
    if (patch.type && patch.type !== "in" && patch.type !== "out") {
      throw new Error("Type de mouvement invalide (attendu: 'in' ou 'out').");
    }

    if (this.useDatabase) {
      const current = await this.getStockMovementById(userId, id);
      if (!current) return null;

      const oldItemId = current.stockItemId ?? null;
      const oldType   = current.type as "in" | "out";
      const oldQty    = Number(current.quantity);

      const newItemId = patch.stockItemId === undefined ? oldItemId : (patch.stockItemId ?? null);
      const newType   = (patch.type ?? oldType) as "in" | "out";
      const newQty    = patch.quantity !== undefined ? Number(patch.quantity) : oldQty;
      const newReason = patch.reason ?? current.reason;
      const newNotes  = patch.notes === undefined ? current.notes : (patch.notes ?? null);

      const updated = await db.transaction(async (tx) => {
        // revert ancien
        if (oldItemId != null) {
          const [oldItem] = await tx
            .select()
            .from(schema.stockItems)
            .where(and(eq(schema.stockItems.userId, userId), eq(schema.stockItems.id, oldItemId)))
            .limit(1);

          if (oldItem) {
            const afterRevert =
              Number(oldItem.currentQuantity) + (oldType === "in" ? -oldQty : +oldQty);
            if (afterRevert < 0) throw new Error("Stock insuffisant lors de la modification (revert).");

            await tx
              .update(schema.stockItems)
              .set({ currentQuantity: afterRevert.toString(), updatedAt: new Date() })
              .where(and(eq(schema.stockItems.userId, userId), eq(schema.stockItems.id, oldItemId)));
          }
        }

        // appliquer nouveau
        if (newItemId != null) {
          const [newItem] = await tx
            .select()
            .from(schema.stockItems)
            .where(and(eq(schema.stockItems.userId, userId), eq(schema.stockItems.id, newItemId)))
            .limit(1);
          if (!newItem) throw new Error("Article cible introuvable.");

          const afterApply =
            Number(newItem.currentQuantity) + (newType === "in" ? +newQty : -newQty);
          if (afterApply < 0) throw new Error("Stock insuffisant lors de la modification (apply).");

          await tx
            .update(schema.stockItems)
            .set({ currentQuantity: afterApply.toString(), updatedAt: new Date() })
            .where(and(eq(schema.stockItems.userId, userId), eq(schema.stockItems.id, newItemId)));
        }

        const [mv] = await tx
          .update(schema.stockMovements)
          .set({
            stockItemId: newItemId,
            type: newType,
            quantity: toDecStr(newQty),
            reason: newReason.trim(),
            notes: newNotes?.trim() ?? null,
          })
          .where(and(eq(schema.stockMovements.userId, userId), eq(schema.stockMovements.id, id)))
          .returning();

        return mv as StockMovementRow;
      });

      return updated;
    } else {
      const idx = memory.stockMovements.findIndex(m => m.userId === userId && m.id === id);
      if (idx === -1) return null;

      const cur = memory.stockMovements[idx];

      // revert
      if (cur.stockItemId != null) {
        const i = memory.stockItems.findIndex(it => it.userId === userId && it.id === cur.stockItemId);
        if (i !== -1) {
          const afterRevert =
            memory.stockItems[i].currentQuantity + (cur.type === "in" ? -cur.quantity : +cur.quantity);
          if (afterRevert < 0) throw new Error("Stock insuffisant lors de la modification (revert).");
          memory.stockItems[i] = { ...memory.stockItems[i], currentQuantity: afterRevert, updatedAt: new Date() };
        }
      }

      const newItemId = patch.stockItemId === undefined ? cur.stockItemId : (patch.stockItemId ?? null);
      const newType   = (patch.type ?? cur.type) as "in" | "out";
      const newQty    = patch.quantity !== undefined ? Number(patch.quantity) : cur.quantity;
      const newReason = patch.reason ?? cur.reason;
      const newNotes  = patch.notes === undefined ? cur.notes : (patch.notes ?? null);

      // apply
      if (newItemId != null) {
        const i = memory.stockItems.findIndex(it => it.userId === userId && it.id === newItemId);
        if (i === -1) throw new Error("Article cible introuvable.");
        const afterApply =
          memory.stockItems[i].currentQuantity + (newType === "in" ? +newQty : -newQty);
        if (afterApply < 0) throw new Error("Stock insuffisant lors de la modification (apply).");
        memory.stockItems[i] = { ...memory.stockItems[i], currentQuantity: afterApply, updatedAt: new Date() };
      }

      const next: MemoryStockMovement = {
        ...cur,
        stockItemId: newItemId,
        type: newType,
        quantity: newQty,
        reason: newReason.trim(),
        notes: newNotes?.trim() ?? null,
      };
      memory.stockMovements[idx] = next;
      return memMoveToRow(next);
    }
  }

  /** DELETE **/
  async deleteMovement(userId: number, id: number): Promise<boolean> {
    if (this.useDatabase) {
      const current = await this.getStockMovementById(userId, id);
      if (!current) return false;

      await db.transaction(async (tx) => {
        if (current.stockItemId != null) {
          const [it] = await tx
            .select()
            .from(schema.stockItems)
            .where(and(eq(schema.stockItems.userId, userId), eq(schema.stockItems.id, current.stockItemId)))
            .limit(1);

          if (it) {
            const afterRevert =
              Number(it.currentQuantity) + (current.type === "in" ? -Number(current.quantity) : +Number(current.quantity));
            if (afterRevert < 0) throw new Error("Stock insuffisant lors de la suppression (revert).");

            await tx
              .update(schema.stockItems)
              .set({ currentQuantity: afterRevert.toString(), updatedAt: new Date() })
              .where(and(eq(schema.stockItems.userId, userId), eq(schema.stockItems.id, current.stockItemId!)));
          }
        }

        await tx
          .delete(schema.stockMovements)
          .where(and(eq(schema.stockMovements.userId, userId), eq(schema.stockMovements.id, id)));
      });

      return true;
    } else {
      const idx = memory.stockMovements.findIndex(m => m.userId === userId && m.id === id);
      if (idx === -1) return false;

      const cur = memory.stockMovements[idx];
      if (cur.stockItemId != null) {
        const i = memory.stockItems.findIndex(it => it.userId === userId && it.id === cur.stockItemId);
        if (i !== -1) {
          const afterRevert =
            memory.stockItems[i].currentQuantity + (cur.type === "in" ? -cur.quantity : +cur.quantity);
          if (afterRevert < 0) throw new Error("Stock insuffisant lors de la suppression (revert).");
          memory.stockItems[i] = { ...memory.stockItems[i], currentQuantity: afterRevert, updatedAt: new Date() };
        }
      }

      memory.stockMovements.splice(idx, 1);
      return true;
    }
  }
}
