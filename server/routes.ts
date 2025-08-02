import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";

// Extension du type Session pour inclure userId
declare module "express-session" {
    interface SessionData {
        userId?: number;
    }
}

// Middleware d'authentification 
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: "Non autorisé - Connexion requise" });
    }
    next();
};

// Wrapper simple pour gérer les erreurs async sans problème de typage
const handleAsync = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch((error: any) => {
            console.error('Erreur dans la route:', error);
            if (!res.headersSent) {
                res.status(500).json({ message: "Erreur serveur" });
            }
        });
    };
};

export async function registerRoutes(app: Express): Promise<Server> {
    // Trust proxy pour rate limiting
    app.set("trust proxy", 1);

    // Configuration des sessions
    const pgStore = connectPg(session);
    app.use(session({
        store: new pgStore({
            conString: process.env.DATABASE_URL,
            createTableIfMissing: true,
        }),
        secret: process.env.SESSION_SECRET!,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
        },              
    }));

    // Routes d'authentification sans asyncHandler
    app.post("/api/register", handleAsync(async (req: Request, res: Response) => {
        const validation = insertUserSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ 
                message: "Données invalides", 
                errors: validation.error.issues 
            });
        }

        const userData = validation.data;

        // Vérifier si l'utilisateur existe déjà
        const existingUser = await storage.getUserByUsername(userData.username);
        if (existingUser) {
            return res.status(400).json({ message: "Nom d'utilisateur déjà pris" });
        }

        // Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        // Créer l'utilisateur
        const user = await storage.createUser({
            ...userData,
            password: hashedPassword,
        });

        // Connecter automatiquement l'utilisateur
        req.session.userId = user.id;

        // Retourner les données de l'utilisateur sans le mot de passe
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    }));

    app.post("/api/login", handleAsync(async (req: Request, res: Response) => {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Nom d'utilisateur et mot de passe requis" });
        }

        const user = await storage.getUserByUsername(username);
        if (!user) {
            return res.status(401).json({ message: "Identifiants invalides" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: "Identifiants invalides" });
        }

        req.session.userId = user.id;

        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    }));

    app.get('/api/auth/user', requireAuth, handleAsync(async (req: Request, res: Response) => {
        const user = await storage.getUser(req.session.userId!);
        if (!user) {
            return res.status(404).json({ message: "Utilisateur non trouvé" });
        }
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    }));

    app.post("/api/logout", (req: Request, res: Response) => {
        req.session.destroy((err) => {
            if (err) {
                console.error("Erreur lors de la déconnexion:", err);
                return res.status(500).json({ message: "Erreur lors de la déconnexion" });
            }
            res.json({ message: "Déconnexion réussie" });
        });
    });

    const httpServer = createServer(app);
    return httpServer;
}