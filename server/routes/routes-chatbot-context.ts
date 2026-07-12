import type { Express, Request, Response } from "express";
import { eq, desc, asc } from "drizzle-orm";
import { db } from "../db.js";
import {
  pieces,
  stockItems,
  orders,
  galleries,
  events,
} from "../../shared/schema.js";
import { DashboardStorage } from "../storage/dashboard.storage.js";

const dashboardStorage = new DashboardStorage();

/* -------------------------------------------------------------------------- */
/* Utils                                                                      */
/* -------------------------------------------------------------------------- */

function getChatbotUserId(): number {
  const userId = Number(process.env.CHATBOT_USER_ID ?? 2);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("CHATBOT_USER_ID invalide");
  }

  return userId;
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

/* -------------------------------------------------------------------------- */
/* Static context                                                             */
/* -------------------------------------------------------------------------- */

function buildApplicationContext() {
  return {
    name: "Verrier Pro",
    description: "Application de gestion d'atelier pour artisans verriers.",
    version: "Prototype pédagogique",
    mode: "consultation uniquement",
  };
}

function buildChatbotPolicy() {
  return {
    readOnly: true,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    useOnlyProvidedContext: true,
    allowedCapabilities: [
      "consulter le tableau de bord",
      "consulter les pièces",
      "consulter les stocks",
      "consulter les galeries",
      "consulter les commandes",
      "consulter les événements",
    ],
    forbiddenActions: [
      "créer une donnée",
      "modifier une donnée",
      "supprimer une donnée",
      "inventer une information absente du contexte",
      "répondre en dehors du périmètre Verrier Pro",
    ],
  };
}

function buildBusinessMetadata() {
  return {
    pieceStatus: {
      workshop: "Pièce présente dans l'atelier",
      gallery: "Pièce exposée en galerie",
      sold: "Pièce vendue",
      transit: "Pièce en cours de transport",
    },
    orderStatus: {
      pending: "Commande créée",
      processing: "Commande en préparation",
      shipped: "Commande expédiée",
      delivered: "Commande livrée",
      cancelled: "Commande annulée",
    },
    eventStatus: {
      planned: "Événement planifié",
      confirmed: "Événement confirmé",
      completed: "Événement terminé",
      cancelled: "Événement annulé",
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Database queries                                                           */
/* -------------------------------------------------------------------------- */

async function getDashboardContext(userId: number) {
  const stats = await dashboardStorage.getStats(userId);

  return {
    totalPieces: toNumber(stats.totalPieces),
    piecesThisMonth: toNumber(stats.piecesThisMonth),
    piecesPrevMonth: toNumber(stats.piecesPrevMonth),
    lowStockCount: toNumber(stats.lowStockCount),
    activeOrders: toNumber(stats.activeOrders),
    inTransitOrders: toNumber(stats.inTransitOrders),
    totalGalleries: toNumber(stats.totalGalleries),
    activeGalleries: toNumber(stats.activeGalleries),
  };
}

async function getLowStockItems(userId: number) {
  const lowStock = await dashboardStorage.listLowStock(userId, 10);

  return lowStock.map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    category: item.category,
    currentQuantity: toNumber(item.currentQuantity),
    minimumThreshold: toNumber(item.minimumThreshold),
    unit: item.unit,
    supplier: item.supplier,
  }));
}

async function getPiecesContext(userId: number) {
  const rows = await db
    .select({
      id: pieces.id,
      uniqueId: pieces.uniqueId,
      name: pieces.name,
      status: pieces.status,
      currentLocation: pieces.currentLocation,
      dominantColor: pieces.dominantColor,
      dimensions: pieces.dimensions,
      price: pieces.price,
      description: pieces.description,
      createdAt: pieces.createdAt,
    })
    .from(pieces)
    .where(eq(pieces.userId, userId))
    .orderBy(desc(pieces.createdAt))
    .limit(30);

  return rows.map((piece) => ({
    id: piece.id,
    uniqueId: piece.uniqueId,
    name: piece.name,
    status: piece.status,
    currentLocation: piece.currentLocation,
    dominantColor: piece.dominantColor,
    dimensions: piece.dimensions,
    price: toNumber(piece.price),
    description: piece.description,
    createdAt: piece.createdAt,
  }));
}

async function getGalleriesContext(userId: number) {
  const rows = await db
    .select({
      id: galleries.id,
      name: galleries.name,
      contactPerson: galleries.contactPerson,
      email: galleries.email,
      phone: galleries.phone,
      address: galleries.address,
      commissionRate: galleries.commissionRate,
      isActive: galleries.isActive,
    })
    .from(galleries)
    .where(eq(galleries.userId, userId))
    .orderBy(asc(galleries.name))
    .limit(20);

  return rows.map((gallery) => ({
    id: gallery.id,
    name: gallery.name,
    contactPerson: gallery.contactPerson,
    email: gallery.email,
    phone: gallery.phone,
    address: gallery.address,
    commissionRate: toNumber(gallery.commissionRate),
    isActive: gallery.isActive,
  }));
}

async function getOrdersContext(userId: number) {
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      totalAmount: orders.totalAmount,
      shippingAddress: orders.shippingAddress,
      notes: orders.notes,
      createdAt: orders.createdAt,
      shippedAt: orders.shippedAt,
      deliveredAt: orders.deliveredAt,
    })
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(20);

  return rows.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    totalAmount: toNumber(order.totalAmount),
    shippingAddress: order.shippingAddress,
    notes: order.notes,
    createdAt: order.createdAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
  }));
}

async function getEventsContext(userId: number) {
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      type: events.type,
      venue: events.venue,
      startDate: events.startDate,
      endDate: events.endDate,
      description: events.description,
      status: events.status,
      participationFee: events.participationFee,
      notes: events.notes,
    })
    .from(events)
    .where(eq(events.userId, userId))
    .orderBy(asc(events.startDate))
    .limit(20);

  return rows.map((event) => ({
    id: event.id,
    name: event.name,
    type: event.type,
    venue: event.venue,
    startDate: event.startDate,
    endDate: event.endDate,
    description: event.description,
    status: event.status,
    participationFee: toNumber(event.participationFee),
    notes: event.notes,
  }));
}

/* -------------------------------------------------------------------------- */
/* Context builder                                                            */
/* -------------------------------------------------------------------------- */

async function buildChatbotContext(userId: number) {
  const [
    dashboard,
    lowStockItems,
    piecesContext,
    galleriesContext,
    ordersContext,
    eventsContext,
  ] = await Promise.all([
    getDashboardContext(userId),
    getLowStockItems(userId),
    getPiecesContext(userId),
    getGalleriesContext(userId),
    getOrdersContext(userId),
    getEventsContext(userId),
  ]);

  return {
    application: buildApplicationContext(),

    chatbotPolicy: buildChatbotPolicy(),

    metadata: buildBusinessMetadata(),

    summary: {
      totalPieces: dashboard.totalPieces,
      totalLowStockItems: dashboard.lowStockCount,
      totalActiveOrders: dashboard.activeOrders,
      totalInTransitOrders: dashboard.inTransitOrders,
      totalGalleries: dashboard.totalGalleries,
      totalActiveGalleries: dashboard.activeGalleries,
      totalEvents: eventsContext.length,
    },

    context: {
      dashboard,
      lowStockItems,
      pieces: piecesContext,
      galleries: galleriesContext,
      customerOrders: ordersContext,
      scheduledEvents: eventsContext,
    },

    contextMetadata: {
      generatedAt: new Date().toISOString(),
      source: "Verrier Pro local database",
      userScope: "Données filtrées pour l'utilisateur de démonstration",
      readOnly: true,
      maxItems: {
        pieces: 30,
        galleries: 20,
        customerOrders: 20,
        scheduledEvents: 20,
        lowStockItems: 10,
      },
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Route                                                                      */
/* -------------------------------------------------------------------------- */

export function registerChatbotContextRoutes(app: Express) {
  app.get("/api/chatbot/context", async (_req: Request, res: Response) => {
    try {
      const userId = getChatbotUserId();
      const chatbotContext = await buildChatbotContext(userId);

      return res.json(chatbotContext);
    } catch (error) {
      console.error("Erreur route /api/chatbot/context:", error);

      return res.status(500).json({
        message: "Impossible de générer le contexte du chatbot.",
      });
    }
  });
}