// Removed wasm-bindgen related imports
use std::sync::atomic::{AtomicBool, Ordering};
// Removed unused bytemuck import

static ABORT_FLAG: AtomicBool = AtomicBool::new(false);

/// Searches for a nonce such that the BLAKE3 hash of `work` concatenated with `nonce`
/// (represented as little-endian bytes) is less than or equal to `target`.
/// Returns `Some(nonce)` if found, `None` if aborted via `stop()`.
pub fn mine(work: &[u8], target: u32) -> Option<u64> {
    ABORT_FLAG.store(false, Ordering::SeqCst);

    // CPU mining loop
    {
        let work = work.to_vec(); // Clone work data for the loop
        let mut nonce: u64 = 0;
        loop { // Changed from `while` to `loop` for explicit break/return
            if ABORT_FLAG.load(Ordering::SeqCst) {
                return None; // Aborted
            }
            let mut hasher = blake3::Hasher::new();
            hasher.update(&work);
            hasher.update(&nonce.to_le_bytes());
            let hash = hasher.finalize();
            let bytes = hash.as_bytes();
            // Compare the first 4 bytes (as u32 little-endian) against the target
            let h0 = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
            if h0 <= target {
                return Some(nonce); // Found
            }
            nonce = nonce.wrapping_add(1);
            // Potential yield point for cooperative multitasking if needed in WASM?
            // For now, it's a blocking loop.
        }
    }
}

/// Signal cancellation to mining.
pub fn stop() {
    ABORT_FLAG.store(true, Ordering::SeqCst);
}

/// Compute standard BLAKE3 hash (32 bytes) of input.
pub fn blake3_hash(input: &[u8]) -> Vec<u8> {
    let mut hasher = blake3::Hasher::new();
    hasher.update(input);
    let hash = hasher.finalize();
    hash.as_bytes().to_vec()
}