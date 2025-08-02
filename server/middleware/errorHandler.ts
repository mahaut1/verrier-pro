import type { NextFunction, Request, Response } from 'express';

//Gestion centralisée des erreurs
export const errorHandler = (
    err: Error & { status?: number; statusCode?: number },
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error('Error:', err);
const status= err.status || err.statusCode || 500;
const message = status === 500
    ? 'Erreur serveur interne': err.message;
    res.status(status).json({message})
};

// Gestionnaire des routes non trouvées
export const notFoundHandler = (req: Request, res: Response) => {
    res.status(404).json({
         message: 'Ressource non trouvée',
         details: 'La route ${req.method} ${req.path} n\'existe pas.'
        });
};

// Wrapper async pour éviter les try/catch dans les routes
type AsyncFunction= (req: Request, res: Response, next: NextFunction) => Promise<void>;

export const asyncHandler = (fn: AsyncFunction) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}