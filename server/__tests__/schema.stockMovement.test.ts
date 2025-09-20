import { describe, it, expect } from '@jest/globals';
import { insertStockMovementSchema } from '../../shared/schema';

describe('Zod insertStockMovementSchema', () => {
  it('accepte un mouvement IN valide', () => {
    const ok = insertStockMovementSchema.parse({
      type: 'in',
      quantity: '5',
      reason: 'Réception fournisseur',
      stockItemId: 1,
    });
    expect(ok.type).toBe('in');
  });

  it('rejette un mouvement sans reason', () => {
    const bad: any = { type: 'out', quantity: '1' };
    expect(() => insertStockMovementSchema.parse(bad)).toThrow();
  });
});
