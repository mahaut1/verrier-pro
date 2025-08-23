import { pgTable, text, serial, boolean, timestamp, jsonb, varchar, index, integer, uniqueIndex, numeric } from "drizzle-orm/pg-core";
import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
export const sessions = pgTable("sessions", {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
}, (table) => [index("IDX_session_expire").on(table.expire)]);
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
export const galleries = pgTable("galleries", {
    id: serial('id').primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
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
});
export const pieceTypes = pgTable('pieces_types', {
    id: serial('id').primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
    // Un nom de type ne doit pas être dupliqué pour le même user
    uniqueIndex("ux_piece_types_user_name").on(t.userId, t.name),
]);
export const pieces = pgTable('pieces', {
    id: serial('id').primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
    name: text("name").notNull(),
    uniqueId: text("unique_id").notNull(),
    pieceTypeId: integer("piece_type_id").references(() => pieceTypes.id, { onDelete: "set null" }), dimensions: text("dimensions"),
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
export const stockItems = pgTable("stock_items", {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    category: text("category").notNull(),
    currentQuantity: numeric("current_quantity", { precision: 10, scale: 2 }).notNull(),
    unit: text("unit").notNull(), // ex: 'kg' | 'units' | 'meters'
    minimumThreshold: numeric("minimum_threshold", { precision: 10, scale: 2 }).notNull(),
    supplier: text("supplier"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
    index("stock_items_user_idx").on(t.userId),
    index("stock_items_user_type_idx").on(t.userId, t.type),
    index("stock_items_user_category_idx").on(t.userId, t.category),
    // chaque user ne peut pas avoir deux items avec le même nom
    uniqueIndex("stock_items_user_name_uq").on(t.userId, t.name),
]);
export const stockMovements = pgTable("stock_movements", {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
        .references(() => users.id, { onDelete: "cascade" })
        .notNull(),
    stockItemId: integer("stock_item_id")
        .references(() => stockItems.id, { onDelete: "set null" }),
    type: text("type").notNull(), // 'in' | 'out'
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
    index("stock_mov_user_idx").on(t.userId),
    index("stock_mov_user_item_idx").on(t.userId, t.stockItemId),
    index("stock_mov_user_date_idx").on(t.userId, t.createdAt),
]);
// Insert schemas
// NOTE: numeric -> string (avec transform) 
export const insertStockItemSchema = createInsertSchema(stockItems, {
    currentQuantity: z.union([z.string(), z.number()]).transform((v) => String(v)),
    minimumThreshold: z.union([z.string(), z.number()]).transform((v) => String(v)),
    name: z.string().min(1),
    type: z.string().min(1),
    category: z.string().min(1),
    unit: z.string().min(1),
    supplier: z.string().min(1).optional().nullable(),
    notes: z.string().min(1).optional().nullable(),
}).omit({
    id: true, userId: true, createdAt: true, updatedAt: true,
});
export const insertStockMovementSchema = createInsertSchema(stockMovements, {
    type: z.enum(["in", "out"]),
    quantity: z.union([z.string(), z.number()]).transform((v) => String(v)),
    reason: z.string().min(1),
    notes: z.string().min(1).optional().nullable(),
}).omit({
    id: true, userId: true, createdAt: true,
}).extend({
    stockItemId: z.number().int().positive().optional(), // nullable en DB
});
export const insertGallerySchema = createInsertSchema(galleries).omit({
    id: true, userId: true, createdAt: true, updatedAt: true,
});
export const insertPieceSchema = createInsertSchema(pieces).omit({
    id: true, userId: true, createdAt: true, updatedAt: true,
});
export const insertPieceTypeSchema = createInsertSchema(pieceTypes).omit({
    id: true, userId: true, createdAt: true, updatedAt: true, isActive: true,
});
// Users (role)
export const roleEnum = z.enum(["admin", "artisan", "client"]);
export const insertUserSchema = z.object({
    username: z.string().min(3, "Nom d'utilisateur minimum 3 caractères"),
    password: z.string().min(6, "Mot de passe minimum 6 caractères"),
    email: z.string().email("Email invalide"),
    firstName: z.string().min(1, "Prénom requis"),
    lastName: z.string().min(1, "Nom requis"),
    role: roleEnum.default("artisan"), // ✅ 
});
