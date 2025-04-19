This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```
## Blockchain Packages

This project includes a set of TypeScript packages for building a fully-decentralized, in-browser-mined proof-of-work blockchain:

- `@coin/blockchain`: Core data models (Block, Header, Transaction, Token) and hashing utilities.
- `@coin/tokenomics`: Token issuance, block reward halving, and transaction fee calculations.
- `@coin/wallet`: Post-quantum key generation and signing (cold wallets).
- `@coin/sdk`: Combined interface for blockchain, tokenomics, and wallet.

To install workspaces and run the development environment:

```bash
npm install
npm run dev
```
## Project Progress

### Completed
- Initialized Next.js app with npm workspaces for monorepo
- Created core TypeScript packages: `@coin/blockchain`, `@coin/tokenomics`, `@coin/wallet`, `@coin/sdk`
- Implemented BLAKE3-based PoW in `@coin/blockchain`:
  - `hashHeader` for deterministic header serialization and BLAKE3 hashing
  - `bytesToHex` utility
  - `mine` loop for nonce discovery
  - `adjustDifficulty` for adaptive target adjustment
- Stubbed post-quantum wallet interfaces (`generateKeyPair`, `sign`, `verify`)
- Defined tokenomics with block reward halving and transaction fee calculation

### Next Steps
1. Flesh out the `@coin/wallet` package with a post-quantum crypto library for key generation and signing
2. Build React UI components/pages in the Next.js app for mining, transaction creation, and sending COIN
3. Implement a lightweight persistent node using IndexedDB or localStorage to store chain state and transactions
4. Integrate the SDK to assemble, validate, and broadcast blocks and transactions
