"use client";

import React, { useState } from 'react';
import { useNode } from '../NodeContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export default function PeersPage() {
  const { peerUrls, addPeer } = useNode();
  const [newPeer, setNewPeer] = useState('');

  const handleAdd = async () => {
    if (newPeer.trim()) {
      await addPeer(newPeer.trim());
      setNewPeer('');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Peers</h1>
      <ul className="list-disc list-inside">
        {peerUrls.map((url) => (
          <li key={url}>{url}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          value={newPeer}
          onChange={(e) => setNewPeer(e.target.value)}
          placeholder="ws://localhost:6001"
          className="flex-1"
        />
        <Button onClick={handleAdd}>Add Peer</Button>
      </div>
    </div>
  );
}