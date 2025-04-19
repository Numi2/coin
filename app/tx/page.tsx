"use client";

import React, { useState } from 'react';
import { useNode } from '../NodeContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export default function TxPage() {
  const { createTransaction } = useNode();
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTransaction(to, amount, fee);
    setTo('');
    setAmount('');
    setFee('');
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Send COIN</h1>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium mb-1">To</label>
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Recipient public key"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Amount</label>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount in COIN"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fee</label>
          <Input
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="Transaction fee"
          />
        </div>
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}