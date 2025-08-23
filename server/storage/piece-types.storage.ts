import { db } from "../db.js";
import * as schema from "../../shared/schema.js";
import { and, eq, like, SQL } from "drizzle-orm";
import { StorageBase, memory, type MemoryPieceType } from "./storage.base.js";


type PieceTypeInsert       = typeof schema.pieceTypes.$inferInsert;
type PieceTypeRow          = typeof schema.pieceTypes.$inferSelect;
type PieceTypeInsertClean  = Omit<PieceTypeInsert, "id" | "userId" | "createdAt" | "updatedAt">;

export type PieceTypeListQuery = {
  isActive?: boolean;
  q?: string; // recherche par nom
};

// mapping mémoire -> row (pour rester 0 any)
const memTypeToRow = (t: MemoryPieceType): PieceTypeRow => ({
  id: t.id,
  userId: t.userId,
  name: t.name,
  description: t.description, // déjà string|null
  isActive: t.isActive,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});

export class PieceTypesStorage extends StorageBase {
  async createPieceType(userId: number, data: PieceTypeInsertClean): Promise<PieceTypeRow> {
    const safeName = data.name.trim();
    const safeDesc = data.description?.trim() ?? null;
    const safeActive = data.isActive ?? true;

    if (this.useDatabase) {
      try {
        const [row] = await db
          .insert(schema.pieceTypes)
          .values({ userId, name: safeName, description: safeDesc, isActive: safeActive })
          .returning();
        return row as PieceTypeRow;
      } catch (err: unknown) {
        if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "23505") {
          throw new Error("Ce nom de type existe déjà.");
        }
        throw err;
      }
    } else {
      // unicité (userId, name) en mémoire
      const dup = memory.pieceTypes.find(
        (t) => t.userId === userId && t.name.toLowerCase() === safeName.toLowerCase()
      );
      if (dup) throw new Error("Ce nom de type existe déjà.");

      const id = memory.pieceTypes.length ? Math.max(...memory.pieceTypes.map(t => t.id)) + 1 : 1;

      const row: MemoryPieceType = {
        id,
        userId,
        name: safeName,
        description: safeDesc,     
        isActive: !!safeActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      memory.pieceTypes.push(row);
      return memTypeToRow(row);
    }
  }

  async listPieceTypes(userId: number, q?: PieceTypeListQuery): Promise<PieceTypeRow[]> {
    if (this.useDatabase) {
      const filters: SQL[] = [eq(schema.pieceTypes.userId, userId)];
      if (typeof q?.isActive === "boolean") filters.push(eq(schema.pieceTypes.isActive, q.isActive));
      if (q?.q) filters.push(like(schema.pieceTypes.name, `%${q.q}%`));
      const whereExpr = filters.length > 1 ? and(...filters) : filters[0];
      return db.select().from(schema.pieceTypes).where(whereExpr);
    } else {
      return memory.pieceTypes
        .filter(
          (t) =>
            t.userId === userId &&
            (typeof q?.isActive === "boolean" ? t.isActive === q.isActive : true) &&
            (q?.q ? t.name.toLowerCase().includes(q.q.toLowerCase()) : true)
        )
        .map(memTypeToRow);
    }
  }

  async getPieceTypeById(userId: number, id: number): Promise<PieceTypeRow | null> {
    if (this.useDatabase) {
      const [row] = await db
        .select()
        .from(schema.pieceTypes)
        .where(and(eq(schema.pieceTypes.userId, userId), eq(schema.pieceTypes.id, id)))
        .limit(1);
      return (row as PieceTypeRow | undefined) ?? null;
    } else {
      const found = memory.pieceTypes.find((t) => t.userId === userId && t.id === id);
      return found ? memTypeToRow(found) : null;
    }
  }

  async updatePieceType(
    userId: number,
    id: number,
    patch: Partial<PieceTypeInsertClean>
  ): Promise<PieceTypeRow | null> {
    // sanitise
    const trimmedName = patch.name?.trim();
    const trimmedDesc = patch.description?.trim();

    if (this.useDatabase) {
      try {
        const [row] = await db
          .update(schema.pieceTypes)
          .set({
            ...(trimmedName !== undefined ? { name: trimmedName } : {}),
            ...(trimmedDesc !== undefined ? { description: trimmedDesc ?? null } : {}),
            ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(schema.pieceTypes.userId, userId), eq(schema.pieceTypes.id, id)))
          .returning();
        return (row as PieceTypeRow | undefined) ?? null;
      } catch (err: unknown) {
        if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "23505") {
          throw new Error("Ce nom de type existe déjà.");
        }
        throw err;
      }
    } else {
      const idx = memory.pieceTypes.findIndex((t) => t.userId === userId && t.id === id);
      if (idx === -1) return null;

      // si on change le name, vérifier unicité
      if (trimmedName) {
        const exists = memory.pieceTypes.find(
          (t, i) =>
            i !== idx &&
            t.userId === userId &&
            t.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (exists) throw new Error("Ce nom de type existe déjà.");
      }

      const cur = memory.pieceTypes[idx];
      const next: MemoryPieceType = {
        ...cur,
        ...(trimmedName !== undefined ? { name: trimmedName } : {}),
        ...(trimmedDesc !== undefined ? { description: trimmedDesc ?? null } : {}),
        ...(patch.isActive !== undefined ? { isActive: !!patch.isActive } : {}),
        updatedAt: new Date(),
      };

      memory.pieceTypes[idx] = next;
      return memTypeToRow(next);
    }
  }

  async deletePieceType(userId: number, id: number): Promise<boolean> {
    if (this.useDatabase) {
      const deleted = await db
        .delete(schema.pieceTypes)
        .where(and(eq(schema.pieceTypes.userId, userId), eq(schema.pieceTypes.id, id)))
        .returning({ id: schema.pieceTypes.id });
      return deleted.length > 0;
    } else {
      const before = memory.pieceTypes.length;
      memory.pieceTypes = memory.pieceTypes.filter((t) => !(t.userId === userId && t.id === id));
      return memory.pieceTypes.length < before;
    }
  }
}
