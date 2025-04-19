/**
 * Simple P2P gossip layer using WebSocket for blocks and transactions.
 */
import type { Transaction } from "./models/Transaction";
import type { Block } from "./models/Block";
import type { Chain } from "./chain";

// Use native WebSocket in browser or ws in Node
const WebSocketImpl: any =
  typeof WebSocket !== 'undefined'
    ? WebSocket
    : require('ws');

/** Message types for P2P gossip */
type Message =
  | { type: 'transaction'; data: Transaction }
  | { type: 'block'; data: Block };

/**
 * P2PNode manages WebSocket connections to peers and broadcasts/receives messages.
 */
export class P2PNode {
  private peers: any[] = [];
  private chain: Chain;
  private onTransaction?: (tx: Transaction) => void;
  private onBlock?: (block: Block) => void;

  /**
   * @param chain Instance of Chain or PersistentChain to apply incoming blocks/txs.
   * @param peerUrls List of WebSocket URLs of peers (e.g., ws://localhost:6001).
   */
  /**
   * @param chain Blockchain instance to apply messages to.
   * @param peerUrls Initial list of peer WebSocket URLs.
   * @param callbacks Optional callbacks for incoming txs and blocks.
   */
  constructor(
    chain: Chain,
    peerUrls: string[],
    callbacks?: { onTransaction?: (tx: Transaction) => void; onBlock?: (block: Block) => void }
  ) {
    this.chain = chain;
    this.onTransaction = callbacks?.onTransaction;
    this.onBlock = callbacks?.onBlock;
    peerUrls.forEach((url) => this.connectPeer(url));
  }

  /** Connect to a single peer and set up handlers. */
  public connectPeer(url: string) {
    const ws = new WebSocketImpl(url);
    ws.onopen = () => console.log(`P2P: connected to ${url}`);
    ws.onmessage = (event: any) => this.handleMessage(event.data);
    ws.onerror = (err: any) => console.error(`P2P: error on ${url}`, err);
    ws.onclose = () => console.log(`P2P: disconnected from ${url}`);
    this.peers.push(ws);
  }

  /** Handle incoming raw message from a peer. */
  private handleMessage(raw: any) {
    let msg: Message;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === 'transaction') {
      try {
        this.chain.addTransaction(msg.data);
        this.onTransaction?.(msg.data);
      } catch {
        // ignore invalid tx
      }
    } else if (msg.type === 'block') {
      // Apply block if supported
      if (typeof (this.chain as any).applyBlock === 'function') {
        const ok = (this.chain as any).applyBlock(msg.data);
        if (ok) {
          this.onBlock?.(msg.data);
        }
      }
    }
  }

  /** Broadcast a transaction to all connected peers. */
  broadcastTransaction(tx: Transaction) {
    const msg: Message = { type: 'transaction', data: tx };
    const raw = JSON.stringify(msg);
    this.peers.forEach((ws) => ws.send(raw));
  }

  /** Broadcast a block to all connected peers. */
  broadcastBlock(block: Block) {
    const msg: Message = { type: 'block', data: block };
    const raw = JSON.stringify(msg);
    this.peers.forEach((ws) => ws.send(raw));
  }
}