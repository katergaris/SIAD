
import { EncryptedKeyConfig } from '../types';

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16; // bytes
const IV_LENGTH = 12; // bytes for AES-GCM

// Helper to convert ArrayBuffer to Base64 string
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Helper to convert Base64 string to ArrayBuffer
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
};

// Derive a key from a password using PBKDF2
export const deriveKeyFromPassword = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
};

// Encrypt data using AES-GCM
export const encryptData = async (data: string, key: CryptoKey): Promise<{ iv: Uint8Array, encryptedData: ArrayBuffer }> => {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    enc.encode(data)
  );
  return { iv, encryptedData };
};

// Decrypt data using AES-GCM
export const decryptData = async (encryptedData: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<string> => {
  const dec = new TextDecoder();
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encryptedData
  );
  return dec.decode(decrypted);
};

// Encrypts a user-defined key (for non-admin CSVs) using the admin's password
export const createUserEncryptionKeyConfig = async (userPasswordToSet: string, adminPasswordForKeyEncryption: string): Promise<EncryptedKeyConfig> => {
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const adminDerivedKey = await deriveKeyFromPassword(adminPasswordForKeyEncryption, salt);
  
  // The "data" we are encrypting here is the userPasswordToSet itself
  const { iv, encryptedData } = await encryptData(userPasswordToSet, adminDerivedKey);

  return {
    iv: arrayBufferToBase64(iv),
    encryptedKeyData: arrayBufferToBase64(encryptedData), // This is the encrypted user's password
    salt: arrayBufferToBase64(salt) // Salt used with admin password
  };
};

// Decrypts the user encryption key config to get the raw user password, then derives the actual user CryptoKey
export const getUserKeyFromConfig = async (config: EncryptedKeyConfig, adminPasswordForKeyDecryption: string): Promise<CryptoKey | null> => {
  try {
    const salt = new Uint8Array(base64ToArrayBuffer(config.salt));
    const iv = new Uint8Array(base64ToArrayBuffer(config.iv));
    const encryptedKeyMaterial = base64ToArrayBuffer(config.encryptedKeyData);

    const adminDerivedKey = await deriveKeyFromPassword(adminPasswordForKeyDecryption, salt);
    const decryptedUserPasswordString = await decryptData(encryptedKeyMaterial, adminDerivedKey, iv);

    // Now derive the actual user key from this decrypted password string
    // For the user key itself, we need a new salt or a fixed one. For simplicity here,
    // we'll use a fixed salt, but ideally, this should also be configurable or derived.
    // Let's use a fixed salt for the user key derivation for now.
    const userKeySalt = new TextEncoder().encode("a-fixed-salt-for-user-key"); // NOT IDEAL for production
    const userKey = await deriveKeyFromPassword(decryptedUserPasswordString, userKeySalt);
    return userKey;

  } catch (error) {
    console.error("Failed to decrypt or derive user key from config:", error);
    return null;
  }
};

// Encrypt text content that will be saved to a CSV (for non-admin users)
export const encryptTextForCSV = async (plainText: string, userKey: CryptoKey): Promise<string> => {
    const { iv, encryptedData } = await encryptData(plainText, userKey);
    // Combine IV and encrypted data, base64 encode for CSV storage
    // Format: base64(iv):base64(encryptedData)
    return `${arrayBufferToBase64(iv)}:${arrayBufferToBase64(encryptedData)}`;
};

// Decrypt text content read from a CSV (for non-admin users)
export const decryptTextFromCSV = async (encryptedCsvText: string, userKey: CryptoKey): Promise<string> => {
    const parts = encryptedCsvText.split(':');
    if (parts.length !== 2) {
        throw new Error("Invalid encrypted CSV content format.");
    }
    const iv = new Uint8Array(base64ToArrayBuffer(parts[0]));
    const encryptedData = base64ToArrayBuffer(parts[1]);
    return decryptData(encryptedData, userKey, iv);
};
