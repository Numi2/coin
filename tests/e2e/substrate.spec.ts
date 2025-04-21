import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { getApi } from '../../lib/substrateApi';
import type { ApiPromise } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';

let api: ApiPromise;

beforeAll(async () => {
  api = await getApi();
});

afterAll(async () => {
  await api.disconnect();
});

describe('Substrate Node E2E', () => {
  it('connects to node and fetches header', async () => {
    const header = await api.rpc.chain.getHeader();
    expect(header.number.toNumber()).toBeGreaterThanOrEqual(0);
    expect(header.parentHash.toString().startsWith('0x')).toBe(true);
  });

  it('submits doSomething extrinsic and reads storage', async () => {
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');
    // Send extrinsic
    await new Promise<void>((resolve, reject) => {
      api.tx.basicPallet.doSomething(42).signAndSend(alice, ({ status, dispatchError }) => {
        if (dispatchError) {
          reject(dispatchError.toString());
        }
        if (status.isInBlock) {
          resolve();
        }
      });
    });
    // Query storage
    const value = await api.query.basicPallet.something();
    expect(value.toNumber()).toBe(42);
  });
});