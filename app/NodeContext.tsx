"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getState, setState } from '../lib/db';
import type { Block, Transaction } from '@coin/blockchain';
import { PersistentChain, P2PNode } from '@coin/blockchain';
import { generateKeyPair, sign as signData, type KeyPair } from '@coin/wallet';

interface NodeContextType {
  chain: Block[];
  mempool: Transaction[];
  wallet: KeyPair;
  peerUrls: string[];
  addPeer: (url: string) => Promise<void>;
  createTransaction: (to: string, amount: string, fee: string) => Promise<void>;
  minePending: () => Promise<void>;
}

const NodeContext = createContext<NodeContextType | undefined>(undefined);

export function NodeProvider({ children }: { children: React.ReactNode }) {
  const [chain, setChain] = useState<Block[]>([]);
  const [mempool, setMempool] = useState<Transaction[]>([]);

  useEffect(() => {
    async function init() {
      let c = await getChain();
      if (c.length === 0) {
        const genesis = createGenesisBlock();
        c = [genesis];
        await setChain(c);
      }
      setChainState(c);

      const m = await getMempool();
      setMempoolState(m);
    }
    init();
  }, []);

  useEffect(() => {
    if (chain.length > 0) {
      setChain(chain);
    }
  }, [chain]);

  useEffect(() => {
    setMempool(mempool);
  }, [mempool]);

  const addBlock = async (block: Block) => {
    setChainState(prev => [...prev, block]);
  };

  const addTransaction = async (tx: Transaction) => {
    setMempoolState(prev => [...prev, tx]);
  };

  return (
    <NodeContext.Provider value={{ chain, mempool, addBlock, addTransaction }}>
      {children}
    </NodeContext.Provider>
  );
}

/**
 * Hook to access node state and actions
 */
export function useNode() {
  const context = useContext(NodeContext);
  if (!context) {
    throw new Error('useNode must be used within NodeProvider');
  }
  return context;
}