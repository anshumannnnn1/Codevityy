import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { AnalysisReport, GitHubConnectionState, UserProfile } from '../types/codevity';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Firestore connection on initial boot
async function testFirestoreConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testFirestoreConnection();

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return new Date().toISOString();
}

export async function ensureUserProfileDoc(params: {
  uid: string;
  name: string;
  email: string;
}): Promise<UserProfile> {
  const path = `users/${params.uid}`;
  const docRef = doc(db, 'users', params.uid);
  const safeName = (params.name || 'Developer').trim().slice(0, 100);
  const safeEmail = (params.email || 'unknown@example.com').trim().slice(0, 254);

  try {
    const existing = await getDoc(docRef);
    if (existing.exists()) {
      const data = existing.data();
      return {
        userId: data.userId,
        name: data.name,
        email: data.email,
        createdAt: timestampToIso(data.createdAt),
        updatedAt: timestampToIso(data.updatedAt),
      };
    }

    await setDoc(docRef, {
      userId: params.uid,
      name: safeName,
      email: safeEmail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const nowIso = new Date().toISOString();
    return {
      userId: params.uid,
      name: safeName,
      email: safeEmail,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfileDoc(params: {
  uid: string;
  name: string;
  email: string;
}): Promise<void> {
  const path = `users/${params.uid}`;
  const safeName = params.name.trim().slice(0, 100);
  const safeEmail = params.email.trim().slice(0, 254);
  try {
    await updateDoc(doc(db, 'users', params.uid), {
      name: safeName,
      email: safeEmail,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncGitHubConnectionDoc(
  uid: string,
  state: GitHubConnectionState
): Promise<void> {
  const path = `githubConnections/${uid}`;
  try {
    const docRef = doc(db, 'githubConnections', uid);
    const payload = {
      userId: uid,
      githubUsername: (state.githubUsername || '').slice(0, 100),
      avatarUrl: (state.avatarUrl || '').slice(0, 500),
      tokenRef: (state.tokenRef || '').slice(0, 128),
      connectionStatus: state.connected ? 'connected' : 'disconnected',
      scopes: (state.scopes || '').slice(0, 200),
      ...(state.connected ? { connectedAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    };

    const existing = await getDoc(docRef);
    if (existing.exists()) {
      await updateDoc(docRef, {
        githubUsername: payload.githubUsername,
        avatarUrl: payload.avatarUrl,
        tokenRef: payload.tokenRef,
        connectionStatus: payload.connectionStatus,
        scopes: payload.scopes,
        ...(state.connected ? { connectedAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserReportsClient(uid: string): Promise<AnalysisReport[]> {
  const path = 'analysisReports';
  try {
    const q = query(collection(db, path), where('userId', '==', uid));
    const snap = await getDocs(q);
    const list: AnalysisReport[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        repositoryName: data.repositoryName,
        repositoryOwner: data.repositoryOwner,
        repositoryUrl: data.repositoryUrl,
        isPrivate: Boolean(data.isPrivate),
        analysisPeriodDays: Number(data.analysisPeriodDays) || 90,
        analysisDate: timestampToIso(data.analysisDate),
        productivityScore: Number(data.productivityScore) || 0,
        consistencyScore: Number(data.consistencyScore) || 0,
        metricScores: data.metricScores,
        analyticsSummary: data.analyticsSummary,
        aiInsights: data.aiInsights,
        createdAt: timestampToIso(data.createdAt),
      };
    });

    list.sort(
      (a, b) =>
        new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime()
    );
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchReportByIdClient(
  reportId: string
): Promise<AnalysisReport | null> {
  const path = `analysisReports/${reportId}`;
  try {
    const snap = await getDoc(doc(db, 'analysisReports', reportId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      userId: data.userId,
      repositoryName: data.repositoryName,
      repositoryOwner: data.repositoryOwner,
      repositoryUrl: data.repositoryUrl,
      isPrivate: Boolean(data.isPrivate),
      analysisPeriodDays: Number(data.analysisPeriodDays) || 90,
      analysisDate: timestampToIso(data.analysisDate),
      productivityScore: Number(data.productivityScore) || 0,
      consistencyScore: Number(data.consistencyScore) || 0,
      metricScores: data.metricScores,
      analyticsSummary: data.analyticsSummary,
      aiInsights: data.aiInsights,
      createdAt: timestampToIso(data.createdAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveAnalysisReportClient(
  report: AnalysisReport
): Promise<string> {
  const path = 'analysisReports';
  try {
    const newDocRef = doc(collection(db, path));
    await setDoc(newDocRef, {
      userId: report.userId.slice(0, 128),
      repositoryName: report.repositoryName.slice(0, 200),
      repositoryOwner: report.repositoryOwner.slice(0, 100),
      repositoryUrl: report.repositoryUrl.slice(0, 500),
      isPrivate: Boolean(report.isPrivate),
      analysisPeriodDays: Math.min(365, Math.max(7, Number(report.analysisPeriodDays) || 90)),
      analysisDate: serverTimestamp(),
      productivityScore: Math.min(100, Math.max(0, Number(report.productivityScore) || 0)),
      consistencyScore: Math.min(100, Math.max(0, Number(report.consistencyScore) || 0)),
      metricScores: report.metricScores,
      analyticsSummary: report.analyticsSummary,
      aiInsights: report.aiInsights,
      createdAt: serverTimestamp(),
    });
    return newDocRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteReportClient(reportId: string): Promise<void> {
  const path = `analysisReports/${reportId}`;
  try {
    await deleteDoc(doc(db, 'analysisReports', reportId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
