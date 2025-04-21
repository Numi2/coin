// Secure key storage implementation using browser's IndexedDB with encryption

import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import { encrypt, decrypt } from "@/lib/crypto-utils"

interface KeyPair {
  publicKey: string
  encryptedPrivateKey: string // Private key encrypted with password
}

interface WalletDB extends DBSchema {
  keypairs: {
    key: string // Public key as the index
    value: KeyPair
  }
  metadata: {
    key: string
    value: {
      name: string
      lastAccessed: Date
      createdAt: Date
    }
  }
}

class SecureKeyStorage {
  private db: IDBPDatabase<WalletDB> | null = null
  private initialized = false

  async initialize(): Promise<boolean> {
    if (this.initialized) return true

    try {
      this.db = await openDB<WalletDB>("quantum-wallet", 1, {
        upgrade(db) {
          // Create stores
          if (!db.objectStoreNames.contains("keypairs")) {
            db.createObjectStore("keypairs")
          }
          if (!db.objectStoreNames.contains("metadata")) {
            db.createObjectStore("metadata")
          }
        },
      })

      this.initialized = true
      return true
    } catch (error) {
      console.error("Failed to initialize secure storage:", error)
      return false
    }
  }

  async storeKeyPair(publicKey: string, privateKey: string, password: string): Promise<boolean> {
    if (!this.db || !this.initialized) {
      await this.initialize()
    }

    try {
      // Encrypt the private key with the password
      const encryptedPrivateKey = await encrypt(privateKey, password)

      // Store the key pair
      await this.db!.put(
        "keypairs",
        {
          publicKey,
          encryptedPrivateKey,
        },
        publicKey,
      )

      // Store metadata
      await this.db!.put(
        "metadata",
        {
          name: `Wallet ${publicKey.substring(0, 8)}...`,
          lastAccessed: new Date(),
          createdAt: new Date(),
        },
        publicKey,
      )

      return true
    } catch (error) {
      console.error("Failed to store key pair:", error)
      return false
    }
  }

  async getPrivateKey(publicKey: string, password: string): Promise<string | null> {
    if (!this.db || !this.initialized) {
      await this.initialize()
    }

    try {
      // Get the encrypted private key
      const keyPair = await this.db!.get("keypairs", publicKey)

      if (!keyPair) {
        return null
      }

      // Update last accessed time
      const metadata = await this.db!.get("metadata", publicKey)
      if (metadata) {
        metadata.lastAccessed = new Date()
        await this.db!.put("metadata", metadata, publicKey)
      }

      // Decrypt the private key
      return await decrypt(keyPair.encryptedPrivateKey, password)
    } catch (error) {
      console.error("Failed to get private key:", error)
      return null
    }
  }

  async getAllPublicKeys(): Promise<{ publicKey: string; name: string; lastAccessed: Date }[]> {
    if (!this.db || !this.initialized) {
      await this.initialize()
    }

    try {
      const keys = await this.db!.getAllKeys("keypairs")
      const result = []

      for (const key of keys) {
        const metadata = await this.db!.get("metadata", key)
        if (metadata) {
          result.push({
            publicKey: key,
            name: metadata.name,
            lastAccessed: metadata.lastAccessed,
          })
        }
      }

      return result
    } catch (error) {
      console.error("Failed to get all public keys:", error)
      return []
    }
  }

  async deleteKeyPair(publicKey: string): Promise<boolean> {
    if (!this.db || !this.initialized) {
      await this.initialize()
    }

    try {
      await this.db!.delete("keypairs", publicKey)
      await this.db!.delete("metadata", publicKey)
      return true
    } catch (error) {
      console.error("Failed to delete key pair:", error)
      return false
    }
  }

  async updateKeyPairName(publicKey: string, name: string): Promise<boolean> {
    if (!this.db || !this.initialized) {
      await this.initialize()
    }

    try {
      const metadata = await this.db!.get("metadata", publicKey)
      if (metadata) {
        metadata.name = name
        await this.db!.put("metadata", metadata, publicKey)
        return true
      }
      return false
    } catch (error) {
      console.error("Failed to update key pair name:", error)
      return false
    }
  }

  // Export wallet (encrypted with password)
  async exportWallet(publicKey: string, password: string): Promise<string | null> {
    try {
      const privateKey = await this.getPrivateKey(publicKey, password)
      if (!privateKey) return null

      const exportData = {
        publicKey,
        privateKey,
        exportTime: new Date().toISOString(),
      }

      // Encrypt the entire export data
      return await encrypt(JSON.stringify(exportData), password)
    } catch (error) {
      console.error("Failed to export wallet:", error)
      return null
    }
  }

  // Import wallet from encrypted export
  async importWallet(encryptedData: string, password: string): Promise<string | null> {
    try {
      // Decrypt the export data
      const decryptedData = await decrypt(encryptedData, password)
      const importData = JSON.parse(decryptedData)

      // Store the imported key pair
      const success = await this.storeKeyPair(importData.publicKey, importData.privateKey, password)

      return success ? importData.publicKey : null
    } catch (error) {
      console.error("Failed to import wallet:", error)
      return null
    }
  }
}

// Singleton instance
export const keyStorage = new SecureKeyStorage()
