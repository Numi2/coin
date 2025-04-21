import { describe, test, expect } from 'vitest';
import { generateKeyPair, sign, verify, PQAlgorithm } from '@coin/wallet';
import { TextEncoder } from 'util';

const algorithms: { name: string; key: PQAlgorithm }[] = [
  { name: 'Dilithium', key: 'dilithium' },
  { name: 'SPHINCS+', key: 'sphincs' }
];

describe('Post-quantum wallet generate/sign/verify', () => {
  algorithms.forEach(({ name, key }) => {
    test(`${name} round-trip correctly`, () => {
      const { publicKey, privateKey } = generateKeyPair(key);
      const encoder = new TextEncoder();
      const msg = encoder.encode('hello PQ');
      const sig = sign(msg, privateKey, key);
      expect(verify(msg, sig, publicKey, key)).toBe(true);
    });
  });
});