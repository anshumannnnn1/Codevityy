import type { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createRemoteJWKSet, jwtVerify } from 'jose';

interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
}

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
export const firebaseConfig: FirebaseAppletConfig = JSON.parse(
  fs.readFileSync(configPath, 'utf-8')
);

const JWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  )
);

export interface AuthenticatedUser {
  uid: string;
  email: string;
  name: string;
  idToken: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<AuthenticatedUser> {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${firebaseConfig.projectId}`,
    audience: firebaseConfig.projectId,
  });

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Token missing subject (uid)');
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : '',
    name: typeof payload.name === 'string' ? payload.name : '',
    idToken,
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Authentication required. Please sign in to access this endpoint.',
    });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({
      error: 'Missing bearer token.',
    });
    return;
  }

  try {
    req.user = await verifyFirebaseIdToken(token);
    next();
  } catch (err) {
    console.error('Firebase ID token verification failed:', err instanceof Error ? err.message : err);
    res.status(401).json({
      error: 'Invalid or expired authentication session. Please sign in again.',
    });
  }
}
