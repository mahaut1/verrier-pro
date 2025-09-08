import { db } from "../db.js";
import * as schema from "../../shared/schema.js";
import { eq, sql } from "drizzle-orm";
import type { Role } from "../../shared/schema.js"; 
import { StorageBase, memory, User } from "./storage.base.js";


export interface CreateUserInput {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: Role;       // 'admin' | 'artisan' | 'client'
  password?: string; // hashé avant insertion
}

type DBUserRow = typeof schema.users.$inferSelect;
type DBUserInsert = typeof schema.users.$inferInsert;

function mapDbUser(r: DBUserRow): User {
  return {
    id: Number(r.id),
    username: r.username,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    role: r.role as Role,
    password: r.password ?? "",
    createdAt: r.createdAt ?? new Date(),
  };
}

export class UsersStorage extends StorageBase {

    async getUserByEmail(email: string): Promise<User | null> {
    const norm = email.trim().toLowerCase();
    if (this.useDatabase) {
      await this.assertDbOrFallback("getUserByEmail");
      const rows = await db
        .select()
        .from(schema.users)
        .where(sql`lower(${schema.users.email}) = ${norm}`)
        .limit(1);
      const r = rows[0];
      return r ? mapDbUser(r) : null;
    }
    return memory.users.find((u) => u.email.toLowerCase() === norm) ?? null;
  }

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

      const r = rows[0];
      return r ? mapDbUser(r) : null;
    }

    return memory.users.find((u) => u.username === username) ?? null;
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

      const r = rows[0];
      return r ? mapDbUser(r) : null;
    }

    return memory.users.find((u) => u.id === id) ?? null;
  }
    async createUser(input: CreateUserInput): Promise<User> {
    console.log("🔍 *** CREATEUSER APPELÉ ***");
    console.log("🔍 CreateUser - useDatabase:", this.useDatabase);
    console.log("🔍 CreateUser - user data:", {
      username: input.username,
      email: input.email,
    });

    if (this.useDatabase) {
      await this.assertDbOrFallback("createUser");
    }

    const safe: Required<CreateUserInput> = {
      username: input.username,
      email: input.email.trim().toLowerCase(),
      firstName: input.firstName ?? "",
      lastName: input.lastName ?? "",
      role: input.role ?? "artisan",
      password: input.password ?? "",
    };

      if (this.useDatabase) {
      const toInsert: DBUserInsert = {
        username: safe.username,
        email: safe.email,
        firstName: safe.firstName,
        lastName: safe.lastName,
        role: safe.role,
        password: safe.password,
      };

      try {
        const inserted = await db.insert(schema.users).values(toInsert).returning();
        const r = inserted[0];
        if (!r) throw new Error("Insertion utilisateur échouée");
        return mapDbUser(r);
      } catch (err: any) {
        const code = err?.code ?? err?.cause?.code;
        const constraint = err?.constraint ?? err?.cause?.constraint ?? "";
        if (code === "23505") {
          const out: any = new Error(
            constraint.includes("email") ? "email already exists" :
            constraint.includes("username") ? "username already exists" :
            "unique violation"
          );
          out.code = "23505";
          out.constraint = constraint;
          throw out;
        }
        throw err;
      }
    }


    // Mémoire
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
