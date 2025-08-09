import 'dotenv/config';
import express from 'express';
import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite-windows';


(async () => {
  const app = express();

  // Parsers (une seule fois)
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const server = await registerRoutes(app);

  const PORT = Number(process.env.PORT ?? 5000);

  if (process.env.NODE_ENV === 'development') {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  server.listen(PORT, '0.0.0.0', () => {
    log(`[express] serving on http://localhost:${PORT}`);
  });
})();
