import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

interface StoredTokenRecord {
  uid: string;
  tokenRef: string;
  githubUsername: string;
  avatarUrl: string;
  scopes: string;
  iv: string;
  authTag: string;
  encryptedToken: string;
  connectedAt: string;
}

interface PendingOAuthState {
  uid: string;
  redirectUri: string;
  expiresAt: number;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const VAULT_FILE = path.join(DATA_DIR, 'github-vault.enc.json');
const KEY_FILE = path.join(DATA_DIR, '.vault-key');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

function getEncryptionKey(): Buffer {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest();
  }
  ensureDataDir();
  if (fs.existsSync(KEY_FILE)) {
    const hex = fs.readFileSync(KEY_FILE, 'utf-8').trim();
    if (hex.length === 64) {
      return Buffer.from(hex, 'hex');
    }
  }
  const generated = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, generated.toString('hex'), { mode: 0o600 });
  return generated;
}

function loadVault(): Record<string, StoredTokenRecord> {
  ensureDataDir();
  if (!fs.existsSync(VAULT_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(VAULT_FILE, 'utf-8');
    return JSON.parse(raw) as Record<string, StoredTokenRecord>;
  } catch {
    return {};
  }
}

function saveVault(vault: Record<string, StoredTokenRecord>): void {
  ensureDataDir();
  fs.writeFileSync(VAULT_FILE, JSON.stringify(vault, null, 2), { mode: 0o600 });
}

export function saveGitHubToken(params: {
  uid: string;
  accessToken: string;
  githubUsername: string;
  avatarUrl: string;
  scopes: string;
}): { tokenRef: string; connectedAt: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(params.accessToken, 'utf-8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const tokenRef = `ghv_${crypto.randomUUID()}`;
  const connectedAt = new Date().toISOString();

  const vault = loadVault();
  vault[params.uid] = {
    uid: params.uid,
    tokenRef,
    githubUsername: params.githubUsername,
    avatarUrl: params.avatarUrl,
    scopes: params.scopes,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    encryptedToken: encrypted.toString('hex'),
    connectedAt,
  };
  saveVault(vault);

  return { tokenRef, connectedAt };
}

export function getGitHubConnectionForUser(uid: string): {
  connected: boolean;
  githubUsername: string;
  avatarUrl: string;
  scopes: string;
  tokenRef: string;
  accessToken: string | null;
} {
  const vault = loadVault();
  const record = vault[uid];
  if (!record) {
    return {
      connected: false,
      githubUsername: '',
      avatarUrl: '',
      scopes: '',
      tokenRef: '',
      accessToken: null,
    };
  }

  try {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(record.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(record.authTag, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(record.encryptedToken, 'hex')),
      decipher.final(),
    ]).toString('utf-8');

    return {
      connected: true,
      githubUsername: record.githubUsername,
      avatarUrl: record.avatarUrl,
      scopes: record.scopes,
      tokenRef: record.tokenRef,
      accessToken: decrypted,
    };
  } catch (err) {
    console.error('Failed to decrypt GitHub token for user:', uid, err);
    return {
      connected: false,
      githubUsername: '',
      avatarUrl: '',
      scopes: '',
      tokenRef: '',
      accessToken: null,
    };
  }
}

export function removeGitHubToken(uid: string): void {
  const vault = loadVault();
  if (vault[uid]) {
    delete vault[uid];
    saveVault(vault);
  }
}

// Short-lived CSRF state store for GitHub OAuth (10 minute TTL)
const pendingStates = new Map<string, PendingOAuthState>();

export function createOAuthState(uid: string, redirectUri: string): string {
  const now = Date.now();
  for (const [k, v] of pendingStates.entries()) {
    if (v.expiresAt < now) {
      pendingStates.delete(k);
    }
  }
  const state = crypto.randomBytes(24).toString('hex');
  pendingStates.set(state, {
    uid,
    redirectUri,
    expiresAt: now + 10 * 60 * 1000,
  });
  return state;
}

export function consumeOAuthState(state: string): PendingOAuthState | null {
  const entry = pendingStates.get(state);
  if (!entry) {
    return null;
  }
  pendingStates.delete(state);
  if (entry.expiresAt < Date.now()) {
    return null;
  }
  return entry;
}
