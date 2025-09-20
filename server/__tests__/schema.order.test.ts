import { describe, it, expect } from '@jest/globals';
import { insertOrderSchema } from '../../shared/schema';

describe('Zod insertOrderSchema', () => {
  it('accepte un numéro de commande minimal', () => {
    const ok = insertOrderSchema.parse({ orderNumber: 'CMD-2025-0001' });
    expect(ok.orderNumber).toBe('CMD-2025-0001');
  });

  it('rejette un orderNumber vide', () => {
    expect(() => insertOrderSchema.parse({ orderNumber: '' })).toThrow();
  });
});
