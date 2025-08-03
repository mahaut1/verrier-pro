import express from "express";
import { registerRoutes } from "./routes";
import dotenv from "dotenv";
import { createServer as createViteServer } from 'vite';
import viteConfig from '../vite.config.js';

// Charger les variables d'environnement depuis .env
dotenv.config();

console.log("🚀 VerrierPro - Mode Local (Stockage Mémoire)");
console.log("SESSION_SECRET:", process.env.SESSION_SECRET ? "CHARGÉE" : "UTILISE SECRET PAR DÉFAUT");
console.log("NODE_ENV:", process.env.NODE_ENV || "development");

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// Configuration CORS et parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Démarrer le serveur avec Vite
async function startServer() {
  try {
    // Enregistrer les routes backend
    const server = await registerRoutes(app);

    // Configuration Vite pour le frontend
    const vite = await createViteServer({
      ...viteConfig,
      configFile: false,
      server: { middlewareMode: true }
    });

    // Utiliser les middlewares Vite
    app.use(vite.middlewares);

    // Route catch-all pour servir le frontend
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      
      try {
        // Lire le template HTML
        let template = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VerrierPro - Gestion d'Artisan Verrier</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

        // Transformer avec Vite
        const html = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        next(e);
      }
    });

    server.listen(PORT, "0.0.0.0", () => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`${timestamp} [express] serving on http://localhost:${PORT}`);
      console.log("🔐 Utilisateur test: cesium / admin123");
      console.log("🌐 Frontend et Backend intégrés");
    });

  } catch (error) {
    console.error("Erreur lors du démarrage du serveur:", error);
    process.exit(1);
  }
}

startServer();