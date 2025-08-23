import dotenv from "dotenv";
import path from "path";

// Charger le bon fichier .env selon NODE_ENV
const envFile = process.env.NODE_ENV === "production" ? ".env.prod" : ".env";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

console.log(`✅ Variables chargées depuis ${envFile}`);
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "CHARGÉE" : "❌ MANQUANTE");
console.log("SESSION_SECRET:", process.env.SESSION_SECRET ? "CHARGÉE" : "❌ MANQUANTE");
console.log("NODE_ENV:", process.env.NODE_ENV);

import express, { type Request, Response, NextFunction } from "express";
import { serveStatic, log } from "./vite.js";

async function startServer() {
  console.log("🔍 *** IMPORT STORAGE AVANT ROUTES ***");

  // ⚠️ IMPORT DYNAMIQUE : il faut que dotenv soit déjà exécuté
  await import("./storage/index.js");

  console.log("🔍 *** STORAGE IMPORTÉ ET INSTANCIÉ ***");

  const { registerRoutes } = await import("./routes.js");

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const server = await registerRoutes(app);

  // En prod → uniquement les fichiers statiques
  serveStatic(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || "Internal Server Error" });
    throw err;
  });

  const port = Number(process.env.PORT) || 5000;
  const host = "0.0.0.0";

  server.listen(port, host, () => {
    log(`[express] PROD serving on http://${host}:${port}`);
  });
}

startServer().catch(console.error);
