import { db } from "../db";
import { galleries } from "@shared/schema";
import { and, eq, like, SQL } from "drizzle-orm";
import { StorageBase, memory } from "./storage.base";

type GalleryInsert = typeof galleries.$inferInsert;
type GalleryRow = typeof galleries.$inferSelect;


export class GalleriesStorage extends StorageBase {
    async createGallery(
      userId: number,
      data: Omit<GalleryInsert, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
    ) {
      if (this.useDatabase) {
        const [row] = await db.insert(galleries).values({ ...data, userId }).returning();
        return row as GalleryRow;
      } else {
        const id = memory.galleries.length ? Math.max(...memory.galleries.map(g => g.id!)) + 1 : 1;
        const row: GalleryRow = {
          id,
          userId,
          name: data.name,
          contactPerson: data.contactPerson ?? null,
          email: data.email ?? null,
          phone: data.phone ?? null,
          address: (data as any).address ?? null, // selon ton schéma
          city: (data as any).city ?? null,
          country: (data as any).country ?? null,
          commissionRate: (data as any).commissionRate ?? null,
          notes: data.notes ?? null,
          isActive: (data as any).isActive ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        memory.galleries.push(row);
        return row;
      }
    }
    
    async listGalleries(
      userId: number,
      q?: { isActive?: boolean; q?: string }
    ) {
      const filters: SQL[] = [eq(galleries.userId, userId)];
    
      if (typeof q?.isActive === 'boolean') {
        filters.push(eq(galleries.isActive, q.isActive));
      }
    
      if (q?.q) {
        // Exemple de recherche simple sur le nom
        filters.push(like(galleries.name, `%${q.q}%`));
      }
    
      const whereExpr = filters.length > 1 ? and(...filters) : filters[0];
    
      return db.select().from(galleries).where(whereExpr);
    }
    
    async updateGallery(userId: number, id: number, patch: Partial<GalleryInsert>): Promise<GalleryRow | null> {
      const [row] = await db
        .update(galleries)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(galleries.userId, userId), eq(galleries.id, id)))
        .returning();
      return row ?? null;
    }
    
    async deleteGallery(userId: number, id: number): Promise<boolean> {
      const deleted = await db
        .delete(galleries)
        .where(and(eq(galleries.userId, userId), eq(galleries.id, id)))
        .returning({ id: galleries.id });
      return deleted.length > 0;
    }
    
    
    async getGalleryById(userId: number, id: number) {
      if (this.useDatabase) {
        const [row] = await db
          .select()
          .from(galleries)
          .where(and(eq(galleries.userId, userId), eq(galleries.id, id)))
          .limit(1);
        return row ?? null;
      } else {
        return memory.galleries.find(g => g.userId === userId && g.id === id) ?? null;
      }
    }
}