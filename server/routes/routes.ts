import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { createServer, type Server } from 'http';
import session from 'express-session';
import MemoryStore from 'memorystore';
import path from 'path';

import { registerAuthRoutes } from './routes-auth.js';
import { registerGalleryRoutes } from './routes-galleries.js';
import { registerPieceRoutes } from './routes-pieces.js';
import { registerPieceTypeRoutes } from './routes-piece-types.js';
import { registerStockRoutes } from "./routes-stock.js";
import {registerOrderRoutes} from "./routes-orders.js";
import {registerOrderItemRoutes} from "./routes-order-items.js"
import { registerR2ProxyRoutes } from './routes-r2-proxy.js';
import { registerEventPieceRoutes } from './routes-events-pieces.js';
import { registerEventRoutes } from './routes-events.js';
import { registerDashboardRoutes } from './routes-dashboard.js';
import { registerPieceSubtypeRoutes } from './routes-piece-subtypes.js';

const MemStore = MemoryStore(session);

// Étendre la session pour stocker l'id utilisateur
declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

const isProd = process.env.NODE_ENV === "production";

// Middleware d’auth
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Non autorisé - Connexion requise' });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.set('trust proxy', 1);

  // Parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
 
 const uploadRoot = path.resolve(process.cwd(), "uploads");
  app.use(
    "/uploads",
    express.static(uploadRoot, {
      maxAge: isProd ? "1y" : 0,
      etag: true,
      immutable: isProd,
    })
  );


  // Sessions
  app.use(
    session({
      store: new MemStore({ checkPeriod: 86_400_000 }), // 24h
      secret: process.env.SESSION_SECRET || 'secret-local-development',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,     // en dev; en prod derrière HTTPS => true
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  // Monter les sous-routers
  registerAuthRoutes(app, requireAuth);
  registerGalleryRoutes(app, requireAuth);
  registerPieceRoutes(app, requireAuth);
  registerPieceTypeRoutes(app, requireAuth);
  registerStockRoutes(app, requireAuth);
  registerOrderRoutes(app, requireAuth);
  registerOrderItemRoutes(app, requireAuth);
  registerR2ProxyRoutes(app, requireAuth);
  registerEventPieceRoutes(app, requireAuth);
  registerEventRoutes(app, requireAuth);
  registerDashboardRoutes(app, requireAuth);
  registerPieceSubtypeRoutes(app, requireAuth);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  
  //  Garde anti-fallback SPA pour /api/*
    app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found' }));
  
  // Handler d'erreurs JSON (dernier middleware)
 app.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      // eslint-disable-next-line no-console
      console.error("Unhandled error:", err);
      if (!res.headersSent) {
        const message =
          err instanceof Error ? err.message : "Erreur serveur";
        res.status(500).json({ message });
      }
    }
  );

  const httpServer = createServer(app);
  return httpServer;
}
