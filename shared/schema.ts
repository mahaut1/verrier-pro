
import { pgTable, text, serial,boolean, timestamp, jsonb, varchar, index, integer, uniqueIndex, numeric } from "drizzle-orm/pg-core";
import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

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

export const galleries= pgTable("galleries",{
  id:serial('id').primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text("name").notNull(),
  contactPerson:text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
})

export const pieces = pgTable('pieces',{
  id:serial('id').primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text("name").notNull(),
    uniqueId: text("unique_id").notNull().unique(),
  type: text("type").notNull(),
  dimensions: text("dimensions"),
  dominantColor: text("dominant_color"),
  description: text("description"),
  status: text("status").notNull().default("workshop"), // ✅
  currentLocation: text("current_location").notNull().default("atelier"), // ✅
  galleryId: integer("gallery_id").references(() => galleries.id, { onDelete: 'set null' }),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  uniqueIndex('ux_pieces_user_uniqueid').on(t.userId, t.uniqueId),
]);
// Insert schemas
export const insertGallerySchema = createInsertSchema(galleries).omit({
  id: true, userId: true, createdAt: true, updatedAt: true,
});

export const insertPieceSchema = createInsertSchema(pieces).omit({
  id: true, userId: true, createdAt: true, updatedAt: true,
});

// Users (role)
export const roleEnum = z.enum(["admin", "artisan", "client"]);
export type Role = z.infer<typeof roleEnum>;
export const insertUserSchema = z.object({
  username: z.string().min(3, "Nom d'utilisateur minimum 3 caractères"),
  password: z.string().min(6, "Mot de passe minimum 6 caractères"),
  email: z.string().email("Email invalide"),
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  role: roleEnum.default("artisan"), // ✅ 
});


// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Gallery = typeof galleries.$inferSelect;
export type InsertGallery = z.infer<typeof insertGallerySchema>;
export type Piece = typeof pieces.$inferSelect;
export type InsertPiece = z.infer<typeof insertPieceSchema>