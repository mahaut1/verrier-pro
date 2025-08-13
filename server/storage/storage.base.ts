import { db } from "../db";
import { Role } from "@shared/schema";

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

export const memory = {
  users: [] as User[],
  galleries: [] as any[],
  pieces: [] as any[],
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

  protected async assertDbOrFallback(label = "Generic") {
    if (!this.useDatabase) return;
    try {
      await db.execute("SELECT 1");
    } catch {
      this.useDatabase = false;
      seedMemoryOnce();
    }
  }
}
