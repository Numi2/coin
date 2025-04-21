//! Persistent, rotating keystore for Kyber768 keypairs.
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{PathBuf},
    error::Error,
    time::Duration,
};
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use base64::{engine::general_purpose, Engine as _};
use pqcrypto_kyber::kyber768::{PublicKey, SecretKey};
use fs2::FileExt;
use zeroize::Zeroize;
use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use rand::rngs::OsRng;
use rand::RngCore;
use keyring::Entry;

/// A stored KEM keypair entry with timestamp.
#[derive(Serialize, Deserialize, Clone)]
struct Entry {
    id: DateTime<Utc>,
    #[serde(with = "serde_bytes_base64")]
    sk: Vec<u8>,
    #[serde(with = "serde_bytes_base64")]
    pk: Vec<u8>,
}

/// Helpers to (de)serialize byte vectors as base64 strings.
mod serde_bytes_base64 {
    use serde::{Serializer, Deserializer, Deserialize};
    use serde::de::Error as DeError;
    use base64::{engine::general_purpose, Engine as _};

    pub fn serialize<S>(bytes: &Vec<u8>, serializer: S) -> Result<S::Ok, S::Error>
    where S: Serializer {
        let b64 = general_purpose::STANDARD.encode(bytes);
        serializer.serialize_str(&b64)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
    where D: Deserializer<'de> {
        let s = String::deserialize(deserializer)?;
        general_purpose::STANDARD.decode(&s).map_err(DeError::custom)
    }
}

/// File format for persisted key entries.
#[derive(Serialize, Deserialize, Clone)]
struct KeyFile {
    version: u32,
    #[serde(default)]
    nonce_counter: u64,
    entries: Vec<Entry>,
}

/// Persistent keystore with rotation policy for Kyber768.
pub struct Keystore {
    path: PathBuf,
    entries: Vec<Entry>,
    retention_count: usize,
    rotation_interval: Duration,
    master_key: Vec<u8>,
    nonce_counter: u64,
}

impl Keystore {
    /// Load existing keystore or initialize a new one. Keystore file is AES‑GCM encrypted.
    pub fn load_or_init(config: &sc_service::Configuration) -> Result<Self, Box<dyn Error>> {
        // Base directory for keystore files
        let base = config.database.path.clone();
        let dir = base.join("pqc_keystore");
        fs::create_dir_all(&dir)?;

        // Obtain or create master key via OS keystore (system credential store)
        let entry = Entry::new("pqc-keystore", "master-key");
        let master_key = match entry.get_password() {
            Ok(pass) => general_purpose::STANDARD.decode(&pass)
                .map_err(|e| format!("Invalid base64 master key from OS keystore: {}", e))?,
            Err(_) => {
                let mut buf = [0u8; 32];
                OsRng.fill_bytes(&mut buf);
                let b64 = general_purpose::STANDARD.encode(&buf);
                entry.set_password(&b64)
                    .map_err(|e| format!("Failed to store master key in OS keystore: {}", e))?;
                buf.to_vec()
            }
        };

        // Initialize AES-GCM cipher
        let cipher = Aes256Gcm::new_from_slice(&master_key)
            .map_err(|e| format!("AES init error: {}", e))?;

        // Lock the encrypted keystore file
        let file_path = dir.join("keys.json.enc");
        let lock_path = dir.join("keys.json.enc.lock");
        let lock = OpenOptions::new().read(true).write(true).create(true).open(&lock_path)?;
        lock.lock_exclusive()?;

        // Load or start fresh KeyFile
        let kf = if file_path.exists() {
            let mut buf = Vec::new();
            File::open(&file_path)?.read_to_end(&mut buf)?;
            if buf.len() < 12 {
                let bad = dir.join("keys.json.enc.corrupt");
                fs::rename(&file_path, &bad)?;
                KeyFile { version: 1, entries: Vec::new() }
            } else {
                let (nonce, ct) = buf.split_at(12);
                match cipher.decrypt(Nonce::from_slice(nonce), ct) {
                    Ok(plain) => {
                        let mut data: KeyFile = serde_json::from_slice(&plain)?;
                        data.entries.retain(|e| SecretKey::from_bytes(&e.sk).is_ok()
                            && PublicKey::from_bytes(&e.pk).is_ok());
                        if data.entries.is_empty() {
                            let bad = dir.join("keys.json.enc.corrupt");
                            fs::rename(&file_path, &bad)?;
                            KeyFile { version: 1, entries: Vec::new() }
                        } else {
                            data
                        }
                    }
                    Err(_) => {
                        let bad = dir.join("keys.json.enc.corrupt");
                        fs::rename(&file_path, &bad)?;
                        KeyFile { version: 1, entries: Vec::new() }
                    }
                }
            }
        } else {
            KeyFile { version: 1, entries: Vec::new() }
        };

        // Generate initial key if needed
        let mut kf = kf;
        if kf.entries.is_empty() {
            let (pk, sk) = pqcrypto_kyber::kyber768::keypair();
            kf.entries.push(Entry {
                id: Utc::now(),
                sk: sk.as_bytes().to_vec(),
                pk: pk.as_bytes().to_vec(),
            });
            // Persist encrypted keystore with deterministic nonce
            kf.nonce_counter = kf.nonce_counter.wrapping_add(1);
            let mut nonce = [0u8; 12];
            nonce[4..].copy_from_slice(&kf.nonce_counter.to_be_bytes());
            let json = serde_json::to_vec_pretty(&kf)?;
            let ct = cipher.encrypt(Nonce::from_slice(&nonce), &json)
                .map_err(|e| format!("Encrypt error: {}", e))?;
            let mut out = Vec::with_capacity(12 + ct.len());
            out.extend_from_slice(&nonce);
            out.extend_from_slice(&ct);
            let tmp = dir.join("keys.json.enc.tmp");
            let mut f = File::create(&tmp)?;
            f.write_all(&out)?;
            f.flush()?;
            f.sync_all()?;
            fs::rename(&tmp, &file_path)?;
            File::open(&dir)?.sync_all()?;
        }

        Ok(Keystore {
            path: file_path,
            entries: kf.entries.clone(),
            retention_count: 3,
            rotation_interval: Duration::from_secs(24 * 3600),
            master_key,
            nonce_counter: kf.nonce_counter,
        })
    }

    /// Return the current (public, secret) keypair.
    pub fn current_keypair(&self) -> (PublicKey, SecretKey) {
        let e = self.entries.last().expect("keystore is non-empty");
        let pk = PublicKey::from_bytes(&e.pk).expect("invalid public key bytes");
        let sk = SecretKey::from_bytes(&e.sk).expect("invalid secret key bytes");
        (pk, sk)
    }

    /// Rotate keys if rotation interval has passed. Returns Some((public, secret)).
    pub fn maybe_rotate(&mut self) -> Result<Option<(PublicKey, SecretKey)>, Box<dyn Error>> {
        let last = self.entries.last().unwrap();
        let now = Utc::now();
        if now.signed_duration_since(last.id).to_std()? >= self.rotation_interval {
            // Generate and append new keypair
            let (new_pk, new_sk) = pqcrypto_kyber::kyber768::keypair();
            self.entries.push(Entry {
                id: now,
                sk: new_sk.as_bytes().to_vec(),
                pk: new_pk.as_bytes().to_vec(),
            });
            // Enforce retention and zeroize removed secret
            if self.entries.len() > self.retention_count {
                let old = self.entries.remove(0);
                old.sk.zeroize();
            }
            // Persist updated encrypted keystore with deterministic nonce
            let mut kf = KeyFile { version: 1, nonce_counter: self.nonce_counter, entries: self.entries.clone() };
            kf.nonce_counter = kf.nonce_counter.wrapping_add(1);
            let mut nonce = [0u8; 12];
            nonce[4..].copy_from_slice(&kf.nonce_counter.to_be_bytes());
            let json = serde_json::to_vec_pretty(&kf)?;
            let cipher = Aes256Gcm::new_from_slice(&self.master_key)
                .map_err(|e| format!("AES init error: {}", e))?;
            let ct = cipher.encrypt(Nonce::from_slice(&nonce), &json)
                .map_err(|e| format!("Encrypt error: {}", e))?;
            let mut out = Vec::with_capacity(12 + ct.len());
            out.extend_from_slice(&nonce);
            out.extend_from_slice(&ct);
            let tmp = self.path.parent().unwrap().join("keys.json.enc.tmp");
            let mut f = File::create(&tmp)?;
            f.write_all(&out)?;
            f.flush()?;
            f.sync_all()?;
            fs::rename(&tmp, &self.path)?;
            File::open(self.path.parent().unwrap())?.sync_all()?;
            // Update in-memory nonce counter
            self.nonce_counter = kf.nonce_counter;
            Ok(Some((new_pk, new_sk)))
        } else {
            Ok(None)
        }
    }
}