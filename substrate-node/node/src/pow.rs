use blake3::Hasher;
use wasm_bindgen::prelude::*;

/// Perform a simple Blake3-based Proof-of-Work.
/// Finds a nonce such that hash(header || nonce) has a u32 prefix < difficulty.
#[wasm_bindgen]
pub fn blake3_pow(header: &[u8], difficulty: u32) -> Option<u32> {
    let mut hasher = Hasher::new();
    for nonce in 0..u32::MAX {
        hasher.update(header);
        hasher.update(&nonce.to_le_bytes());
        let hash = hasher.finalize();
        let prefix = &hash.as_bytes()[..4];
        let val = u32::from_le_bytes(prefix.try_into().unwrap());
        if val < difficulty {
            return Some(nonce);
        }
        hasher.reset();
    }
    None
}