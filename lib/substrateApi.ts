// Substrate RPC client integration using polkadot-js API
import { ApiPromise, WsProvider } from '@polkadot/api';
let apiPromise: ApiPromise | null = null;

/**
 * Connect to a Substrate node via WebSocket endpoint (default ws://localhost:9944)
 */
export async function getApi(endpoint = 'ws://localhost:9944'): Promise<ApiPromise> {
  if (apiPromise && apiPromise.isConnected) {
    return apiPromise;
  }
  const provider = new WsProvider(endpoint);
  apiPromise = await ApiPromise.create({ provider });
  await apiPromise.isReady;
  return apiPromise;
}
/**
 * Submit a balance transfer from a sender (default Alice) to a recipient.
 * Returns the transaction hash of the in-block or finalized inclusion.
 */
export async function transfer(
  to: string,
  amount: number | string | bigint,
  tip: number | string | bigint = 0,
  sender?: import('@polkadot/keyring').KeyringPair
): Promise<string> {
  const api = await getApi();
  // Use default dev account Alice if no sender provided
  const keyring = new (await import('@polkadot/keyring')).Keyring({ type: 'sr25519' });
  const signer = sender || keyring.addFromUri('//Alice');
  return new Promise<string>((resolve, reject) => {
    api.tx.balances
      .transfer(to, amount)
      .signAndSend(signer, { tip }, ({ status, dispatchError }) => {
        if (dispatchError) {
          reject(dispatchError.toString());
        } else if (status.isInBlock || status.isFinalized) {
          const hash = status.isInBlock
            ? status.asInBlock.toHex()
            : status.asFinalized.toHex();
          resolve(hash);
        }
      })
      .catch((e) => reject(e.toString()));
  });
}

/**
 * Query the free balance of an account.
 */
export async function getBalance(account: string): Promise<bigint> {
  const api = await getApi();
  const { data: { free } } = await api.query.system.account(account);
  return free.toBigInt();
}