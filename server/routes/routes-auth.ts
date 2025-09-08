import type { Express, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { insertUserSchema } from "../../shared/schema.js";
import { UsersStorage } from '../storage/users.storage.js';
import crypto from 'crypto';
import { db } from '../db.js';
import * as schema from '../../shared/schema.js';
import { eq, and, sql, isNull, gt } from 'drizzle-orm';
import { sendPasswordResetEmail } from '../utils/mailer.js';


export const storages = {
  users: new UsersStorage(),
};
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

    const existingUser = await storages.users.getUserByUsername(userData.username);
    if (existingUser) {
      return res.status(400).json({ message: "Nom d'utilisateur déjà pris" });
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = await storages.users.createUser({ ...userData, password: hashedPassword });

    req.session.userId = user.id;

    const { password, ...safe } = user;
    res.json(safe);
  }));

app.post('/api/login', handleAsync(async (req, res) => {
  const { username: loginId, password } = req.body;
  if (!loginId || !password) {
    return res.status(400).json({ message: "Identifiant (email ou pseudo) et mot de passe requis" });
  }
  // 1) essayer par email (insensible à la casse)
  let user = await storages.users.getUserByEmail(loginId).catch(() => null);
  // 2) sinon par username exact
  if (!user) user = await storages.users.getUserByUsername(loginId);
  if (!user) return res.status(401).json({ message: 'Identifiants invalides' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ message: 'Identifiants invalides' });
  req.session.userId = user.id;
  const { password: _pw, ...safe } = user;
  res.json(safe);
}));


  app.get('/api/auth/user', requireAuth, handleAsync(async (req, res) => {
    const user = await storages.users.getUserById(req.session.userId!);
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

  app.post('/api/password/forgot', handleAsync(async (req, res) => {
  const emailRaw = String(req.body?.email ?? '').trim();
  if (!emailRaw) {
    // Toujours 200 pour ne pas divulguer l’existence d’un compte
    return res.status(200).json({ message: 'Si un compte existe, un lien a été envoyé.' });
  }
  const email = emailRaw.toLowerCase();
  const [row] = await db.select().from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${email}`).limit(1);
  // Toujours 200, même si pas d’utilisateur
  if (!row) return res.status(200).json({ message: 'Si un compte existe, un lien a été envoyé.' });
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
  await db.insert(schema.passwordResetTokens).values({
    userId: Number(row.id),
    tokenHash,
    expiresAt,
  });
  const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  try {
    await sendPasswordResetEmail(email, resetUrl);
  } catch (e) {
    // On ne révèle rien au client même si l’email échoue
    console.warn('✉️ Envoi email reset échoué:', (e as Error).message);
  }
  return res.status(200).json({ message: 'Si un compte existe, un lien a été envoyé.' });
}));


app.post('/api/password/reset', handleAsync(async (req, res) => {
  let { token, newPassword } = req.body ?? {};
  // 1) Normaliser le token
  const raw = String(token ?? "");
  const normalizedToken = raw.trim().toLowerCase().replace(/[^a-f0-9]/g, ""); // ne garde que l'hex
  if (!normalizedToken || !newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ message: 'Token invalide ou mot de passe trop court' });
  }
  const tokenHash = crypto.createHash('sha256').update(normalizedToken, 'utf8').digest('hex');
  const now = new Date();
  // 2) Requête DRIZZLE typée
  const [prt] = await db.select().from(schema.passwordResetTokens).where(
    and(
      eq(schema.passwordResetTokens.tokenHash, tokenHash),
      isNull(schema.passwordResetTokens.usedAt),
      gt(schema.passwordResetTokens.expiresAt, now),
    )
  ).limit(1);
  if (!prt) return res.status(400).json({ message: 'Token invalide ou expiré' });
  const [userRow] = await db.select().from(schema.users)
    .where(eq(schema.users.id, prt.userId)).limit(1);
  if (!userRow) return res.status(400).json({ message: 'Utilisateur introuvable' });
  const hashed = await bcrypt.hash(String(newPassword), 10);
  await db.transaction(async (tx) => {
    await tx.update(schema.users)
      .set({ password: hashed })
      .where(eq(schema.users.id, prt.userId));
    await tx.update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(schema.passwordResetTokens.id, prt.id));
    await tx.execute(sql`DELETE FROM sessions WHERE (sess->>'userId')::int = ${prt.userId}`);
  });
  try { req.session.destroy(() => {}); } catch {}
  return res.json({ message: 'Mot de passe mis à jour.' });
}));

}


