import type { Express, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { storage } from './storage';
import { insertUserSchema } from '@shared/schema';

function handleAsync(fn: (req: Request, res: Response, next?: any) => Promise<any>) {
  return (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function registerAuthRoutes(app: Express, requireAuth: any) {
  app.post('/api/register', handleAsync(async (req, res) => {
    const validation = insertUserSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Données invalides', errors: validation.error.issues });
    }

    const userData = validation.data;

    const existingUser = await storage.getUserByUsername(userData.username);
    if (existingUser) {
      return res.status(400).json({ message: "Nom d'utilisateur déjà pris" });
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = await storage.createUser({ ...userData, password: hashedPassword });

    req.session.userId = user.id;

    const { password, ...safe } = user;
    res.json(safe);
  }));

  app.post('/api/login', handleAsync(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Nom d'utilisateur et mot de passe requis" });
    }

    const user = await storage.getUserByUsername(username);
    if (!user) return res.status(401).json({ message: 'Identifiants invalides' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Identifiants invalides' });

    req.session.userId = user.id;

    const { password: _pw, ...safe } = user;
    res.json(safe);
  }));

  app.get('/api/auth/user', requireAuth, handleAsync(async (req, res) => {
    const user = await storage.getUserById(req.session.userId!);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    const { password, ...safe } = user;
    res.json(safe);
  }));

  app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) return res.status(500).json({ message: 'Erreur lors de la déconnexion' });
      res.json({ message: 'Déconnexion réussie' });
    });
  });
}
