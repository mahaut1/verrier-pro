import dotenv from "dotenv";

// Charger les variables d'environnement depuis .env
dotenv.config();

// Test de débogage pour vérifier le chargement des variables
console.log('✅ Variables d\'environnement chargées:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'CHARGÉE' : 'MANQUANTE');
console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? 'CHARGÉE' : 'MANQUANTE');
console.log('NODE_ENV:', process.env.NODE_ENV);

import express, { type Request, Response, NextFunction } from "express";
import { setupVite, serveStatic, log } from "./vite-windows";
// Import dynamique des routes pour éviter le problème de hoisting
async function startServer() {
    console.log("🔍 *** IMPORT STORAGE AVANT ROUTES ***");
  const { storage } = await import("./storage");
  console.log("🔍 *** STORAGE IMPORTÉ ET INSTANCIÉ ***");
  const { registerRoutes } = await import("./routes");
  
  const app = express();

  // Configuration trust proxy pour rate limiting et sécurité
  app.set('trust proxy', 1);

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });

  const server = await registerRoutes(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  const host = process.env.NODE_ENV === 'production' ? "0.0.0.0" : "localhost";
  
  server.listen(port, host, () => {
    log(`serving on http://${host}:${port}`);
  });
}

// Démarrer le serveur
startServer().catch(console.error);