import { and, eq, inArray, sql, asc } from "drizzle-orm";
import type { SQL, AnyColumn } from "drizzle-orm";
import { db } from "../db.js";
import { StorageBase, memory } from "./storage.base.js";
import { pieces, stockItems, orders, galleries } from "../../shared/schema.js";

type StockItemRow = typeof stockItems.$inferSelect;


/** Statuts d’ordres considérés "actifs" et "en transit"  */
const ACTIVE_ORDER_STATUSES = ["pending", "processing", "shipped"] as const;
const IN_TRANSIT_STATUSES   = ["transit", "shipped"] as const;
type ActiveOrderStatus   = typeof ACTIVE_ORDER_STATUSES[number];
type InTransitOrderStatus = typeof IN_TRANSIT_STATUSES[number];

/** BRANCHE MÉMOIRE : types internes supposés (numériques en number)  */
interface MemoryStockItem {
  id: number;
  userId: number;
  name: string;
  type: string;
  category: string;
  currentQuantity: number; // number en mémoire
  unit: string;
  minimumThreshold: number; // number en mémoire
  supplier: string | null;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface MemoryOrder {
  id: number;
  userId: number;
  orderNumber: string;
  status: ActiveOrderStatus | InTransitOrderStatus | "delivered" | "cancelled" | string;
  galleryId: number | null;
  totalAmount: number | null; // number en mémoire
  shippingAddress: string | null;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
}

interface MemoryPiece {
  id: number;
  userId: number;
  name: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface MemoryGallery {
  id: number;
  userId: number;
  isActive: boolean;
}


/** Retourne une expression SQL "numeric" sûre à partir d’une colonne ou d’un SQL */
function sqlSafeNumeric(expr: SQL | AnyColumn): SQL {
  // Cast -> text, trim, regex numérique simple, remplace la virgule, cast -> numeric, sinon 0
  return sql`CASE
    WHEN btrim((${expr})::text) ~ '^[+-]?[0-9]+([.,][0-9]+)?$'
      THEN replace(btrim((${expr})::text), ',', '.')::numeric
    ELSE 0::numeric
  END`;
}

/** Adaptateurs mémoire -> forme API (DB-like) : number → string pour les NUMERIC */
function adaptStockItemMemoryToRow(m: MemoryStockItem): StockItemRow {
  return {
    id: m.id,
    userId: m.userId,
    name: m.name,
    type: m.type,
    category: m.category,
    unit: m.unit,
    // les colonnes NUMERIC de la couche DB/Schema sont en string
    currentQuantity: String(m.currentQuantity),
    minimumThreshold: String(m.minimumThreshold),
    supplier: m.supplier,
    notes: m.notes,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

export class DashboardStorage extends StorageBase {
  /** Stats agrégées pour le dashboard */
  async getStats(userId: number): Promise<{
    totalPieces: number;
    piecesThisMonth: number;
    piecesPrevMonth: number;
    lowStockCount: number;
    activeOrders: number;
    inTransitOrders: number;
    totalGalleries: number;
    activeGalleries: number;
  }> {
    if (this.useDatabase) {
      // Pièces totales
      const [{ c: totalPieces }] = await db
        .select({ c: sql<number>`count(*)` })
        .from(pieces)
        .where(eq(pieces.userId, userId));

      // Pièces créées ce mois
      const [{ c: piecesThisMonth }] = await db
        .select({ c: sql<number>`count(*)` })
        .from(pieces)
        .where(and(
          eq(pieces.userId, userId),
          sql`${pieces.createdAt} >= date_trunc('month', now())`
        ));

      // Pièces créées le mois dernier
      const [{ c: piecesPrevMonth }] = await db
        .select({ c: sql<number>`count(*)` })
        .from(pieces)
        .where(and(
          eq(pieces.userId, userId),
          sql`${pieces.createdAt} >= date_trunc('month', now()) - interval '1 month'
               AND ${pieces.createdAt} <  date_trunc('month', now())`
        ));

      // Stock critique (currentQuantity <= minimumThreshold) avec parsing sûr
      const qty = sqlSafeNumeric(stockItems.currentQuantity);
      const thr = sqlSafeNumeric(stockItems.minimumThreshold);

      const [{ c: lowStockCount }] = await db
        .select({ c: sql<number>`count(*)` })
        .from(stockItems)
        .where(and(eq(stockItems.userId, userId), sql`${qty} <= ${thr}`));

      // Commandes actives
      const [{ c: activeOrders }] = await db
        .select({ c: sql<number>`count(*)` })
        .from(orders)
        .where(and(eq(orders.userId, userId), inArray(orders.status, ACTIVE_ORDER_STATUSES)));

      // Commandes en transit
      const [{ c: inTransitOrders }] = await db
        .select({ c: sql<number>`count(*)` })
        .from(orders)
        .where(and(eq(orders.userId, userId), inArray(orders.status, IN_TRANSIT_STATUSES)));

      // Galeries
      const [{ c: totalGalleries }] = await db
        .select({ c: sql<number>`count(*)` })
        .from(galleries)
        .where(eq(galleries.userId, userId));

      const [{ c: activeGalleries }] = await db
        .select({ c: sql<number>`count(*)` })
        .from(galleries)
        .where(and(eq(galleries.userId, userId), eq(galleries.isActive, true)));

      return {
        totalPieces,
        piecesThisMonth,
        piecesPrevMonth,
        lowStockCount,
        activeOrders,
        inTransitOrders,
        totalGalleries,
        activeGalleries,
      };
    }

    //  BRANCHE MÉMOIRE 
    const P = (memory.pieces as MemoryPiece[]).filter(p => p.userId === userId);
    const S = (memory.stockItems as MemoryStockItem[]).filter(s => s.userId === userId);
    const O = (memory.orders as MemoryOrder[]).filter(o => o.userId === userId);
    const G = (memory.galleries as MemoryGallery[]).filter(g => g.userId === userId);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const totalPieces     = P.length;
    const piecesThisMonth = P.filter(p => p.createdAt && p.createdAt >= monthStart).length;
    const piecesPrevMonth = P.filter(p => {
      if (!p.createdAt) return false;
      const d = p.createdAt;
      return d >= prevStart && d < monthStart;
    }).length;

    const lowStockCount = S.filter(s => s.currentQuantity <= s.minimumThreshold).length;

    const activeOrders    = O.filter(o => (ACTIVE_ORDER_STATUSES as readonly string[]).includes(o.status)).length;
    const inTransitOrders = O.filter(o => (IN_TRANSIT_STATUSES   as readonly string[]).includes(o.status)).length;

    const totalGalleries  = G.length;
    const activeGalleries = G.filter(g => g.isActive).length;

    return {
      totalPieces,
      piecesThisMonth,
      piecesPrevMonth,
      lowStockCount,
      activeOrders,
      inTransitOrders,
      totalGalleries,
      activeGalleries,
    };
  }

  // Liste des articles en stock critique (triés par ratio qty/threshold asc) 
  async listLowStock(userId: number, limit: number): Promise<StockItemRow[]> {
    if (this.useDatabase) {
      const qty = sqlSafeNumeric(stockItems.currentQuantity);
      const thr = sqlSafeNumeric(stockItems.minimumThreshold);

      const rows = await db
        .select({
          id: stockItems.id,
          userId: stockItems.userId,
          name: stockItems.name,
          type: stockItems.type,
          category: stockItems.category,
          unit: stockItems.unit,
          currentQuantity: stockItems.currentQuantity,
          minimumThreshold: stockItems.minimumThreshold,
          supplier: stockItems.supplier,
          notes: stockItems.notes,
          createdAt: stockItems.createdAt,
          updatedAt: stockItems.updatedAt,
        })
        .from(stockItems)
        .where(and(eq(stockItems.userId, userId), sql`${qty} <= ${thr}`))
        .orderBy(asc(sql`${qty} / NULLIF(${thr}, 0)`)) // ratio asc
        .limit(limit);

      return rows;
    }

    // BRANCHE MÉMOIRE 
    const all = (memory.stockItems as MemoryStockItem[]).filter(s => s.userId === userId);

    const critical = all
      .filter(s => s.currentQuantity <= s.minimumThreshold)
      .sort((a, b) => {
        const ra = a.minimumThreshold === 0 ? Number.POSITIVE_INFINITY : a.currentQuantity / a.minimumThreshold;
        const rb = b.minimumThreshold === 0 ? Number.POSITIVE_INFINITY : b.currentQuantity / b.minimumThreshold;
        return ra - rb;
      })
      .slice(0, limit)
      .map(adaptStockItemMemoryToRow);

    return critical;
  }
}
