import { db } from "../db";
import { galleries } from "@shared/schema";
import { and, eq, like, SQL } from "drizzle-orm";
import { StorageBase, memory } from "./storage.base";

type GalleryInsert = typeof galleries.$inferInsert;
type GalleryRow = typeof galleries.$inferSelect;

function toNumericString(v: unknown): string | null {
  if (v == null) return null;
  return typeof v === "number" ? String(v) : (v as string);
}

export class GalleriesStorage extends StorageBase {  async createGallery(
    userId: number,
    data: Omit<GalleryInsert, "id" | "userId" | "createdAt" | "updatedAt">
  ): Promise<GalleryRow> {
    if (this.useDatabase) {
      const [row] = await db
        .insert(galleries)
        .values({ ...data, userId })
        .returning();
      return row as GalleryRow;
    }

    // Mémoire
    const mem = memory.galleries as unknown as GalleryRow[];
    const id = mem.length ? Math.max(...mem.map(g => g.id!)) + 1 : 1;

    const row: GalleryRow = {
      id,
      userId,
      name: data.name,
      contactPerson: data.contactPerson ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      address: (data as any).address ?? null,   
      city: (data as any).city ?? null,
      country: (data as any).country ?? null,
      commissionRate: toNumericString((data as any).commissionRate),
      notes: data.notes ?? null,
      isActive: (data as any).isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mem.push(row);
    return row;
  }
    
  async listGalleries(
    userId: number,
    q?: { isActive?: boolean; q?: string }
  ): Promise<GalleryRow[]> {
    if (this.useDatabase) {
      const filters: SQL[] = [eq(galleries.userId, userId)];
      if (typeof q?.isActive === "boolean") {
        filters.push(eq(galleries.isActive, q.isActive));
      }
      if (q?.q) {
        // Recherche simple sur le nom (LIKE)
        filters.push(like(galleries.name, `%${q.q}%`));
      }
      const whereExpr = filters.length > 1 ? and(...filters) : filters[0];
      return db.select().from(galleries).where(whereExpr);
    }

    // Mémoire
    const mem = memory.galleries as unknown as GalleryRow[];
    return mem.filter(g =>
      g.userId === userId &&
      (typeof q?.isActive === "boolean" ? g.isActive === q.isActive : true) &&
      (q?.q ? g.name.toLowerCase().includes(q.q.toLowerCase()) : true)
    );
  }
    

  async updateGallery(
    userId: number,
    id: number,
    patch: Partial<Omit<GalleryInsert, "id" | "userId" | "createdAt" | "updatedAt">>
  ): Promise<GalleryRow | null> {
    if (this.useDatabase) {
      const [row] = await db
        .update(galleries)
        .set({
          ...patch,
          // garantir la cohérence numeric -> string si fourni
          commissionRate:
            (patch as any).commissionRate !== undefined
              ? toNumericString((patch as any).commissionRate)
              : (undefined as unknown as string | null),
          updatedAt: new Date(),
        })
        .where(and(eq(galleries.userId, userId), eq(galleries.id, id)))
        .returning();
      return row ?? null;
    }

    // Mémoire
    const mem = memory.galleries as unknown as GalleryRow[];
    const idx = mem.findIndex(g => g.userId === userId && g.id === id);
    if (idx === -1) return null;

    const current = mem[idx];
    const next: GalleryRow = {
      ...current,
      ...patch,
      commissionRate:
        (patch as any).commissionRate !== undefined
          ? toNumericString((patch as any).commissionRate)
          : current.commissionRate,
      updatedAt: new Date(),
    };
    mem[idx] = next;
    return next;
  }

    
   async deleteGallery(userId: number, id: number): Promise<boolean> {
    if (this.useDatabase) {
      const deleted = await db
        .delete(galleries)
        .where(and(eq(galleries.userId, userId), eq(galleries.id, id)))
        .returning({ id: galleries.id });
      return deleted.length > 0;
    }

    // Mémoire
    const mem = memory.galleries as unknown as GalleryRow[];
    const before = mem.length;
    const after = mem.filter(g => !(g.userId === userId && g.id === id));
    (memory.galleries as unknown as GalleryRow[]) = after; // remplace le contenu
    return after.length < before;
  }
    
    async getGalleryById(userId: number, id: number): Promise<GalleryRow | null> {
    if (this.useDatabase) {
      const [row] = await db
        .select()
        .from(galleries)
        .where(and(eq(galleries.userId, userId), eq(galleries.id, id)))
        .limit(1);
      return row ?? null;
    }

    const mem = memory.galleries as unknown as GalleryRow[];
    return mem.find(g => g.userId === userId && g.id === id) ?? null;
  }
}