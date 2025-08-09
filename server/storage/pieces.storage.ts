import { db } from "../db";
import * as schema from "@shared/schema";
import { and, eq, SQL } from "drizzle-orm";
import { StorageBase, memory } from "./storage.base";
import { pieces } from "@shared/schema";

type PieceInsert = typeof schema.pieces.$inferInsert;
type PieceRow = typeof schema.pieces.$inferSelect;

export class PiecesStorage extends StorageBase {
 async createPiece(
   userId: number,
   data: Omit<PieceInsert, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
 ): Promise<PieceRow> {
   if (this.useDatabase) {
     const [row] = await db.insert(pieces).values({ ...data, userId }).returning();
     return row as PieceRow;
   } else {
     const id = memory.pieces.length ? Math.max(...memory.pieces.map(p => p.id!)) + 1 : 1;
     const row: PieceRow = {
       id,
       userId,
       name: data.name,
       uniqueId: data.uniqueId,
       type: data.type,
       dimensions: data.dimensions ?? null,
       dominantColor: data.dominantColor ?? null,
       description: data.description ?? null,
       status: (data as any).status ?? 'workshop',
       currentLocation: (data as any).currentLocation ?? 'atelier',
       galleryId: (data as any).galleryId ?? null,
       price: (data as any).price ?? null,
       imageUrl: data.imageUrl ?? null,
       createdAt: new Date(),
       updatedAt: new Date(),
       // uniqueId si tu l’ajoutes plus tard dans le schéma
       ...(('uniqueId' in (data as any)) ? { uniqueId: (data as any).uniqueId } : {}),
     };
     memory.pieces.push(row);
     return row;
   }
 }
 
 async listPieces(
   userId: number,
   q?: { status?: string; type?: string; galleryId?: number }
 ): Promise<PieceRow[]> {
   if (this.useDatabase) {
     const filters: SQL[] = [eq(pieces.userId, userId)];
     if (q?.status) filters.push(eq(pieces.status, q.status));
     if (q?.type) filters.push(eq(pieces.type, q.type));
     if (q?.galleryId != null) filters.push(eq(pieces.galleryId, q.galleryId));
     const whereExpr = filters.length > 1 ? and(...filters) : filters[0];
     return db.select().from(pieces).where(whereExpr);
   } else {
     return memory.pieces.filter(p =>
       p.userId === userId &&
       (q?.status ? p.status === q.status : true) &&
       (q?.type ? p.type === q.type : true) &&
       (q?.galleryId != null ? p.galleryId === q.galleryId : true)
     );
   }
 }
 
 async getPieceById(userId: number, id: number): Promise<PieceRow | null> {
   if (this.useDatabase) {
     const [row] = await db
       .select()
       .from(pieces)
       .where(and(eq(pieces.userId, userId), eq(pieces.id, id)))
       .limit(1);
     return row ?? null;
   } else {
     return memory.pieces.find(p => p.userId === userId && p.id === id) ?? null;
   }
 }
 
 async updatePiece(
   userId: number,
   id: number,
   patch: Partial<Omit<PieceInsert, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
 ): Promise<PieceRow | null> {
   if (this.useDatabase) {
     const [row] = await db
       .update(pieces)
       .set({ ...(patch as any), updatedAt: new Date() })
       .where(and(eq(pieces.userId, userId), eq(pieces.id, id)))
       .returning();
     return row ?? null;
   } else {
     const idx = memory.pieces.findIndex(p => p.userId === userId && p.id === id);
     if (idx === -1) return null;
     const updated: PieceRow = { ...memory.pieces[idx], ...(patch as any), updatedAt: new Date() };
     memory.pieces[idx] = updated;
     return updated;
   }
 }
 
 async deletePiece(userId: number, id: number): Promise<boolean> {
   if (this.useDatabase) {
     const deleted = await db
       .delete(pieces)
       .where(and(eq(pieces.userId, userId), eq(pieces.id, id)))
       .returning({ id: pieces.id });
     return deleted.length > 0;
   } else {
     const before = memory.pieces.length;
     memory.pieces = memory.pieces.filter(p => !(p.userId === userId && p.id === id));
     return memory.pieces.length < before;
   }
 }
 
 async setPieceImage(userId: number, id: number, imageUrl: string): Promise<PieceRow | null> {
   if (this.useDatabase) {
     const [row] = await db
       .update(pieces)
       .set({ imageUrl, updatedAt: new Date() })
       .where(and(eq(pieces.userId, userId), eq(pieces.id, id)))
       .returning();
     return row ?? null;
   } else {
     const idx = memory.pieces.findIndex(p => p.userId === userId && p.id === id);
     if (idx === -1) return null;
     const updated: PieceRow = { ...memory.pieces[idx], imageUrl, updatedAt: new Date() };
     memory.pieces[idx] = updated;
     return updated;
   }
 }
 
 async clearPieceImage(userId: number, id: number): Promise<PieceRow | null> {
   if (this.useDatabase) {
     const [row] = await db
       .update(pieces)
       .set({ imageUrl: null, updatedAt: new Date() })
       .where(and(eq(pieces.userId, userId), eq(pieces.id, id)))
       .returning();
     return row ?? null;
   } else {
     const idx = memory.pieces.findIndex(p => p.userId === userId && p.id === id);
     if (idx === -1) return null;
     const updated: PieceRow = { ...memory.pieces[idx], imageUrl: null, updatedAt: new Date() };
     memory.pieces[idx] = updated;
     return updated;
   }
 }
}
