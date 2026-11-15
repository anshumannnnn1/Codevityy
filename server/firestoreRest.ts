import axios from 'axios';
import crypto from 'node:crypto';
import { firebaseConfig } from './authMiddleware.ts';
import type { AnalysisReport } from '../src/types/codevity.ts';

type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

function toFirestoreValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: Number.isFinite(val) ? val : 0 };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => toFirestoreValue(item)),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreValue(val: FirestoreValue): unknown {
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('stringValue' in val) return val.stringValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map((v) => fromFirestoreValue(v));
  }
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return null;
}

function getBaseFirestoreUrl(): string {
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  return `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${dbId}`;
}

export async function saveAnalysisReportToFirestore(
  report: Omit<AnalysisReport, 'id' | 'analysisDate' | 'createdAt'>,
  idToken: string
): Promise<AnalysisReport> {
  const reportId = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  const baseUrl = getBaseFirestoreUrl();
  const docPath = `projects/${firebaseConfig.projectId}/databases/${
    firebaseConfig.firestoreDatabaseId || '(default)'
  }/documents/analysisReports/${reportId}`;

  const payload = {
    writes: [
      {
        update: {
          name: docPath,
          fields: {
            userId: toFirestoreValue(report.userId),
            repositoryName: toFirestoreValue(report.repositoryName),
            repositoryOwner: toFirestoreValue(report.repositoryOwner),
            repositoryUrl: toFirestoreValue(report.repositoryUrl),
            isPrivate: toFirestoreValue(report.isPrivate),
            analysisPeriodDays: toFirestoreValue(report.analysisPeriodDays),
            productivityScore: toFirestoreValue(report.productivityScore),
            consistencyScore: toFirestoreValue(report.consistencyScore),
            metricScores: toFirestoreValue(report.metricScores),
            analyticsSummary: toFirestoreValue(report.analyticsSummary),
            aiInsights: toFirestoreValue(report.aiInsights),
          },
        },
        currentDocument: { exists: false },
        updateTransforms: [
          { fieldPath: 'analysisDate', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
        ],
      },
    ],
  };

  await axios.post(`${baseUrl}/documents:commit`, payload, {
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  const nowIso = new Date().toISOString();
  return {
    ...report,
    id: reportId,
    analysisDate: nowIso,
    createdAt: nowIso,
  };
}

export async function listUserReportsFromFirestore(
  uid: string,
  idToken: string
): Promise<AnalysisReport[]> {
  const baseUrl = getBaseFirestoreUrl();
  const queryPayload = {
    structuredQuery: {
      from: [{ collectionId: 'analysisReports' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'userId' },
          op: 'EQUAL',
          value: { stringValue: uid },
        },
      },
      limit: 50,
    },
  };

  const response = await axios.post<
    Array<{
      document?: {
        name: string;
        fields?: Record<string, FirestoreValue>;
      };
    }>
  >(`${baseUrl}/documents:runQuery`, queryPayload, {
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

  const reports: AnalysisReport[] = [];
  for (const row of response.data) {
    if (!row.document?.fields) continue;
    const id = row.document.name.split('/').pop() || '';
    const obj = fromFirestoreValue({
      mapValue: { fields: row.document.fields },
    }) as Omit<AnalysisReport, 'id'>;
    reports.push({ ...obj, id });
  }

  reports.sort(
    (a, b) =>
      new Date(b.analysisDate || b.createdAt).getTime() -
      new Date(a.analysisDate || a.createdAt).getTime()
  );

  return reports;
}

export async function getReportByIdFromFirestore(
  reportId: string,
  idToken: string
): Promise<AnalysisReport | null> {
  const baseUrl = getBaseFirestoreUrl();
  try {
    const response = await axios.get<{
      name: string;
      fields?: Record<string, FirestoreValue>;
    }>(`${baseUrl}/documents/analysisReports/${encodeURIComponent(reportId)}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      timeout: 15000,
    });

    if (!response.data.fields) return null;
    const obj = fromFirestoreValue({
      mapValue: { fields: response.data.fields },
    }) as Omit<AnalysisReport, 'id'>;
    return { ...obj, id: reportId };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function deleteReportFromFirestore(
  reportId: string,
  idToken: string
): Promise<void> {
  const baseUrl = getBaseFirestoreUrl();
  await axios.delete(
    `${baseUrl}/documents/analysisReports/${encodeURIComponent(reportId)}`,
    {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      timeout: 15000,
    }
  );
}
