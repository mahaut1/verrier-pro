import { describe, it, expect } from '@jest/globals';
import { insertPieceSchema } from '../../shared/schema';

describe('Zod insertPieceSchema', () => {
  it('accepte un payload minimal valable', () => {
    const payload = {
      name: 'Vase bleu',
      uniqueId: 'VP-0001',
      pieceTypeId: 1,
      price: '120.00',
      status: 'workshop',
      currentLocation: 'atelier',
    };
    expect(() => insertPieceSchema.parse(payload)).not.toThrow();
  });

  it('rejette un payload sans name', () => {
    const payload: any = { uniqueId: 'X-1', price: '10.00' };
    expect(() => insertPieceSchema.parse(payload)).toThrow();
  });
});
