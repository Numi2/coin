"use client";

import React from 'react';
import { useNode } from '../NodeContext';

export default function MempoolPage() {
  const { mempool } = useNode();

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Mempool</h1>
      {mempool.length === 0 ? (
        <p>No pending transactions.</p>
      ) : (
        <ul className="space-y-2">
          {mempool.map((tx) => (
            <li key={tx.signature} className="border p-2 rounded-md">
              <p><strong>From:</strong> <code className="font-mono">{tx.from}</code></p>
              <p><strong>To:</strong> <code className="font-mono">{tx.to}</code></p>
              <p><strong>Amount:</strong> {tx.amount.toString()}</p>
              <p><strong>Fee:</strong> {tx.fee.toString()}</p>
              <p><strong>Time:</strong> {new Date(tx.timestamp).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}