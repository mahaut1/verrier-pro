import type {
  Express,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import { z } from "zod";
import {
  insertOrderSchema,
  updateOrderSchema,
  orderStatusEnum,
} from "../../shared/schema.js";
import { storage } from "../storage/index.js";

/** Helper pour catcher les erreurs async proprement */
function handleAsync(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}

/** Querystring pour /api/orders */
const listQuerySchema = z.object({
  status: orderStatusEnum.optional(),
  // pagination de base
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

export function registerOrderRoutes(app: Express, requireAuth: RequestHandler) {
    // CREATE
  app.post(
    "/api/orders",
    requireAuth,
    handleAsync(async (req, res) => {
      const body = insertOrderSchema.parse(req.body);
      const userId = Number(req.session!.userId);

      const created = await storage.createOrder(userId, body);
      res.status(201).json(created);
    })
  );
  
    // LIST
  app.get(
    "/api/orders",
    requireAuth,
    handleAsync(async (req, res) => {
      const { page, limit, status } = listQuerySchema.parse(req.query);
      const userId = Number(req.session!.userId);
      const offset = (page - 1) * limit;

      const data = await storage.listOrders(userId, {
        status,
        limit,
        offset,
      });
      res.json(data);
    })
  );

  // GET by id
  app.get(
    "/api/orders/:id",
    requireAuth,
    handleAsync(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const userId = Number(req.session!.userId);

      const order = await storage.getOrderById(userId, id);
      if (!order) return res.status(404).json({ message: "Commande introuvable" });

      res.json(order);
    })
  );



  // UPDATE
  app.patch(
    "/api/orders/:id",
    requireAuth,
    handleAsync(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const patch = updateOrderSchema.parse(req.body);
      const userId = Number(req.session!.userId);

      const updated = await storage.updateOrder(userId, id, patch);
      if (!updated) return res.status(404).json({ message: "Commande introuvable" });

      res.json(updated);
    })
  );

  // DELETE
  app.delete(
    "/api/orders/:id",
    requireAuth,
    handleAsync(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const userId = Number(req.session!.userId);

      const ok = await storage.deleteOrder(userId, id);
      if (!ok) return res.status(404).json({ message: "Commande introuvable" });

      res.status(204).end();
    })
  );

  // LIST items d’une commande
  app.get(
    "/api/orders/:id/items",
    requireAuth,
    handleAsync(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const userId = Number(req.session!.userId);

      const items = await storage.listOrderItems(userId, id);
      res.json(items);
    })
  );
}
