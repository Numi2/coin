

Qoin is a browser-native, post-quantum blockchain mining prototype using the WebGPU API and a Rust Substrate backend. It offloads compute-intensive tasks like hashing and key encapsulation to the GPU directly in-browser, enabling decentralized mining without native installation. The project integrates CRYSTALS‑Kyber (KEM) and CRYSTALS‑Dilithium (signatures) via pqclean crates to ensure post-quantum security. It replaces SHA-based hashing with Blake3 in the runtime for speed and modern cryptographic resilience.



- `@coin/blockchain`: Core data models (Block, Header, Transaction, Token) and hashing utilities.
- `@coin/tokenomics`: Token issuance, block reward halving, and transaction fee calculations.
 - `@coin/wallet`: Post-quantum key generation and signing (CRYSTALS‑Dilithium Level 3 via `@noble/post-quantum`).
- `@coin/sdk`: Combined interface for blockchain, tokenomics, and wallet.

## Project Progress

### Completed
- Initialized Next.js app with npm workspaces for monorepo
- Created core TypeScript packages: `@coin/blockchain`, `@coin/tokenomics`, `@coin/wallet`, `@coin/sdk`
- Implemented BLAKE3-based PoW in `@coin/blockchain`:
  - `hashHeader` for deterministic header serialization and BLAKE3 hashing
  - `bytesToHex` utility
  - `mine` loop for nonce discovery
  - `adjustDifficulty` for adaptive target adjustment


### Next Steps

GOAL: a browser-native, post-quantum blockchain using Nextjs Frontend, the WebGPU API and a Rust Substrate backend. It offloads compute-intensive tasks like hashing and key encapsulation to the GPU directly in-browser, enabling decentralized mining without native installation. The project integrates CRYSTALS‑Kyber (KEM) and CRYSTALS‑Dilithium (signatures) via pqclean crates to ensure post-quantum security. It replaces SHA-based hashing with Blake3 in the runtime for speed and modern cryptographic resilience.


        1. Monorepo layout
           • root/
             – app/        ← Next.js 13 “app”‑router front‑end
             – lib/        ← some shared helpers (e.g. a Polkadot‑JS RPC client)
             – packages/   ← your TypeScript blockchain, tokenomics, wallet & SDK libraries
             – substrate‑node/ ← the Rust Substrate node template + a GPU‑accelerated PoW WASM crate
             – tests/      ← end‑to‑end tests against the native Substrate node
        2. substrate‑node (Rust + WASM)
           • pow‑kernel crate (in substrate‑node/Cargo.toml)
             – Implements a Blake3 PoW kernel over WebGPU (wgpu → WGSL shaders + dispatch).
             – Exposes wasm‑bindgen functions: init(), start_mining(work, target, cb), stop().
             – Packaged via wasm‑pack into a JS module (substrate‑node/index.js) so your Next.js app can import it.
           • Native Substrate node (in substrate‑node/node & pallets/runtime/)
             – Forked from the Substrate node‑template, swapped in:
             • Blake3 for all on‑chain hashing
             • PQClean’s CRYSTALS‑Kyber for libp2p KEM (QUIC transport)
             • PQClean’s CRYSTALS‑Dilithium for block/tx signatures
             – Exposes the usual Substrate JSON‑RPC (ws://localhost:9944) and P2P interfaces.
        3. Next.js front‑end (app/)
           • NodeContext.tsx
             – Holds in‑browser chain state (blocks + mempool) in IndexedDB (lib/db)
             – Loads or generates your post‑quantum wallet key (stored via getSecure)
             – Imports the WASM miner via
             `import { init as minerInit, startMining as minerStart, stop as minerStop } from 'substrate‑node'`
           and calls minerInit() on mount.
             – Exposes startMining(work, target) → minerStart(...) and stopMining → minerStop() to the UI.
             – (Planned) will also spin up a PersistentChain + P2PNode from `@coin/blockchain` to gossip with peers.
           • Pages & components under app/
             – /mine → wire up a “Mine” button to NodeContext.startMining()
             – /wallet, /tx, /mempool, /peers → UIs to generate addresses, craft & sign PQ transactions, inspect the pool, manage peers.
        4. Native‑node RPC glue (lib/substrateApi.ts + tests)
           • lib/substrateApi.ts wraps polkadot‑js API to talk to your Rust node’s JSON‑RPC.
           • tests/e2e/substrate.spec.ts spins up getApi(),
             submits a basicPallet.doSomething(42) extrinsic, then reads it back from storage.
        5. How they work together today
           • The browser can mine blocks locally using the WASM + WebGPU kernel alone—no native install.
           • You can separately run the native Substrate node (`cd substrate-node/node && cargo run --release`) to provide a “real” node.
           • You can connect to that node via lib/substrateApi.ts or directly via Polkadot‑JS, but the React UI is not yet wired to call RPCs.
           • P2P gossip among browser nodes will eventually use the TS P2PNode class in @coin/blockchain to mesh browsers together.
        6. Gaps / next integration steps
           • In NodeContext, instantiate PersistentChain + P2PNode and wire up:
           – addPeer(url) → p2p.connectPeer(url) or RPC connectPeer
           – createTransaction(...) → sign w/ your PQ wallet + broadcast via p2p or RPC tx_submit
           – minePending() → pull the tip header (via RPC or in‑memory chain), call minerStart, then submit new block via RPC.
           • Hook pages to lib/substrateApi so users can point at any HTTP/WebSocket node.
           • Flesh out the UI flows for key generation, import/export, block explorer, and peer list management.

    ——
    In its current form the repo already gives you:
    • A full Rust Substrate node patched for Blake3 + PQ crypto, with pallets & JSON‑RPC
    • A GPU‑accelerated PoW kernel compiled to WASM and consumable in the browser
    • A TS monorepo of core blockchain, tokenomics, wallet & RPC helper libraries
    • A half‑built Next.js React UI (NodeContext + pages) that ties together IndexedDB state, PQ wallet & WASM miner

    Your next major glue work is wiring NodeContext up to both the WASM miner (already imported) and the Substrate RPC/P2P layer (lib/substrateApi +
    @coin/blockchain P2PNode), so that mined blocks and signed transactions are broadcast into a real Substrate network rather than just staying in IndexedDB.
--
— Phase 1: Rust/Substrate Core
      • Scaffold a new Substrate node (e.g. via the Substrate node‑template).
      • Add & wire up libp2p with QUIC transport, replace X25519 with CRYSTALS‑Kyber KEM (via pqclean crates).
      • Swap in CRYSTALS‑Dilithium for all on‑chain signatures, Blake3 for hashing in your runtime.
      • Build a minimal pallet to handle your basic block/tx model and expose a JSON‑RPC or WS RPC endpoint.

    — Phase 2: GPU‑Accelerated Miner in Rust→WASM
      • Create a standalone Rust crate (pow-kernel) that implements your Blake3 PoW search using wgpu.
      • Compile to WASM with wasm-bindgen exposing JS functions like init(), startMining(cb), stop().
      • Benchmarks against your current JS loop to validate massive speed‐ups.

      Phase 2: GPU‑Accelerated Miner in Rust→WASM

1. Crate setup
   • Create new crate `pow-kernel` with Cargo.toml (wgpu, wasm-bindgen, console_error_panic_hook, Blake3).
   • Organize: `src/lib.rs`, `src/shader.wgsl`.

2. Compute shader
   • Write WGSL implementing Blake3’s compression/search loop.
   • Load & compile it in Rust at runtime via `wgpu::Device::create_shader_module`.

3. Rust WASM bindings
   • In `lib.rs`, expose via wasm-bindgen:
       – `async fn init()`: requestAdapter(), requestDevice(), create pipeline.
       – `fn start_mining(work: &[u8], target: u32, cb: &js_sys::Function)`: dispatch loop, invoke `cb.call1(&JsValue::NULL, &nonce.into())` on success.
       – `fn stop()`: signal canceallation.
   • Use an `AbortController`–style AtomicBool to break loops.

4. Fallback & features
   • Detect WebGPU support in `init`; if unavailable, fall back to CPU PoW in WASM.
   • Use Cargo features `gpu` vs `cpu` to include/exclude WGSL.

5. Build & packaging

   • Include `package.json` exports for `init`, `startMining`, `stop`.

6. Benchmarks
   • Provide a JS test harness that:
       – Measures `performance.now()` before/after 1 M hashes on CPU vs GPU.
       – Logs hashes/sec and speed‑up factor.
       – Outputs basic GPU utilization stats if available.

Deliver all Rust code, WGSL shader, Cargo.toml, JS binding examples, fallback logic, and a sample benchmark script.```

    — Phase 3: Client Glue & P2P
      • In your React NodeContext, spin up a TS wrapper around your Substrate RPC client and your new WASM miner.
      • Wire addPeer(url) → Substrate’s libp2p peer management (or the RPC “connectPeer” endpoint).
      • Wire createTransaction(...) → sign via your WASM PQC signature lib and submit via RPC.
      • Wire minePending() → call into your WASM miner, poll for solutions, and submit valid blocks via RPC.

    — Phase 4: Secure Key Storage & UI
      • Implement IndexedDB (or WebCrypto “Secure Storage”) bindings in TS for private keys.
      • Build React pages for key‐generation (Dilithium), import/export, transaction drafting and signing.

    — Phase 5: CI/CD & Deployment
      • GitHub Actions to build/test Rust node, WASM artefacts, and TS client.
      • Dockerfile / Kubernetes manifests for your node.
      • IPFS + Cloudflare Pages pipeline for your UI.
      • Prometheus/Grafana exporter in the Rust node for monitoring.