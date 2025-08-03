import type {Request, Response, NextFunction} from 'express';

//Middleware d'audit por tracer les actions
export const auditMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const userId= req.session?.userId || null;

//Log simple pour les actions normales
        if (req.path.includes('/auth/')){
             console.log(`[AUDIT AUTH] ${new Date().toISOString()} User ${userId}: ${req.method}-${req.path}-${res.statusCode}(${duration}ms)`);
        }
    });
    next();
}

//Audit pour les actions critiques
export const criticalActionAudit=(action:string) => {
    return (req: Request, next: NextFunction) => {
        const userId = req.session?.userId;
        console.log(`[AUDIT CRITICAL] ${new Date().toISOString()} User ${userId}: ${action} - ${req.method}-${req.path}}`);
        next();
    };
}