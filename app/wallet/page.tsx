"use client";
import React, { useState, useEffect } from 'react';
import { generateKeyPair, type KeyPair } from '@coin/wallet';
import { storeSecure, getSecure } from '../../lib/secureStore';

export default function WalletPage() {
  const [keypair, setKeypair] = useState<KeyPair | null>(null);
  const [privateVisible, setPrivateVisible] = useState(false);

  useEffect(() => {
    async function load() {
      const stored = await getSecure('wallet-key');
      if (stored) {
        try {
          const kp: KeyPair = JSON.parse(stored);
          setKeypair(kp);
        } catch {}
      }
    }
    load();
  }, []);

  const handleGenerate = async () => {
    const kp = generateKeyPair();
    setKeypair(kp);
    await storeSecure('wallet-key', JSON.stringify(kp));
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Wallet</h1>
      {keypair ? (
        <div>
          <p><strong>Public Key:</strong> <code>{keypair.publicKey}</code></p>
          <p>
            <strong>Private Key:</strong>{' '}
            {privateVisible ? <code>{keypair.privateKey}</code> : '••••••••'}{' '}
            <button onClick={() => setPrivateVisible(v => !v)} className="ml-2 text-sm text-blue-500">
              {privateVisible ? 'Hide' : 'Show'}
            </button>
          </p>
        </div>
      ) : (
        <button onClick={handleGenerate} className="px-4 py-2 bg-green-500 text-white rounded">
          Generate Key Pair
        </button>
      )}
    </div>
  );
}