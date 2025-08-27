import type {
  Express,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import { z } from "zod";
import {
  insertOrderItemSchema,
  updateOrderItemSchema,
} from "../../shared/schema.js";
import { storage } from "../storage/index.js";

/** Helper */
function handleAsync(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

/** /api/order-items?orderId=123 */
const listQuerySchema = z.object({
  orderId: z.coerce.number().int().positive().optional(),
});

const createItemBody = insertOrderItemSchema
  .pick({ orderId: true, pieceId: true })
  .extend({
    // Autorise le prix optionnel côté API, on prendra celui de la pièce si absent
    price: z.union([z.string(), z.number()]).optional(),
  });

export function registerOrderItemRoutes(app: Express, requireAuth: RequestHandler) {
  // CREATE
// CREATE
  app.post(
    "/api/order-items",
    requireAuth,
    handleAsync(async (req, res) => {
      const userId = Number(req.session!.userId);
      const input = createItemBody.parse(req.body);
      // Vérifier commande
      const order = await storage.getOrderById(userId, input.orderId);
      if (!order) return res.status(404).json({ message: "Commande introuvable" });
      // Vérifier pièce
      if (!input.pieceId) {
        return res.status(400).json({ message: "pieceId requis" });
      }
      const piece = await storage.getPieceById(userId, input.pieceId);
      if (!piece) return res.status(404).json({ message: "Pièce introuvable" });
      // Cohérence galerie
      if (order.galleryId) {
        if (piece.galleryId && piece.galleryId !== order.galleryId) {
          return res.status(400).json({ message: "La pièce est liée à une autre galerie" });
        }
        // si la pièce n'a pas de galerie -> lier automatiquement à la galerie de la commande
        if (!piece.galleryId) {
          await storage.updatePiece(userId, piece.id, {
            galleryId: order.galleryId,
            status: "gallery",
          });
        }
      }
      // Prix
      const effectivePrice =
        input.price ?? (piece.price != null ? String(piece.price) : undefined);
      if (effectivePrice == null) {
        return res.status(400).json({ message: "Prix manquant (ni dans la requête ni sur la pièce)" });
      }

      const created = await storage.createOrderItem(userId, {
        orderId: input.orderId,
        pieceId: input.pieceId,
        price: String(effectivePrice),
      });
      return res.status(201).json(created);
    })
  );
  // LIST (+ filtre facultatif par orderId)
  app.get(
    "/api/order-items",
    requireAuth,
    handleAsync(async (req, res) => {
      const { orderId } = listQuerySchema.parse(req.query);
      const userId = Number(req.session!.userId);
      const rows = await storage.listOrderItems(userId, orderId);
      res.json(rows);
    })
  );

  // GET by id
  app.get(
    "/api/order-items/:id",
    requireAuth,
    handleAsync(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const userId = Number(req.session!.userId);
      const row = await storage.getOrderItemById(userId, id);
      if (!row) return res.status(404).json({ message: "Item introuvable" });
      res.json(row);
    })
  );

  // UPDATE
  app.patch(
    "/api/order-items/:id",
    requireAuth,
    handleAsync(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const patch = updateOrderItemSchema.parse(req.body);
      const userId = Number(req.session!.userId);
      const row = await storage.updateOrderItem(userId, id, patch);
      if (!row) return res.status(404).json({ message: "Item introuvable" });
      res.json(row);
    })
  );

  // DELETE
  app.delete(
    "/api/order-items/:id",
    requireAuth,
    handleAsync(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const userId = Number(req.session!.userId);
      const ok = await storage.deleteOrderItem(userId, id);
      if (!ok) return res.status(404).json({ message: "Item introuvable" });
      res.status(204).end();
    })
  );
}
