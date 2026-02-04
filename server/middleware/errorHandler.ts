import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodIssue } from "zod";

// Fonction utilitaire pour transformer un ZodIssue en message lisible
function mapZodIssueToMessage(issue: ZodIssue): string {
  const field = String(issue.path[0] ?? "");

  // Messages personnalisés par champ
  if (field === "price") {
    // cas Expected string, received null
    if (
      issue.code === "invalid_type" &&
      issue.received === "null"
    ) {
      return "Le prix est obligatoire. Si la pièce n'est pas à vendre, laissez ce champ vide ou mettez 0.";
    }

    if (issue.code === "invalid_type") {
      return "Le prix doit être un nombre valide (ex : 150 ou 150.00).";
    }

    // message par défaut si on n'a rien matché
    return issue.message || "Le prix n'est pas valide.";
  }

  // Messages génériques pour les champs requis
  if (issue.code === "too_small" && issue.minimum === 1 && issue.type === "string") {
    return "Ce champ est obligatoire.";
  }

  if (issue.code === "invalid_type" && issue.message === "Required") {
    return "Ce champ est obligatoire.";
  }

  // Fallback : message Zod brut
  return issue.message;
}

//Gestion centralisée des erreurs
export const errorHandler = (
  err: Error & { status?: number; statusCode?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error("Error:", err);

  // Erreurs de validation Zod → 400 + détails par champ
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Certaines données sont invalides.",
      errors: err.issues.map((issue) => ({
        path: issue.path, // ex: ["price"]
        message: mapZodIssueToMessage(issue),
      })),
    });
  }

  const status = err.status ?? err.statusCode ?? 500;
  const message =
    status === 500 ? "Erreur serveur interne" : err.message || "Erreur inconnue";

  res.status(status).json({ message });
};

// Gestionnaire des routes non trouvées
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    message: "Ressource non trouvée",
    details: `La route ${req.method} ${req.path} n'existe pas.`,
  });
};

// Wrapper async pour éviter les try/catch dans les routes
type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export const asyncHandler = (fn: AsyncFunction) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
