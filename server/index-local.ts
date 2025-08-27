import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

console.log("✅ DEV: variables chargées depuis .env");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "CHARGÉE" : "❌ MANQUANTE");
console.log("SESSION_SECRET:", process.env.SESSION_SECRET ? "CHARGÉE" : "❌ MANQUANTE");
console.log("NODE_ENV:", process.env.NODE_ENV);

(async () => {
  const express = (await import("express")).default;
  const { registerRoutes } = await import("./routes/routes.js");
  const { setupVite, log } = await import("./vite.js");

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const server = await registerRoutes(app);

  // En dev → branche Vite
  await setupVite(app, server);

  const port = Number(process.env.PORT) || 4000;
  server.listen(port, "0.0.0.0", () => {
    log(`[express] DEV serving on http://localhost:${port}`);
  });
})();
