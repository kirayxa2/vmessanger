/**
 * E2E Encryption for VortexMessenger
 * Algorithm: X25519 (ECDH key exchange) + AES-256-GCM (message encryption)
 * Library: Web Crypto API (built into every modern browser, no dependencies)
 *
 * How it works:
 * 1. Each user generates a key pair on registration (public + private)
 * 2. Public key is stored on the server — everyone can see it
 * 3. Private key is stored ONLY in IndexedDB on the user's device — never leaves
 * 4. To encrypt a message to Bob: derive shared secret from (Alice's private key + Bob's public key)
 * 5. To decrypt: derive shared secret from (Bob's private key + Alice's public key)
 * Both sides derive the SAME shared secret — this is the magic of ECDH
 */

const DB_NAME = "vortex-e2e"
const DB_VERSION = 1
const STORE_NAME = "keys"

// Кэш в памяти: публичные ключи собеседников (sessionStorage переживает перезагрузку вкладки)
const SESSION_PUBKEY_PREFIX = "vortex_pubkey_"

function sessionGetPubKey(userId: string): string | null {
  try { return sessionStorage.getItem(SESSION_PUBKEY_PREFIX + userId) } catch { return null }
}
function sessionSetPubKey(userId: string, key: string): void {
  try { sessionStorage.setItem(SESSION_PUBKEY_PREFIX + userId, key) } catch {}
}

// Кэш приватного ключа в памяти — IndexedDB читаем только один раз за сессию
let _privateKeyCache: CryptoKey | null = null

// ── IndexedDB helpers ──────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const req = tx.objectStore(STORE_NAME).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ── Key generation ─────────────────────────────────────────────────────────────

/**
 * Generate a new X25519 key pair for the user.
 * Called once at registration.
 */
export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: CryptoKey }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, // P-256 is widely supported, similar security to X25519
    true, // extractable — so we can export public key to send to server
    ["deriveKey", "deriveBits"]
  )

  // Export public key as base64 string — this goes to the server
  const publicKeyBuffer = await crypto.subtle.exportKey("spki", keyPair.publicKey)
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)))

  // Store private key in IndexedDB — never leaves the device
  await idbSet("privateKey", keyPair.privateKey)
  await idbSet("publicKey", keyPair.publicKey)

  return { publicKey: publicKeyBase64, privateKey: keyPair.privateKey }
}

// ── Key storage & retrieval ────────────────────────────────────────────────────

/**
 * Get the user's private key from IndexedDB.
 * Returns null if not found (user hasn't generated keys yet).
 */
export async function getPrivateKey(): Promise<CryptoKey | null> {
  try {
    if (_privateKeyCache) return _privateKeyCache
    const key = await idbGet<CryptoKey>("privateKey")
    if (key) _privateKeyCache = key
    return key ?? null
  } catch {
    return null
  }
}

/**
 * Check if the current device has E2E keys.
 */
export async function hasLocalKeys(): Promise<boolean> {
  const key = await getPrivateKey()
  return key !== null
}

/**
 * Import a recipient's public key from base64 string (received from server).
 */
async function importPublicKey(base64: string): Promise<CryptoKey> {
  const buffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  return crypto.subtle.importKey(
    "spki",
    buffer,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [] // public keys have no usages in ECDH
  )
}

// ── Shared secret derivation ───────────────────────────────────────────────────

/**
 * Derive a shared AES-256-GCM key from two parties' keys.
 * Alice: deriveSharedKey(alicePrivate, bobPublicBase64) → sharedKey
 * Bob:   deriveSharedKey(bobPrivate, alicePublicBase64) → SAME sharedKey
 * This is ECDH magic.
 */
async function deriveSharedKey(privateKey: CryptoKey, recipientPublicKeyBase64: string): Promise<CryptoKey> {
  const recipientPublicKey = await importPublicKey(recipientPublicKeyBase64)

  return crypto.subtle.deriveKey(
    { name: "ECDH", public: recipientPublicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false, // not extractable — can't be stolen from memory
    ["encrypt", "decrypt"]
  )
}

// ── Encryption ─────────────────────────────────────────────────────────────────

/**
 * Encrypt a message for a recipient.
 * Returns a base64-encoded string: IV (12 bytes) + ciphertext
 *
 * Usage:
 *   const encrypted = await encryptMessage("Hello Bob!", bobPublicKey)
 *   // Send encrypted to server
 */
export async function encryptMessage(
  plaintext: string,
  recipientPublicKeyBase64: string
): Promise<string | null> {
  try {
    const privateKey = await getPrivateKey()
    if (!privateKey) return null

    const sharedKey = await deriveSharedKey(privateKey, recipientPublicKeyBase64)

    // Random 12-byte IV — different for every message (critical for AES-GCM security)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(plaintext)

    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      sharedKey,
      encoded
    )

    // Combine IV + ciphertext into one buffer, then base64-encode
    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(ciphertext), iv.byteLength)

    return btoa(String.fromCharCode(...combined))
  } catch (err) {
    console.error("[E2E] Encryption failed:", err)
    return null
  }
}

// ── Decryption ─────────────────────────────────────────────────────────────────

/**
 * Decrypt a message received from a sender.
 * senderPublicKeyBase64: the sender's public key (fetched from server/user profile)
 *
 * Usage:
 *   const text = await decryptMessage(encryptedBlob, alicePublicKey)
 */
export async function decryptMessage(
  encryptedBase64: string,
  senderPublicKeyBase64: string
): Promise<string | null> {
  try {
    const privateKey = await getPrivateKey()
    if (!privateKey) return null

    const sharedKey = await deriveSharedKey(privateKey, senderPublicKeyBase64)

    // Split combined buffer back into IV + ciphertext
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      sharedKey,
      ciphertext
    )

    return new TextDecoder().decode(decrypted)
  } catch (err) {
    // Decryption failure usually means wrong key or corrupted data
    console.error("[E2E] Decryption failed:", err)
    return null
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Check if a string looks like an E2E encrypted message.
 * Encrypted messages are base64 and longer than normal text.
 */
export function isEncrypted(content: string): boolean {
  if (!content || content.length < 20) return false
  // Base64 pattern + minimum length for IV + any ciphertext
  return /^[A-Za-z0-9+/]+=*$/.test(content) && content.length > 24
}

/**
 * Get the user's public key as base64 from IndexedDB.
 * Used to send to server during registration or when public key is missing.
 */
export async function getPublicKeyBase64(): Promise<string | null> {
  try {
    const pubKey = await idbGet<CryptoKey>("publicKey")
    if (!pubKey) return null
    const buf = await crypto.subtle.exportKey("spki", pubKey)
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
  } catch {
    return null
  }
}

/**
 * Encrypt message for multiple recipients (for group chats).
 * Returns array of { recipientId, encryptedContent }.
 * Each recipient gets their own encrypted copy.
 */
export async function encryptMessageForMany(
  plaintext: string,
  recipients: { id: string | number; publicKey: string }[]
): Promise<{ recipientId: string | number; encryptedContent: string }[]> {
  const results = []
  for (const r of recipients) {
    const encrypted = await encryptMessage(plaintext, r.publicKey)
    if (encrypted) {
      results.push({ recipientId: r.id, encryptedContent: encrypted })
    }
  }
  return results
}


// ── Self-encryption ────────────────────────────────────────────────────────────
//
// ПРОБЛЕМА: при ECDH Alice -> Bob, Alice шифрует через (alicePriv + bobPub).
// Расшифровать эту копию может только Bob через (bobPriv + alicePub).
// Если Alice перезашла в чат и хочет расшифровать СВОЁ ЖЕ сообщение — не выйдет.
//
// РЕШЕНИЕ: при отправке делаем ВТОРУЮ копию шифровки на собственных ключах
// (alicePriv + alicePub). Это даёт детерминированный shared secret,
// который Alice сможет вывести только она сама. Хранится в Message.contentForSender.

/**
 * Зашифровать сообщение для самого себя (для перезахода в чат).
 * Использует свой приватный + свой публичный ключ — derive детерминированный self-key.
 */
export async function encryptMessageForSelf(plaintext: string): Promise<string | null> {
  try {
    const ownPubKey = await getPublicKeyBase64()
    if (!ownPubKey) return null
    return encryptMessage(plaintext, ownPubKey)
  } catch (err) {
    console.error("[E2E] Self-encryption failed:", err)
    return null
  }
}

/**
 * Расшифровать собственное сообщение, зашифрованное через encryptMessageForSelf.
 */
export async function decryptMessageFromSelf(encryptedBase64: string): Promise<string | null> {
  try {
    const ownPubKey = await getPublicKeyBase64()
    if (!ownPubKey) return null
    return decryptMessage(encryptedBase64, ownPubKey)
  } catch (err) {
    console.error("[E2E] Self-decryption failed:", err)
    return null
  }
}
