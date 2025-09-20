// server/__tests__/pieces.routes.test.ts
import express, { type RequestHandler } from 'express';
import request from 'supertest';

// ---- Mocks AVANT d'importer les routes ----
jest.mock('../lib/r2.js', () => ({
  R2_AVAILABLE: false,
  r2PutObject: jest.fn(),
  r2DeleteObject: jest.fn(),
  keyFromPublicUrl: jest.fn(),
}));

jest.mock('../storage/index.js', () => {
  const createType = async (d: any) => ({ id: 1, ...d });
  const createPiece = async (d: any) => ({ id: 1, ...d });

  return {
    storage: {
      // forme "fonction" parfois utilisée
      createPieceType: createType,
      createPiece: createPiece,
      // forme namespacée
      pieceTypes: { create: createType },
      pieces: { create: createPiece },
    },
  };
});

// ---- importer les routes APRÈS les mocks ----
import { registerPieceRoutes } from '../routes/routes-pieces';
import { registerPieceTypeRoutes } from '../routes/routes-piece-types';

const sessionStub: RequestHandler = (req: any, _res, next) => {
  req.session = { userId: 1 };
  next();
};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(sessionStub);

  registerPieceTypeRoutes(app as any, sessionStub);
  registerPieceRoutes(app as any, sessionStub);

  app.use((err: any, _req: any, res: any, _next: any) => {
    // console.error('Test error middleware:', err);
    res.status(500).json({ message: err?.message ?? 'Error' });
  });
  return app;
}

describe('Routes pièces', () => {
  it('crée un type puis une pièce', async () => {
    const app = makeApp();

    // 1) Crée un type
    const typeRes = await request(app).post('/api/piece-types').send({ name: 'Vase' });
    if (![200, 201].includes(typeRes.status)) {
      // eslint-disable-next-line no-console
      console.log('typeRes.body', typeRes.body);
    }
    expect([200, 201]).toContain(typeRes.status);

    const typeBody = typeRes.body?.data ?? typeRes.body;
    const typeId = typeBody?.id;
    expect(typeId).toBeTruthy();

    // 2) Crée une pièce
    const payload = {
      name: 'Vase bleu',
      uniqueId: 'VP-0001',
      pieceTypeId: typeId,
      price: '120.00',
    };

    const pieceRes = await request(app).post('/api/pieces').send(payload);
    if (![200, 201].includes(pieceRes.status)) {
      // eslint-disable-next-line no-console
      console.log('pieceRes.body', pieceRes.body);
    }
    expect([200, 201]).toContain(pieceRes.status);

    // La route peut renvoyer { id } OU l'objet complet
    const pieceBody = pieceRes.body?.data ?? pieceRes.body;

    // Toujours : on doit avoir un id
    expect(pieceBody).toEqual(expect.objectContaining({ id: expect.any(Number) }));

    // Si la route renvoie aussi le nom, on le vérifie (sinon on n'échoue pas)
    if (pieceBody?.name) {
      expect(pieceBody).toEqual(expect.objectContaining({ name: payload.name }));
    }
  });
});
