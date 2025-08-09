import { db } from "../db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Role } from "@shared/schema"; // ✅ Ajout import du type Role
import { StorageBase, memory, User } from "./storage.base";

// ✅ Redéfinition du type CreateUserInput ici
export interface CreateUserInput {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: Role;       // 'admin' | 'artisan' | 'client'
  password?: string; // hashé avant insertion
}

export class UsersStorage extends StorageBase {
  async getUserByUsername(username: string): Promise<User | null> {
    console.log("🔍 GetUserByUsername - useDatabase:", this.useDatabase);
    if (this.useDatabase) {
      await this.assertDbOrFallback("getUserByUsername");
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
            password: r.password ?? "",
            createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          }
        : null;
    } else {
      return memory.users.find((u) => u.username === username) ?? null;
    }
  }

  async getUserById(id: number): Promise<User | null> {
    console.log("🔍 GetUserById - useDatabase:", this.useDatabase);
    if (this.useDatabase) {
      await this.assertDbOrFallback("getUserById");
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
            password: r.password ?? "",
            createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          }
        : null;
    } else {
      return memory.users.find((u) => u.id === id) ?? null;
    }
  }

  async createUser(input: CreateUserInput): Promise<User> {
    console.log("🔍 *** CREATEUSER APPELÉ ***");
    console.log("🔍 CreateUser - useDatabase:", this.useDatabase);
    console.log("🔍 CreateUser - user data:", { username: input.username, email: input.email });

    if (this.useDatabase) {
      await this.assertDbOrFallback("createUser");
    }

    const safe: Required<CreateUserInput> = {
      username: input.username,
      email: input.email,
      firstName: input.firstName ?? "",
      lastName: input.lastName ?? "",
      role: (input.role as Role) ?? "artisan",
      password: input.password ?? "",
    };

    if (this.useDatabase) {
      const inserted = await db
        .insert(schema.users)
        .values({
          username: safe.username,
          email: safe.email,
          firstName: safe.firstName,
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
        password: r.password ?? "",
        createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      };
      console.log("✅ *** USER CREATED IN DB ***:", user.id, user.username);
      return user;
    } else {
      const nextId = memory.users.length ? Math.max(...memory.users.map((u) => u.id)) + 1 : 1;
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
      console.log("📝 *** INSERTING USER IN MEMORY ***");
      console.log("✅ *** USER CREATED IN MEMORY ***:", user.id, user.username);
      return user;
    }
  }

  async getUser(username: string): Promise<User | null> {
    console.log("🔍 GetUser - useDatabase:", this.useDatabase);
    if (this.useDatabase) {
      await this.assertDbOrFallback("getUser");
      return this.getUserByUsername(username);
    } else {
      return memory.users.find((u) => u.username === username) ?? null;
    }
  }
}
