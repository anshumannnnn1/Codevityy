import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import axios from 'axios';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  requireAuth,
  type AuthenticatedRequest,
} from './server/authMiddleware.ts';
import {
  consumeOAuthState,
  createOAuthState,
  getGitHubConnectionForUser,
  removeGitHubToken,
  saveGitHubToken,
} from './server/tokenVault.ts';
import {
  fetchDocumentationSignals,
  fetchRepositoryCommits,
  fetchRepositoryContributors,
  fetchRepositoryMetadata,
  fetchRepositoryPullsAndReviews,
  fetchUserRepositories,
  GitHubApiError,
  parseGitHubRepoUrl,
} from './server/githubService.ts';
import { calculateRepositoryAnalytics } from './server/analyticsEngine.ts';
import { generateGroqInsights } from './server/groqService.ts';
import {
  deleteReportFromFirestore,
  getReportByIdFromFirestore,
  listUserReportsFromFirestore,
  saveAnalysisReportToFirestore,
} from './server/firestoreRest.ts';

const PORT = Number(process.env.PORT) || 3000;

function getAppBaseUrl(req: express.Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    return envUrl.replace(/\/+$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`.replace(/\/+$/, '');
}

function isGitHubOAuthConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_CLIENT_ID?.trim() &&
      process.env.GITHUB_CLIENT_SECRET?.trim()
  );
}

function resolveRepoFromQuery(req: express.Request) {
  const urlParam = typeof req.query.url === 'string' ? req.query.url : '';
  const ownerParam = typeof req.query.owner === 'string' ? req.query.owner : '';
  const repoParam = typeof req.query.repo === 'string' ? req.query.repo : '';

  if (urlParam) {
    return parseGitHubRepoUrl(urlParam);
  }
  if (ownerParam && repoParam) {
    return parseGitHubRepoUrl(`${ownerParam}/${repoParam}`);
  }
  throw new GitHubApiError(
    'Provide either a "url" or both "owner" and "repo" query parameters.',
    400,
    'MISSING_REPO_PARAMS'
  );
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // ---------------------------------------------------------------------------
  // 1. Health check
  // ---------------------------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Codevity API',
      timestamp: new Date().toISOString(),
      githubOAuthConfigured: isGitHubOAuthConfigured(),
      groqConfigured: Boolean(process.env.GROQ_API_KEY?.trim()),
    });
  });

  // ---------------------------------------------------------------------------
  // 2. GitHub OAuth & Connection Status (Server-side token vault)
  // ---------------------------------------------------------------------------
  app.get('/api/github/status', requireAuth, (req: AuthenticatedRequest, res) => {
    const uid = req.user!.uid;
    const baseUrl = getAppBaseUrl(req);
    const conn = getGitHubConnectionForUser(uid);

    res.json({
      configured: isGitHubOAuthConfigured(),
      connected: conn.connected,
      githubUsername: conn.githubUsername,
      avatarUrl: conn.avatarUrl,
      scopes: conn.scopes,
      tokenRef: conn.tokenRef,
      callbackUrl: `${baseUrl}/auth/github/callback`,
    });
  });

  app.get('/api/github/auth-url', requireAuth, (req: AuthenticatedRequest, res) => {
    const baseUrl = getAppBaseUrl(req);
    const callbackUrl = `${baseUrl}/auth/github/callback`;

    if (!isGitHubOAuthConfigured()) {
      res.status(400).json({
        configured: false,
        callbackUrl,
        error:
          'GitHub OAuth credentials (GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET) are not configured on the server.',
      });
      return;
    }

    const rawOrigin = typeof req.query.origin === 'string' ? req.query.origin.trim().replace(/\/+$/, '') : '';
    let originParam = baseUrl;
    if (rawOrigin) {
      try {
        const parsedOrigin = new URL(rawOrigin);
        const host = parsedOrigin.hostname.toLowerCase();
        const isAllowedOrigin =
          rawOrigin === baseUrl ||
          host === 'localhost' ||
          host === '127.0.0.1' ||
          host.endsWith('.run.app');
        if (isAllowedOrigin && (parsedOrigin.protocol === 'https:' || parsedOrigin.protocol === 'http:')) {
          originParam = parsedOrigin.origin;
        }
      } catch {
        // Fallback to server baseUrl if malformed origin provided
      }
    }
    const redirectUri = `${originParam}/auth/github/callback`;
    const state = createOAuthState(req.user!.uid, redirectUri);

    res.cookie('codevity_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!.trim(),
      redirect_uri: redirectUri,
      scope: 'read:user repo',
      state,
      allow_signup: 'true',
    });

    res.json({
      configured: true,
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
      callbackUrl: redirectUri,
    });
  });

  app.post('/api/github/disconnect', requireAuth, (req: AuthenticatedRequest, res) => {
    removeGitHubToken(req.user!.uid);
    res.json({ connected: false, message: 'GitHub account disconnected.' });
  });

  const handleGitHubCallback = async (req: express.Request, res: express.Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';

    if (oauthError) {
      res.status(400).send(`
        <html><body style="font-family: sans-serif; padding: 24px;">
          <h3>GitHub Connection Cancelled</h3>
          <p>${oauthError.replace(/[<>&"]/g, '')}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GITHUB_OAUTH_ERROR', error: 'GitHub authorization was denied or cancelled.' }, '*');
              window.close();
            }
          </script>
        </body></html>
      `);
      return;
    }

    if (!code || !state) {
      res.status(400).send('Missing OAuth code or state parameter.');
      return;
    }

    const pending = consumeOAuthState(state);
    if (!pending) {
      res.status(400).send('Invalid or expired OAuth state parameter. Please try connecting again.');
      return;
    }

    if (!isGitHubOAuthConfigured()) {
      res.status(500).send('GitHub OAuth credentials are not configured on the server.');
      return;
    }

    try {
      const tokenRes = await axios.post<{
        access_token?: string;
        scope?: string;
        error?: string;
        error_description?: string;
      }>(
        'https://github.com/login/oauth/access_token',
        {
          client_id: process.env.GITHUB_CLIENT_ID!.trim(),
          client_secret: process.env.GITHUB_CLIENT_SECRET!.trim(),
          code,
          redirect_uri: pending.redirectUri,
          state,
        },
        {
          headers: {
            Accept: 'application/json',
          },
          timeout: 15000,
        }
      );

      const accessToken = tokenRes.data.access_token;
      if (!accessToken) {
        throw new Error(
          tokenRes.data.error_description || tokenRes.data.error || 'Failed to exchange code for GitHub token.'
        );
      }

      const userRes = await axios.get<{
        login: string;
        avatar_url: string;
      }>('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Codevity-Developer-Productivity-Analyser',
        },
        timeout: 15000,
      });

      const scopes = tokenRes.data.scope || 'read:user,repo';
      const saved = saveGitHubToken({
        uid: pending.uid,
        accessToken,
        githubUsername: userRes.data.login,
        avatarUrl: userRes.data.avatar_url || '',
        scopes,
      });

      res.clearCookie('codevity_oauth_state', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      });

      const safePayload = JSON.stringify({
        type: 'GITHUB_OAUTH_SUCCESS',
        githubUsername: userRes.data.login,
        avatarUrl: userRes.data.avatar_url || '',
        scopes,
        tokenRef: saved.tokenRef,
      });

      res.send(`
        <!doctype html>
        <html>
          <head><title>GitHub Connected</title></head>
          <body style="font-family: system-ui, sans-serif; padding: 32px; color: #0f172a;">
            <p>GitHub account <strong>@${userRes.data.login.replace(/[<>&"]/g, '')}</strong> connected. Returning to Codevity...</p>
            <script>
              if (window.opener) {
                window.opener.postMessage(${safePayload}, '*');
                window.close();
              } else {
                window.location.href = '/dashboard';
              }
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'GitHub OAuth failed.';
      console.error('GitHub OAuth callback error:', msg);
      res.status(500).send(`
        <html><body style="font-family: sans-serif; padding: 24px;">
          <h3>GitHub Authentication Error</h3>
          <p>${msg.replace(/[<>&"]/g, '')}</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GITHUB_OAUTH_ERROR', error: ${JSON.stringify(msg)} }, '*');
            }
          </script>
        </body></html>
      `);
    }
  };

  app.get(['/auth/github/callback', '/auth/github/callback/'], handleGitHubCallback);

  // ---------------------------------------------------------------------------
  // 3. GitHub Data API Endpoints
  // ---------------------------------------------------------------------------
  app.get('/api/github/repositories', requireAuth, async (req: AuthenticatedRequest, res) => {
    const conn = getGitHubConnectionForUser(req.user!.uid);
    if (!conn.connected || !conn.accessToken) {
      res.status(400).json({
        error: 'GitHub account is not connected. Connect GitHub OAuth to browse your repositories.',
      });
      return;
    }

    try {
      const repositories = await fetchUserRepositories(conn.accessToken);
      res.json({ repositories });
    } catch (err) {
      if (err instanceof GitHubApiError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: 'Failed to fetch GitHub repositories.' });
    }
  });

  app.get('/api/github/repository', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = resolveRepoFromQuery(req);
      const conn = getGitHubConnectionForUser(req.user!.uid);
      const repository = await fetchRepositoryMetadata(
        parsed.owner,
        parsed.repo,
        conn.accessToken
      );
      res.json({ repository });
    } catch (err) {
      if (err instanceof GitHubApiError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: 'Failed to fetch repository metadata.' });
    }
  });

  app.get('/api/github/commits', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = resolveRepoFromQuery(req);
      const days = Math.min(365, Math.max(7, Number(req.query.days) || 90));
      const conn = getGitHubConnectionForUser(req.user!.uid);
      const commits = await fetchRepositoryCommits(
        parsed.owner,
        parsed.repo,
        days,
        conn.accessToken
      );
      res.json({ commits, periodDays: days });
    } catch (err) {
      if (err instanceof GitHubApiError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: 'Failed to fetch repository commits.' });
    }
  });

  app.get('/api/github/contributors', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = resolveRepoFromQuery(req);
      const conn = getGitHubConnectionForUser(req.user!.uid);
      const contributors = await fetchRepositoryContributors(
        parsed.owner,
        parsed.repo,
        conn.accessToken
      );
      res.json({ contributors });
    } catch (err) {
      if (err instanceof GitHubApiError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: 'Failed to fetch repository contributors.' });
    }
  });

  app.get('/api/github/pulls', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = resolveRepoFromQuery(req);
      const conn = getGitHubConnectionForUser(req.user!.uid);
      const result = await fetchRepositoryPullsAndReviews(
        parsed.owner,
        parsed.repo,
        conn.accessToken
      );
      res.json(result);
    } catch (err) {
      if (err instanceof GitHubApiError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ error: 'Failed to fetch pull requests.' });
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Repository Analysis & Scoring + Groq AI Insights + Firestore Save
  // ---------------------------------------------------------------------------
  app.post('/api/analyze', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { repositoryUrl, periodDays: rawPeriod, saveReport } = req.body as {
      repositoryUrl?: unknown;
      periodDays?: unknown;
      saveReport?: unknown;
    };

    if (typeof repositoryUrl !== 'string' || !repositoryUrl.trim()) {
      res.status(400).json({ error: 'Repository URL is required.' });
      return;
    }

    const periodDays = Math.min(365, Math.max(7, Number(rawPeriod) || 90));
    const shouldSave = saveReport !== false;
    const uid = req.user!.uid;

    try {
      const parsed = parseGitHubRepoUrl(repositoryUrl);
      const conn = getGitHubConnectionForUser(uid);

      const meta = await fetchRepositoryMetadata(
        parsed.owner,
        parsed.repo,
        conn.accessToken
      );

      if (meta.isPrivate && !conn.connected) {
        res.status(403).json({
          error:
            'Private repositories require an authorized GitHub OAuth connection. Please connect your GitHub account first.',
        });
        return;
      }

      const [commits, contributors, pullsData, docs] = await Promise.all([
        fetchRepositoryCommits(parsed.owner, parsed.repo, periodDays, conn.accessToken),
        fetchRepositoryContributors(parsed.owner, parsed.repo, conn.accessToken),
        fetchRepositoryPullsAndReviews(parsed.owner, parsed.repo, conn.accessToken),
        fetchDocumentationSignals(
          parsed.owner,
          parsed.repo,
          meta.hasLicense,
          conn.accessToken
        ),
      ]);

      const {
        productivityScore,
        consistencyScore,
        metricScores,
        analyticsSummary,
      } = calculateRepositoryAnalytics({
        periodDays,
        defaultBranch: meta.defaultBranch,
        primaryLanguage: meta.language,
        stars: meta.stargazersCount,
        forks: meta.forksCount,
        commits,
        contributors,
        pulls: pullsData.pulls,
        sampledForReviews: pullsData.sampledForReviews,
        docs,
      });

      const aiInsights = await generateGroqInsights({
        repositoryName: meta.fullName,
        analysisPeriodDays: periodDays,
        productivityScore,
        consistencyScore,
        metricScores,
        analyticsSummary,
      });

      const reportPayload = {
        userId: uid,
        repositoryName: meta.fullName,
        repositoryOwner: meta.owner,
        repositoryUrl: meta.htmlUrl,
        isPrivate: meta.isPrivate,
        analysisPeriodDays: periodDays,
        productivityScore,
        consistencyScore,
        metricScores,
        analyticsSummary,
        aiInsights,
      };

      if (shouldSave) {
        try {
          const savedReport = await saveAnalysisReportToFirestore(
            reportPayload,
            req.user!.idToken
          );
          res.status(201).json({ report: savedReport, persisted: true });
          return;
        } catch (firestoreErr) {
          console.error(
            'Firestore save via REST failed, returning unsaved report:',
            firestoreErr instanceof Error ? firestoreErr.message : firestoreErr
          );
          const nowIso = new Date().toISOString();
          res.status(200).json({
            report: {
              ...reportPayload,
              analysisDate: nowIso,
              createdAt: nowIso,
            },
            persisted: false,
            persistenceWarning:
              'Analysis completed, but automatic server-side Firestore persistence failed.',
          });
          return;
        }
      }

      const nowIso = new Date().toISOString();
      res.status(200).json({
        report: {
          ...reportPayload,
          analysisDate: nowIso,
          createdAt: nowIso,
        },
        persisted: false,
      });
    } catch (err) {
      if (err instanceof GitHubApiError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      console.error('Repository analysis error:', err);
      res.status(500).json({
        error: 'An unexpected error occurred while analyzing the repository.',
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Reports Endpoints (Backed by Cloud Firestore with Rule Enforcement)
  // ---------------------------------------------------------------------------
  app.get('/api/reports', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const reports = await listUserReportsFromFirestore(
        req.user!.uid,
        req.user!.idToken
      );
      res.json({ reports });
    } catch (err) {
      console.error(
        'GET /api/reports error:',
        err instanceof Error ? err.message : err
      );
      res.status(500).json({ error: 'Failed to retrieve saved analysis reports.' });
    }
  });

  app.get('/api/reports/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    const reportId = req.params.id;
    if (!reportId || !/^[a-zA-Z0-9_-]{1,128}$/.test(reportId)) {
      res.status(400).json({ error: 'Invalid report ID format.' });
      return;
    }

    try {
      const report = await getReportByIdFromFirestore(reportId, req.user!.idToken);
      if (!report) {
        res.status(404).json({ error: 'Analysis report not found.' });
        return;
      }
      if (report.userId !== req.user!.uid) {
        res.status(403).json({ error: 'You do not have permission to view this report.' });
        return;
      }
      res.json({ report });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        res.status(403).json({ error: 'Access denied to this report.' });
        return;
      }
      console.error('GET /api/reports/:id error:', err);
      res.status(500).json({ error: 'Failed to retrieve analysis report.' });
    }
  });

  app.delete('/api/reports/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    const reportId = req.params.id;
    if (!reportId || !/^[a-zA-Z0-9_-]{1,128}$/.test(reportId)) {
      res.status(400).json({ error: 'Invalid report ID format.' });
      return;
    }

    try {
      await deleteReportFromFirestore(reportId, req.user!.idToken);
      res.json({ deleted: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        res.status(403).json({ error: 'Access denied.' });
        return;
      }
      res.status(500).json({ error: 'Failed to delete analysis report.' });
    }
  });

  // ---------------------------------------------------------------------------
  // 6. Vite Dev Middleware / Production Static Assets
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Codevity server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Codevity server:', err);
  process.exit(1);
});
