// server/storage/piece-subtypes.storage.ts
import { db } from "../db.js";
import * as schema from "../../shared/schema.js";
import { and, eq, like, SQL } from "drizzle-orm";
import { StorageBase, memory, type MemoryPieceSubtype } from "./storage.base.js";

type PieceSubtypeInsert       = typeof schema.pieceSubtypes.$inferInsert;
type PieceSubtypeRow          = typeof schema.pieceSubtypes.$inferSelect;
type PieceSubtypeInsertClean  = Omit<PieceSubtypeInsert, "id" | "userId" | "createdAt" | "updatedAt">;

export type PieceSubtypeListQuery = {
  pieceTypeId?: number;
  isActive?: boolean;
  q?: string;
};

const memSubtypeToRow = (t: MemoryPieceSubtype): PieceSubtypeRow => ({
  id: t.id,
  userId: t.userId,
  pieceTypeId: t.pieceTypeId,   // number, OK
  name: t.name,
  description: t.description,
  isActive: t.isActive,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});

export class PieceSubtypesStorage extends StorageBase {
  async createPieceSubtype(userId: number, data: PieceSubtypeInsertClean): Promise<PieceSubtypeRow> {
    const safeName  = data.name.trim();
    const safeDesc  = data.description?.trim() ?? null;

    // pieceTypeId est requis et non-null
    const safeType = Number(data.pieceTypeId);
    if (!Number.isFinite(safeType) || safeType <= 0) {
      throw new Error("pieceTypeId est requis.");
    }
    const safeActive = data.isActive ?? true;

    if (this.useDatabase) {
      try {
        const [row] = await db
          .insert(schema.pieceSubtypes)
          .values({
            userId,
            pieceTypeId: safeType,
            name: safeName,
            description: safeDesc,
            isActive: safeActive,
          })
          .returning();
        return row as PieceSubtypeRow;
      } catch (err: unknown) {
        if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "23505") {
          throw new Error("Ce sous-type existe déjà pour ce type.");
        }
        throw err;
      }
    } else {
      const dup = memory.pieceSubtypes.find(
        (s) =>
          s.userId === userId &&
          s.pieceTypeId === safeType &&
          s.name.toLowerCase() === safeName.toLowerCase()
      );
      if (dup) throw new Error("Ce sous-type existe déjà pour ce type.");

      const id = memory.pieceSubtypes.length
        ? Math.max(...memory.pieceSubtypes.map((s) => s.id)) + 1
        : 1;

      const row: MemoryPieceSubtype = {
        id,
        userId,
        pieceTypeId: safeType,
        name: safeName,
        description: safeDesc,
        isActive: !!safeActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      memory.pieceSubtypes.push(row);
      return memSubtypeToRow(row);
    }
  }

  async listPieceSubtypes(userId: number, q?: PieceSubtypeListQuery): Promise<PieceSubtypeRow[]> {
    if (this.useDatabase) {
      const filters: SQL[] = [eq(schema.pieceSubtypes.userId, userId)];
      if (q?.pieceTypeId != null) filters.push(eq(schema.pieceSubtypes.pieceTypeId, q.pieceTypeId));
      if (typeof q?.isActive === "boolean") filters.push(eq(schema.pieceSubtypes.isActive, q.isActive));
      if (q?.q) filters.push(like(schema.pieceSubtypes.name, `%${q.q}%`));
      const whereExpr = filters.length > 1 ? and(...filters) : filters[0];

      return db.select()
        .from(schema.pieceSubtypes)
        .where(whereExpr)
        .orderBy(schema.pieceSubtypes.name);
    } else {
      return memory.pieceSubtypes
        .filter(
          (s) =>
            s.userId === userId &&
            (q?.pieceTypeId != null ? s.pieceTypeId === q.pieceTypeId : true) &&
            (typeof q?.isActive === "boolean" ? s.isActive === q.isActive : true) &&
            (q?.q ? s.name.toLowerCase().includes(q.q.toLowerCase()) : true)
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(memSubtypeToRow);
    }
  }

  async getPieceSubtypeById(userId: number, id: number): Promise<PieceSubtypeRow | null> {
    if (this.useDatabase) {
      const [row] = await db
        .select()
        .from(schema.pieceSubtypes)
        .where(and(eq(schema.pieceSubtypes.userId, userId), eq(schema.pieceSubtypes.id, id)))
        .limit(1);
      return (row as PieceSubtypeRow | undefined) ?? null;
    } else {
      const found = memory.pieceSubtypes.find((s) => s.userId === userId && s.id === id);
      return found ? memSubtypeToRow(found) : null;
    }
  }

  async updatePieceSubtype(
    userId: number,
    id: number,
    patch: Partial<PieceSubtypeInsertClean>
  ): Promise<PieceSubtypeRow | null> {
    const trimmedName = patch.name?.trim();
    const trimmedDesc = patch.description?.trim();

    if (this.useDatabase) {
      // Interdit de passer null (colonne NOT NULL)
      if ((patch as any).pieceTypeId === null) {
        throw new Error("pieceTypeId ne peut pas être null.");
      }
      try {
        const [row] = await db
          .update(schema.pieceSubtypes)
          .set({
            ...(patch.pieceTypeId !== undefined ? { pieceTypeId: patch.pieceTypeId } : {}),
            ...(trimmedName !== undefined ? { name: trimmedName } : {}),
            ...(trimmedDesc !== undefined ? { description: trimmedDesc ?? null } : {}),
            ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(schema.pieceSubtypes.userId, userId), eq(schema.pieceSubtypes.id, id)))
          .returning();
        return (row as PieceSubtypeRow | undefined) ?? null;
      } catch (err: unknown) {
        if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "23505") {
          throw new Error("Ce sous-type existe déjà pour ce type.");
        }
        throw err;
      }
    } else {
      const idx = memory.pieceSubtypes.findIndex((s) => s.userId === userId && s.id === id);
      if (idx === -1) return null;

      const cur = memory.pieceSubtypes[idx];
      const nextPieceTypeId =
        patch.pieceTypeId !== undefined ? patch.pieceTypeId : cur.pieceTypeId;
      const nextName =
        trimmedName !== undefined ? trimmedName : cur.name;

      if (trimmedName !== undefined || patch.pieceTypeId !== undefined) {
        const exists = memory.pieceSubtypes.find(
          (s, i) =>
            i !== idx &&
            s.userId === userId &&
            s.pieceTypeId === nextPieceTypeId &&
            s.name.toLowerCase() === nextName.toLowerCase()
        );
        if (exists) throw new Error("Ce sous-type existe déjà pour ce type.");
      }

      const next: MemoryPieceSubtype = {
        ...cur,
        ...(patch.pieceTypeId !== undefined ? { pieceTypeId: patch.pieceTypeId } : {}),
        ...(trimmedName !== undefined ? { name: trimmedName } : {}),
        ...(trimmedDesc !== undefined ? { description: trimmedDesc ?? null } : {}),
        ...(patch.isActive !== undefined ? { isActive: !!patch.isActive } : {}),
        updatedAt: new Date(),
      };

      memory.pieceSubtypes[idx] = next;
      return memSubtypeToRow(next);
    }
  }

  async deletePieceSubtype(userId: number, id: number): Promise<boolean> {
    if (this.useDatabase) {
      const deleted = await db
        .delete(schema.pieceSubtypes)
        .where(and(eq(schema.pieceSubtypes.userId, userId), eq(schema.pieceSubtypes.id, id)))
        .returning({ id: schema.pieceSubtypes.id });
      return deleted.length > 0;
    } else {
      const before = memory.pieceSubtypes.length;
      memory.pieceSubtypes = memory.pieceSubtypes.filter((s) => !(s.userId === userId && s.id === id));
      return memory.pieceSubtypes.length < before;
    }
  }
}
