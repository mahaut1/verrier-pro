import dotenv from "dotenv";

// Charger les variables d'environnement depuis .env
dotenv.config();

console.log("✅ Variables d'environnement chargées:");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "CHARGÉE" : "MANQUANTE");
console.log("SESSION_SECRET:", process.env.SESSION_SECRET ? "CHARGÉE" : "MANQUANTE");
console.log("NODE_ENV:", process.env.NODE_ENV);

// Importer le reste du serveur depuis index.ts
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
        log(logLine);
      }
    });

    next();
  });

  const server = await registerRoutes(app);

  // Configuration Vite pour développement
  const { PORT = 5000 } = process.env;
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  server.listen(Number(PORT), "0.0.0.0", () => {
    log(`serving on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);