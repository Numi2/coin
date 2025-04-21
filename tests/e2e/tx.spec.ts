import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { getApi, transfer, getBalance } from '../../lib/substrateApi';
import type { ApiPromise } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';

let api: ApiPromise;

beforeAll(async () => {
  api = await getApi();
});

afterAll(async () => {
  await api.disconnect();
});

describe('Balances Transfer E2E', () => {
  it('transfers balance between Alice and Bob', async () => {
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');
    const bob = keyring.addFromUri('//Bob');
    const aliceAddr = alice.address;
    const bobAddr = bob.address;

    const beforeAlice = await getBalance(aliceAddr);
    const beforeBob = await getBalance(bobAddr);
    const amount = 1n;
    await transfer(bobAddr, amount, 0n, alice);

    const afterAlice = await getBalance(aliceAddr);
    const afterBob = await getBalance(bobAddr);

    expect(afterAlice).toEqual(beforeAlice - amount);
    expect(afterBob).toEqual(beforeBob + amount);
  });
});