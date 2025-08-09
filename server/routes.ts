// server/routes.ts
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { createServer, type Server } from 'http';
import session from 'express-session';
import MemoryStore from 'memorystore';
import { registerAuthRoutes } from './routes-auth';
import { registerGalleryRoutes } from './routes-galleries';
import { registerPieceRoutes } from './routes-pieces';
import path from 'path';

const MemStore = MemoryStore(session);

// Étendre la session pour stocker l'id utilisateur
declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

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
 
  const uploadRoot = path.resolve(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadRoot));

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

  // Healthcheck simple
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  
  //  Garde anti-fallback SPA pour /api/*
    app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found' }));
  
  // Handler d'erreurs JSON (dernier middleware)
  // (utile si une route async lève sans catch)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    if (res.headersSent) return;
    res.status(500).json({ message: 'Erreur serveur' });
  });

  const httpServer = createServer(app);
  return httpServer;
}
