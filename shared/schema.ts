import { pgTable, text, serial, timestamp, jsonb, varchar, index } from "drizzle-orm/pg-core";
import { z } from "zod";

// Table sessions pour l'authentification (obligatoire)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Table users pour l'authentification
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull().default("artisan"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Schema de validation manuel (compatible Zod v3/v4)
export const insertUserSchema = z.object({
  username: z.string().min(3, "Nom d'utilisateur minimum 3 caractères"),
  password: z.string().min(6, "Mot de passe minimum 6 caractères"),
  email: z.string().email("Email invalide"),
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  role: z.string().default("artisan"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;