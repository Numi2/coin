"use client";

import React, { useState } from 'react';
import { useNode } from '../NodeContext';
import { Button } from '../components/ui/Button';

export default function MinePage() {
  const { chain, minePending } = useNode();
  const [mining, setMining] = useState(false);

  const handleMine = async () => {
    setMining(true);
    await minePending();
    setMining(false);
  };

  const height = chain.length - 1;
  const tip = chain[chain.length - 1];

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Mine Block</h1>
      <p>Current Height: {height}</p>
      <p>
        Previous Hash: <code className="font-mono">{tip.hash}</code>
      </p>
      <Button onClick={handleMine} disabled={mining}>
        {mining ? 'Mining...' : 'Mine Block'}
      </Button>
    </div>
  );
}