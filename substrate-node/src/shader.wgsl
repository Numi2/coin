 // WGSL compute shader for BLAKE3-based PoW mining

 // Initialization Vector (IV) for BLAKE3
 const IV: array<u32, 8> = array<u32, 8>(
     0x6A09E667u, 0xBB67AE85u, 0x3C6EF372u, 0xA54FF53Au,
     0x510E527Fu, 0x9B05688Cu, 0x1F83D9ABu, 0x5BE0CD19u,
 );

 // Message word permutation (first 7 rounds of BLAKE3/BLAKE2s)
 const SIGMA: array<array<u32, 16>, 7> = array<array<u32, 16>, 7>(
     array<u32, 16>( 0u,  1u,  2u,  3u,  4u,  5u,  6u,  7u,  8u,  9u, 10u, 11u, 12u, 13u, 14u, 15u),
     array<u32, 16>(14u, 10u,  4u,  8u,  9u, 15u, 13u,  6u,  1u, 12u,  0u,  2u, 11u,  7u,  5u,  3u),
     array<u32, 16>(11u,  8u, 12u,  0u,  5u,  2u, 15u, 13u, 10u, 14u,  3u,  6u,  7u,  1u,  9u,  4u),
     array<u32, 16>( 7u,  9u,  3u,  1u, 13u, 12u, 11u, 14u,  2u,  6u,  5u, 10u,  4u,  0u, 15u,  8u),
     array<u32, 16>( 9u,  0u,  5u,  7u,  2u,  4u, 10u, 15u, 14u,  1u, 11u, 12u,  6u,  8u,  3u, 13u),
     array<u32, 16>( 2u, 12u,  6u, 10u,  0u, 11u,  8u,  3u,  4u, 13u,  7u,  5u, 15u, 14u,  1u,  9u),
     array<u32, 16>(12u,  5u,  1u, 15u, 14u, 13u,  4u, 10u,  0u,  7u,  6u,  3u,  9u,  2u,  8u, 11u),
 );

 // Rotate right
 fn rotr(x: u32, bits: u32) -> u32 {
     return (x >> bits) | (x << (32u - bits));
 }

 // The G mixing function
 fn G(v: ptr<function, array<u32, 16>>, a: u32, b: u32, c: u32, d: u32, x: u32, y: u32) {
     (*v)[a] = (*v)[a] + (*v)[b] + x;
     (*v)[d] = rotr((*v)[d] ^ (*v)[a], 16u);
     (*v)[c] = (*v)[c] + (*v)[d];
     (*v)[b] = rotr((*v)[b] ^ (*v)[c], 12u);
     (*v)[a] = (*v)[a] + (*v)[b] + y;
     (*v)[d] = rotr((*v)[d] ^ (*v)[a], 8u);
     (*v)[c] = (*v)[c] + (*v)[d];
     (*v)[b] = rotr((*v)[b] ^ (*v)[c], 7u);
 }

 struct Params {
     @offset(0) target: u32;
     @offset(4) base_nonce: u32;
 };

 struct Result {
     @offset(0) found: atomic<u32>;
     @offset(4) nonce: u32;
 };

 @group(0) @binding(0)
 var<uniform> params: Params;
 @group(0) @binding(1)
 var<storage, read> message: array<u32, 16>;
 @group(0) @binding(2)
 var<storage, read_write> result: Result;

 @compute @workgroup_size(64)
 fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
     let idx = gid.x;
     let nonce = params.base_nonce + idx;
     var m = message;
     m[15] = nonce;

     // Initialize state
     var v: array<u32, 16>;
     v[0] = IV[0]; v[1] = IV[1]; v[2] = IV[2]; v[3] = IV[3];
     v[4] = IV[4]; v[5] = IV[5]; v[6] = IV[6]; v[7] = IV[7];
     v[8] = IV[0]; v[9] = IV[1]; v[10] = IV[2]; v[11] = IV[3];
     v[12] = IV[4]; v[13] = IV[5]; v[14] = IV[6] ^ 64u; v[15] = IV[7] ^ 3u;

     // Compression rounds
     for (var round: u32 = 0u; round < 7u; round = round + 1u) {
         let s = SIGMA[round];
         G(&v, 0u, 4u, 8u, 12u, m[s[0]], m[s[1]]);
         G(&v, 1u, 5u, 9u, 13u, m[s[2]], m[s[3]]);
         G(&v, 2u, 6u, 10u, 14u, m[s[4]], m[s[5]]);
         G(&v, 3u, 7u, 11u, 15u, m[s[6]], m[s[7]]);
         G(&v, 0u, 5u, 10u, 15u, m[s[8]], m[s[9]]);
         G(&v, 1u, 6u, 11u, 12u, m[s[10]], m[s[11]]);
         G(&v, 2u, 7u, 8u, 13u, m[s[12]], m[s[13]]);
         G(&v, 3u, 4u, 9u, 14u, m[s[14]], m[s[15]]);
     }

     // Finalize and check target
     let h0 = v[0] ^ v[8] ^ IV[0];
     if (h0 <= params.target) {
         let prev = atomicCompareExchangeWeak(&result.found, 0u, 1u).old_value;
         if (prev == 0u) {
             result.nonce = nonce;
         }
     }
 }