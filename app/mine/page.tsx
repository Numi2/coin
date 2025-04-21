"use client";

import React, { useState } from 'react';
import { useNode } from '../NodeContext';
import { Button } from '../components/ui/Button';

export default function MinePage() {
  const { chain, startMining, stopMining } = useNode();
  const [mining, setMining] = useState(false);

  const handleStart = async () => {
    setMining(true);
    await startMining();
    setMining(false);
  };
  const handleStop = () => {
    stopMining();
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
      <div className="space-x-2">
        <Button onClick={handleStart} disabled={mining}>
          {mining ? 'Mining...' : 'Start Mining'}
        </Button>
        <Button onClick={handleStop} disabled={!mining}>
          Stop Mining
        </Button>
      </div>
    </div>
  );
}