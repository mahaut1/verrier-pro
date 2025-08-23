import { db } from "../db.js";
import type { Role } from "../../shared/schema.js";

export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  password: string;
  createdAt: Date;
}

export interface MemoryGallery {
  id: number;
  userId: number;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  commissionRate?: number | string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryPieceType {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface MemoryPiece {
  id: number;
  userId: number;
  name: string;
  uniqueId: string;
  pieceTypeId: number | null;           
  dimensions: string | null;
  dominantColor: string | null;
  description: string | null;
  status: string;                       
  currentLocation: string;              
  galleryId: number | null;
  price: number | string | null;        
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryStockItem {
  id: number;
  userId: number;
  name: string;
  type: string;         
  category: string;      
  currentQuantity: number;
  unit: string;         
  minimumThreshold: number;
  supplier: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryStockMovement {
  id: number;
  userId: number;
  stockItemId: number | null; // peut être null si l’article est supprimé
  type: "in" | "out";
  quantity: number;
  reason: string;
  notes: string | null;
  createdAt: Date;
}

export type PieceListQuery = {
  status?: string;
  pieceTypeId?: number;                
  galleryId?: number;
};

export const memory = {
  users: [] as User[],
  galleries: [] as MemoryGallery[],
  pieces: [] as MemoryPiece[],
  pieceTypes: [] as MemoryPieceType[],
    stockItems: [] as MemoryStockItem[],        
  stockMovements: [] as MemoryStockMovement[]
};


export function seedMemoryOnce() {
  if (memory.users.length === 0) {
    memory.users.push({
      id: 1,
      username: "cesium",
      email: "cesium@example.com",
      firstName: "Cesium",
      lastName: "User",
      role: "admin",
      password: "admin123",
      createdAt: new Date(),
    });
  }
}



export class StorageBase {
  public useDatabase: boolean;

  constructor() {
    const hasDbUrl = !!process.env.DATABASE_URL;
    const forceMemory = process.env.MEMORY_ONLY === "true";
    this.useDatabase = hasDbUrl && !forceMemory;

    if (!this.useDatabase) seedMemoryOnce();
  }

  protected async assertDbOrFallback(_label = "Generic") {
    if (!this.useDatabase) return;
    try {
      await db.execute("SELECT 1");
    } catch {
      this.useDatabase = false;
      seedMemoryOnce();
    }
  }
}
