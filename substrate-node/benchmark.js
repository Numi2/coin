 // benchmark.js: Compare CPU vs GPU hashing throughput
 import { init, compute_hashes, hash } from './index.js';

 async function benchCPU(iterations) {
   const work = new TextEncoder().encode('benchmark');
   console.log(`CPU: hashing ${iterations} messages`);
   const t0 = performance.now();
   for (let i = 0; i < iterations; i++) {
     hash(work);
   }
   const t1 = performance.now();
   const sec = (t1 - t0) / 1000;
   const rate = iterations / sec;
   console.log(`CPU: ${rate.toFixed(2)} hashes/sec (${sec.toFixed(2)}s)`);
   return rate;
 }

 async function benchGPU(iterations) {
   await init();
   const work = new TextEncoder().encode('benchmark');
   console.log(`GPU: hashing ${iterations} nonces`);
   const t0 = performance.now();
   // Perform a one-shot batch of `iterations` hash attempts
   await compute_hashes(work, iterations);
   const t1 = performance.now();
   const sec = (t1 - t0) / 1000;
   const rate = iterations / sec;
   console.log(`GPU: ${rate.toFixed(2)} hashes/sec (${sec.toFixed(2)}s)`);
   return rate;
 }

 (async () => {
   const iters = 1_000_000;
   const cpuRate = await benchCPU(iters);
   const gpuRate = await benchGPU(iters);
   console.log(`Speedup: ${(gpuRate / cpuRate).toFixed(2)}x`);
   if (navigator.gpu && navigator.gpu.features) {
     console.log('GPU features:', Array.from(navigator.gpu.features));
   }
 })();