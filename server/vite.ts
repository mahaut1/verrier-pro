import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config.js";


const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}


export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      // Ne kill pas le process en dev
      error: (msg, options) => viteLogger.error(msg, options),
    },
    server: {
      middlewareMode: true,
      hmr: { server },
      allowedHosts: true,
    },
    appType: "custom",
  });

  app.use(vite.middlewares);

  // Mise en cache mémoire d'index.html pour éviter les I/O et le retraitement
  const clientTemplatePath = path.resolve(process.cwd(), "client", "index.html");
  let templateCache: string | null = null;
  async function getTemplate() {
    if (!templateCache) {
      templateCache = await fs.promises.readFile(clientTemplatePath, "utf-8");
    }
    return templateCache;
  }

  // SPA fallback — exclut /api
  app.get(/^\/(?!api)(.*)/, async (req, res, next) => {
    try {
      const url = req.originalUrl;
      const raw = await getTemplate();              // pas de nanoid ici
      const html = await vite.transformIndexHtml(url, raw);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(
    express.static(distPath, {
      etag: true,
      lastModified: true,
      // défaut court
      maxAge: "5m",
      setHeaders(res, filePath) {
        // cache long et immutable pour les assets fingerprintés
        if (/\.[a-f0-9]{8,}\.(css|js|png|jpe?g|gif|webp|svg|ico|woff2?)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (filePath.endsWith("index.html")) {
          // toujours aller le revalider
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    })
  );

  // SPA fallback — exclut /api
  app.get(/^\/(?!api)(.*)/, (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}