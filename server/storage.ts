// server/storage.ts
import { db } from './db';
import * as schema from '@shared/schema';
import { galleries, pieces } from '@shared/schema';
import { and, eq, like, SQL } from 'drizzle-orm';
import type { Role } from '@shared/schema';

// Types d’E/S pour le stockage
export interface CreateUserInput {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: Role;       // 'admin' | 'artisan' | 'client'
  password?: string; // hashé avant insertion (bcrypt)
}

export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  password: string;      // hash
  createdAt: Date;
}

type GalleryInsert = typeof galleries.$inferInsert;
type GalleryRow    = typeof galleries.$inferSelect;
type PieceInsert   = typeof pieces.$inferInsert;
type PieceRow      = typeof pieces.$inferSelect;

// Stockage mémoire (fallback)
const memory = {
  users: [] as User[],
    galleries: [] as GalleryRow[],
  pieces: [] as PieceRow[],
};

function seedMemoryOnce() {
  if (memory.users.length === 0) {
    memory.users.push({
      id: 1,
      username: 'cesium',
      email: 'cesium@example.com',
      firstName: 'Cesium',
      lastName: 'User',
      role: 'admin',
      password: 'admin123', // dev only
      createdAt: new Date(),
    });
  }
}

function previewEnv(val?: string) {
  if (!val) return 'undefined';
  return val.length > 40 ? val.slice(0, 40) + '...' : val;
}

export class Storage {
  public useDatabase: boolean;

  constructor() {
    const hasDbUrl = !!process.env.DATABASE_URL;
    const forceMemory = process.env.MEMORY_ONLY === 'true';

    console.log('🔍 Détection environnement storage:');
    console.log('  DATABASE_URL:', previewEnv(process.env.DATABASE_URL));
    console.log('  MEMORY_ONLY:', !!forceMemory);

    this.useDatabase = hasDbUrl && !forceMemory;

    if (!this.useDatabase) {
      seedMemoryOnce();
      console.log('📝 *** MÉMOIRE ACTIVÉE - MODE DÉVELOPPEMENT ***');
      console.log('📝 Stockage mémoire activé - utilisateur test cesium/admin123 disponible');
    }

    console.log('  *** useDatabase FINAL:', this.useDatabase, '***');
    console.log('🔍 *** STORAGE IMPORTÉ ET INSTANCIÉ ***');
  }

  // Vérifie la DB et bascule en mémoire si KO
  private async assertDbOrFallback(label = 'Generic') {
    if (!this.useDatabase) return;
    try {
      await db.execute(/* sql */`SELECT 1`);
    } catch (err: any) {
      console.log(`❌ PostgreSQL connection failed during "${label}", switching to memory fallback:`, err?.message ?? err);
      console.log('🔄 AUTOMATIC FALLBACK: Activating memory storage due to connection error');
      this.useDatabase = false;
      seedMemoryOnce();
    }
  }

  // --- USERS ---

  async getUserByUsername(username: string): Promise<User | null> {
    console.log('🔍 GetUserByUsername - useDatabase:', this.useDatabase);
    if (this.useDatabase) {
      await this.assertDbOrFallback('getUserByUsername');
    }
    if (this.useDatabase) {
      const rows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.username, username))
        .limit(1);
      const r = rows[0] as any;
      return r
        ? {
            id: Number(r.id),
            username: r.username,
            email: r.email,
            firstName: r.firstName,
            lastName: r.lastName,
            role: r.role as Role,
            password: r.password ?? '',
            createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          }
        : null;
    } else {
      return memory.users.find(u => u.username === username) ?? null;
    }
  }

  async getUserById(id: number): Promise<User | null> {
    console.log('🔍 GetUserById - useDatabase:', this.useDatabase);
    if (this.useDatabase) {
      await this.assertDbOrFallback('getUserById');
      const rows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, id))
        .limit(1);
      const r = rows[0] as any;
      return r
        ? {
            id: Number(r.id),
            username: r.username,
            email: r.email,
            firstName: r.firstName,
            lastName: r.lastName,
            role: r.role as Role,
            password: r.password ?? '',
            createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          }
        : null;
    } else {
      return memory.users.find(u => u.id === id) ?? null;
    }
  }

  async createUser(input: CreateUserInput): Promise<User> {
    console.log('🔍 *** CREATEUSER APPELÉ ***');
    console.log('🔍 CreateUser - useDatabase:', this.useDatabase);
    console.log('🔍 CreateUser - user data:', { username: input.username, email: input.email });

    if (this.useDatabase) {
      await this.assertDbOrFallback('createUser');
    }

    const safe: Required<CreateUserInput> = {
      username: input.username,
      email: input.email,
      firstName: input.firstName ?? '',
      lastName: input.lastName ?? '',
      role: (input.role as Role) ?? 'artisan',
      password: input.password ?? '',
    };

    if (this.useDatabase) {
      const inserted = await db
        .insert(schema.users)
        .values({
          username: safe.username,
          email: safe.email,
          firstName: safe.firstName, // camelCase dans Drizzle
          lastName: safe.lastName,
          role: safe.role,
          password: safe.password,
        })
        .returning();

      const r = inserted[0] as any;
      const user: User = {
        id: Number(r.id),
        username: r.username,
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        role: r.role as Role,
        password: r.password ?? '',
        createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      };
      console.log('✅ *** USER CREATED IN DB ***:', user.id, user.username);
      return user;
    } else {
      const nextId = memory.users.length ? Math.max(...memory.users.map(u => u.id)) + 1 : 1;
      const user: User = {
        id: nextId,
        username: safe.username,
        email: safe.email,
        firstName: safe.firstName,
        lastName: safe.lastName,
        role: safe.role,
        password: safe.password,
        createdAt: new Date(),
      };
      memory.users.push(user);
      console.log('📝 *** INSERTING USER IN MEMORY ***');
      console.log('✅ *** USER CREATED IN MEMORY ***:', user.id, user.username);
      return user;
    }
  }

  // Compat : ancien getUser par username
  async getUser(username: string): Promise<User | null> {
    console.log('🔍 GetUser - useDatabase:', this.useDatabase);
    if (this.useDatabase) {
      await this.assertDbOrFallback('getUser');
      return this.getUserByUsername(username);
    } else {
      return memory.users.find(u => u.username === username) ?? null;
    }
  }

  // --- GALLERIES ---
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

// --- PIECES ---
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
export const storage = new Storage(); 