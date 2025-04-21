"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { getState, setState } from "../lib/db";
import { getSecure } from "../lib/secureStore";
import { ApiPromise } from "@polkadot/api";
import { SignerPayloadJSON, SignerResult } from "@polkadot/types/types";
import { getApi } from "../lib/substrateApi";
import type { Transaction, Block, Header } from "@coin/blockchain";
import {
  PersistentChain,
  P2PNode,
  IndexedDBAdapter,
  hexToBytes,
  bytesToHex,
  type Chain,
} from "@coin/blockchain";
import { sign as signData, type KeyPair } from "@coin/wallet";
import { init as minerInit, startMining as minerStart, stop as minerStop } from "substrate-node";

interface NodeContextType {
  chain: Array<{ number: number; hash: string }>;
  mempool: Transaction[];
  peerUrls: string[];
  addPeer: (url: string) => Promise<void>;
  startMining: () => Promise<void>;
  stopMining: () => void;
  api: ApiPromise | null;
  address?: string;
  walletKey?: KeyPair;
  createTransaction: (to: string, amount: string, fee: string) => Promise<void>;
}

const NodeContext = createContext<NodeContextType | undefined>(undefined);

export function NodeProvider({ children }: { children: React.ReactNode }) {
  const [chain, setChain] = useState<Array<{ number: number; hash: string }>>([]);
  const [mempool, setMempool] = useState<Transaction[]>([]);
  const [peerUrls, setPeerUrls] = useState<string[]>([]);
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [walletKey, setWalletKey] = useState<KeyPair>();
  const [address, setAddress] = useState<string>();
  const offlineRef = useRef<PersistentChain | null>(null);
  const p2pRef = useRef<P2PNode | null>(null);

  useEffect(() => {
    async function initAll() {
      await minerInit();

      // load wallet
      const stored = await getSecure("wallet-key");
      if (stored) {
        try {
          const kp: KeyPair = JSON.parse(stored);
          setWalletKey(kp);
          const pub = hexToBytes(kp.publicKey);
          // Use WASM-based Blake3 hashing
          const hash = await import('@c4312/blake3-wasm').then((m) => m.hash(pub));
          const addrHex = bytesToHex(hash);
          setAddress(addrHex.startsWith("0x") ? addrHex : `0x${addrHex}`);
        } catch {
          console.error("Invalid wallet key");
        }
      }

      // offline chain + P2P
      try {
        const storage = new IndexedDBAdapter();
        const offline = await PersistentChain.create({ storageAdapter: storage });
        offlineRef.current = offline;
        setChain(offline.getBlocks().map((b, index) => ({
          number: index,
          hash: b.hash,
        })));
        setMempool(offline.getPendingTransactions());
        const peers = await getState<string[]>("peers", []);
        setPeerUrls(peers);
        const p2p = new P2PNode(offline as unknown as Chain, peers, {
          onBlock: () =>
            setChain(
              offline.getBlocks().map((b, index) => ({
                number: index,
                hash: b.hash,
              }))
            ),
          onTransaction: () =>
            setMempool(offline.getPendingTransactions()),
        });
        p2pRef.current = p2p;
      } catch {
        console.error("Offline mesh init failed");
      }

      // Substrate RPC
      try {
        const api = await getApi();
        setApi(api);
        api.rpc.chain.subscribeNewHeads((header) => {
          const num = header.number.toNumber();
          const hash = header.hash.toHex();
          setChain((prev) =>
            prev.length && prev[prev.length - 1].hash === hash
              ? prev
              : [...prev, { number: num, hash }]
          );
          p2pRef.current?.broadcastBlock({
            header: {
              previousHash: "",
              merkleRoot: "",
              timestamp: Date.now(),
              nonce: 0,
              difficulty: BigInt(0),
            },
            transactions: [],
            hash,
          });
        });
        api.on?.("disconnected", () => {
          console.warn("RPC disconnected; using offline cache");
          const off = offlineRef.current;
          if (off) {
            setChain(
              off.getBlocks().map((b, index) => ({
                number: index,
                hash: b.hash,
              }))
            );
            setMempool(off.getPendingTransactions());
          }
        });
      } catch {
        console.error("RPC init failed; offline only");
      }
    }

    initAll().catch(console.error);
  }, []);

  const createTransaction = useCallback(
    async (to: string, amountStr: string, feeStr: string) => {
      if (!walletKey || !address) {
        throw new Error("Wallet not initialized");
      }
      const amount = BigInt(amountStr);
      const fee = BigInt(feeStr);

      // on‑chain
      if (api) {
        try {
          await api.tx
            .balances
            .transfer(to, amount)
            .signAndSend(address, {
              signer: {
                signPayload: async (payload: SignerPayloadJSON): Promise<SignerResult> => {
                  if (!api) throw new Error("API not initialized"); // Guard against null API
                  // Create ExtrinsicPayload from SignerPayloadJSON using api.registry
                  const wrapper = api.registry.createType('ExtrinsicPayload', payload, { version: payload.version });
                  // Get signing bytes
                  const signingData = wrapper.toU8a(true);
                  const signature = signData(signingData, walletKey.privateKey);
                  return {
                    id: 1, 
                    signature: signature.startsWith("0x") ? signature as `0x${string}` : `0x${signature}` as `0x${string}`,
                  };
                },
              },
              tip: fee,
            });
        } catch (e) {
          console.error("On-chain submit failed", e);
        }
      }

      // offline + P2P
      const offline = offlineRef.current;
      const p2p = p2pRef.current;
      if (!offline || !p2p) return;

      const ts = Date.now();
      const payload = `${address}|${to}|${amount}|${fee}|${ts}`;
      const sig = signData(
        new TextEncoder().encode(payload),
        walletKey.privateKey
      );
      const tx: Transaction = { from: address, to, amount, fee, timestamp: ts, signature: sig };

      await offline.addTransaction(tx);
      p2p.broadcastTransaction(tx);
    },
    [api, address, walletKey]
  );

  const startMining = useCallback(async () => {
    if (!chain.length) throw new Error("No chain tip");
    const tip = chain[chain.length - 1];
    const work = new TextEncoder().encode(JSON.stringify(tip));
    const target = 0xffffffff;
    await minerStart(work, target, async (nonce: number) => {
      console.log("nonce", nonce);
      if (api && address && walletKey) {
        try {
          await api.tx.basicPallet
            .submitBlock(
              new Uint8Array(new Uint32Array([nonce]).buffer),
              await api.rpc.chain.getBlockHash(tip.number)
            )
            .signAndSend(address, {
              signer: {
                signPayload: async (payload: SignerPayloadJSON): Promise<SignerResult> => {
                  if (!api) throw new Error("API not initialized"); // Guard against null API
                  // Create ExtrinsicPayload from SignerPayloadJSON using api.registry
                  const wrapper = api.registry.createType('ExtrinsicPayload', payload, { version: payload.version });
                  // Get signing bytes
                  const signingData = wrapper.toU8a(true);
                  const signature = signData(signingData, walletKey.privateKey);
                  return {
                    id: 1, 
                    signature: signature.startsWith("0x") ? signature as `0x${string}` : `0x${signature}` as `0x${string}`,
                  };
                },
              },
            });
        } catch (e) {
          console.error("Block submit failed", e);
        }
      }
      const offline = offlineRef.current;
      const p2p = p2pRef.current;
      if (offline && p2p) {
        const blk: Block = {
          header: {
            previousHash: "",
            merkleRoot: "",
            timestamp: Date.now(),
            nonce,
            difficulty: BigInt(0),
          },
          transactions: [],
          hash: tip.hash,
        };
        await offline.applyBlock(blk);
        p2p.broadcastBlock(blk);
      }
    });
  }, [api, address, walletKey, chain]);

  const stopMining = useCallback(() => {
    minerStop();
  }, []);

  const addPeer = useCallback(
    async (url: string) => {
      const p2p = p2pRef.current;
      if (!p2p) return;
      p2p.connectPeer(url);
      if (api) {
        try {
          const sys = (api.rpc.system as any);
          if (sys.connectPeer) {
            await sys.connectPeer(url);
          } else if (sys.dialPeer) {
            await sys.dialPeer(url);
          } else if (sys.addReservedPeer) {
            await sys.addReservedPeer(url);
          }
        } catch (e) {
          console.error("RPC connectPeer failed", e);
        }
      }
      const next = Array.from(new Set([...peerUrls, url]));
      setPeerUrls(next);
      await setState("peers", next);
    },
    [peerUrls, api]
  );

  return (
    <NodeContext.Provider
      value={{
        chain,
        mempool,
        peerUrls,
        addPeer,
        startMining,
        stopMining,
        api,
        address,
        walletKey,
        createTransaction,
      }}
    >
      {children}
    </NodeContext.Provider>
  );
}

export function useNode() {
  const ctx = useContext(NodeContext);
  if (!ctx) throw new Error("useNode must be inside NodeProvider");
  return ctx;
}