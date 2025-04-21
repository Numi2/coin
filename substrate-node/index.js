 import * as wasm from "./pow_kernel.js";

 // Re-export WASM bindings in a friendlier JS API
 export const init = wasm.init;
 export const startMining = wasm.start_mining;
 export const stop = wasm.stop;
 export const hash = wasm.blake3_hash;