import rateLimit from 'express-rate-limit';


//Limitation pour l'authentification des utilisateurs (anti brute force)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, 
    message: {
        status: 'error',
        message: 'Trop de tentatives de connexion. Veuillez dans 15 minutes.',
    },
    standardHeaders: true, // Retourne les informations de limite dans les en-têtes `RateLimit-*`
    legacyHeaders: false, // Désactive les en-têtes `X-RateLimit-*`
    });

    // Limitation pour l'inscription (anti spam)
    export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 heure
    max: 3, // Limite à 10 inscriptions par heure
    message: {
        status: 'error',
        message: 'Trop de tentatives d\'inscription. Veuillez réessayer dans une heure.',
    },
    standardHeaders: true, // Retourne les informations de limite dans les en-têtes `RateLimit-*`
    legacyHeaders: false, // Désactive les en-têtes `X-RateLimit-*`
    });

// Limitation pour les requêtes API générales
export const apiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 heure
    max: 100, // Limite à 100 requêtes par heure
    message: {
        status: 'error',
        message: 'Trop de requêtes. Veuillez réessayer dans une heure.',
    },
    standardHeaders: true, // Retourne les informations de limite dans les en-têtes `RateLimit-*`
    legacyHeaders: false, // Désactive les en-têtes `X-RateLimit-*`
});