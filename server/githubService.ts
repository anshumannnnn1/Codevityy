import axios, { AxiosError } from 'axios';
import type { GitHubRepoSummary } from '../src/types/codevity.ts';

export class GitHubApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = 'GITHUB_API_ERROR') {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.code = code;
  }
}

export interface ParsedRepoRef {
  owner: string;
  repo: string;
  canonicalUrl: string;
}

export function parseGitHubRepoUrl(input: string): ParsedRepoRef {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new GitHubApiError('Please enter a GitHub repository URL.', 400, 'INVALID_URL');
  }

  let owner = '';
  let repo = '';

  // Accept shorthand owner/repo as well as full https://github.com/owner/repo URLs
  const slugMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?\/?$/);
  if (slugMatch && !trimmed.includes('://')) {
    owner = slugMatch[1];
    repo = slugMatch[2];
  } else {
    let parsed: URL;
    try {
      parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    } catch {
      throw new GitHubApiError(
        'Invalid repository URL format. Use https://github.com/owner/repository.',
        400,
        'INVALID_URL'
      );
    }

    if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') {
      throw new GitHubApiError(
        'Only GitHub repositories (github.com/owner/repository) are supported.',
        400,
        'INVALID_HOST'
      );
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
      throw new GitHubApiError(
        'Repository URL must include both owner and repository name (e.g. https://github.com/facebook/react).',
        400,
        'INVALID_URL'
      );
    }

    owner = parts[0];
    repo = parts[1].replace(/\.git$/i, '');
  }

  const validSegment = /^[a-zA-Z0-9_.-]+$/;
  if (!validSegment.test(owner) || !validSegment.test(repo) || owner === '.' || owner === '..' || repo === '.' || repo === '..') {
    throw new GitHubApiError('Invalid GitHub owner or repository name.', 400, 'INVALID_URL');
  }

  return {
    owner,
    repo,
    canonicalUrl: `https://github.com/${owner}/${repo}`,
  };
}

async function githubGet<T>(
  apiPath: string,
  token?: string | null,
  params?: Record<string, string | number>
): Promise<{ data: T; status: number }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Codevity-Developer-Productivity-Analyser',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await axios.get<T>(`https://api.github.com${apiPath}`, {
      headers,
      params,
      timeout: 15000,
    });
    return { data: response.data, status: response.status };
  } catch (err) {
    const axiosErr = err as AxiosError<{ message?: string }>;
    const status = axiosErr.response?.status ?? 500;
    const ghMessage = axiosErr.response?.data?.message || axiosErr.message;

    if (status === 401) {
      throw new GitHubApiError(
        'GitHub access token is invalid or expired. Please reconnect your GitHub account.',
        401,
        'GITHUB_UNAUTHORIZED'
      );
    }
    if (status === 403) {
      const remaining = axiosErr.response?.headers?.['x-ratelimit-remaining'];
      const resetEpoch = axiosErr.response?.headers?.['x-ratelimit-reset'];
      if (remaining === '0') {
        const resetTime = resetEpoch
          ? new Date(Number(resetEpoch) * 1000).toLocaleTimeString()
          : 'shortly';
        throw new GitHubApiError(
          token
            ? `GitHub API rate limit exceeded. Limit resets at ${resetTime}.`
            : `GitHub unauthenticated API rate limit reached (60 requests/hour). Connect your GitHub account for a 5,000 requests/hour quota (resets at ${resetTime}).`,
          429,
          'GITHUB_RATE_LIMIT'
        );
      }
      throw new GitHubApiError(
        `GitHub access forbidden: ${ghMessage}`,
        403,
        'GITHUB_FORBIDDEN'
      );
    }
    if (status === 404) {
      throw new GitHubApiError(
        token
          ? 'Repository not found or your GitHub account lacks permission to access it.'
          : 'Repository not found. If this is a private repository, connect your GitHub account first.',
        404,
        'REPO_NOT_FOUND'
      );
    }
    if (status === 409) {
      // GitHub returns 409 when a repository is completely empty (no commits)
      throw new GitHubApiError('Repository is empty (no commits yet).', 409, 'EMPTY_REPO');
    }

    throw new GitHubApiError(
      `GitHub API request failed (${status}): ${ghMessage}`,
      status >= 400 && status < 600 ? status : 502,
      'GITHUB_API_ERROR'
    );
  }
}

export async function fetchUserRepositories(token: string): Promise<GitHubRepoSummary[]> {
  const { data } = await githubGet<Array<{
    id: number;
    name: string;
    full_name: string;
    owner: { login: string };
    description: string | null;
    html_url: string;
    private: boolean;
    default_branch: string;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    updated_at: string;
    pushed_at: string;
  }>>('/user/repos', token, {
    sort: 'updated',
    direction: 'desc',
    per_page: 50,
    affiliation: 'owner,collaborator,organization_member',
  });

  return data.map((r) => ({
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    owner: r.owner.login,
    description: r.description || '',
    htmlUrl: r.html_url,
    isPrivate: Boolean(r.private),
    defaultBranch: r.default_branch || 'main',
    language: r.language || 'Unknown',
    stargazersCount: r.stargazers_count || 0,
    forksCount: r.forks_count || 0,
    openIssuesCount: r.open_issues_count || 0,
    updatedAt: r.updated_at,
    pushedAt: r.pushed_at,
  }));
}

export async function fetchRepositoryMetadata(
  owner: string,
  repo: string,
  token?: string | null
) {
  const { data } = await githubGet<{
    id: number;
    name: string;
    full_name: string;
    owner: { login: string; avatar_url: string };
    description: string | null;
    html_url: string;
    private: boolean;
    default_branch: string;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    has_wiki: boolean;
    license: { name: string } | null;
    created_at: string;
    updated_at: string;
    pushed_at: string;
  }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token);

  return {
    id: data.id,
    name: data.name,
    fullName: data.full_name,
    owner: data.owner.login,
    ownerAvatarUrl: data.owner.avatar_url,
    description: data.description || '',
    htmlUrl: data.html_url,
    isPrivate: Boolean(data.private),
    defaultBranch: data.default_branch || 'main',
    language: data.language || 'Unknown',
    stargazersCount: data.stargazers_count || 0,
    forksCount: data.forks_count || 0,
    openIssuesCount: data.open_issues_count || 0,
    hasWiki: Boolean(data.has_wiki),
    hasLicense: Boolean(data.license),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    pushedAt: data.pushed_at,
  };
}

export interface RawCommitItem {
  sha: string;
  message: string;
  authorLogin: string;
  authorName: string;
  authorAvatarUrl: string;
  date: string;
}

export async function fetchRepositoryCommits(
  owner: string,
  repo: string,
  periodDays: number,
  token?: string | null
): Promise<RawCommitItem[]> {
  const sinceDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
  const commits: RawCommitItem[] = [];

  try {
    for (let page = 1; page <= 3; page++) {
      const { data } = await githubGet<Array<{
        sha: string;
        commit: {
          message: string;
          author: { name: string; date: string } | null;
        };
        author: { login: string; avatar_url: string } | null;
      }>>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits`, token, {
        since: sinceDate,
        per_page: 100,
        page,
      });

      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      for (const item of data) {
        commits.push({
          sha: item.sha,
          message: item.commit?.message || '',
          authorLogin: item.author?.login || item.commit?.author?.name || 'unknown',
          authorName: item.commit?.author?.name || item.author?.login || 'Unknown',
          authorAvatarUrl: item.author?.avatar_url || '',
          date: item.commit?.author?.date || new Date().toISOString(),
        });
      }

      if (data.length < 100) {
        break;
      }
    }
  } catch (err) {
    if (err instanceof GitHubApiError && err.code === 'EMPTY_REPO') {
      return [];
    }
    throw err;
  }

  return commits;
}

export interface RawContributorItem {
  login: string;
  avatarUrl: string;
  contributions: number;
}

export async function fetchRepositoryContributors(
  owner: string,
  repo: string,
  token?: string | null
): Promise<RawContributorItem[]> {
  try {
    const { data } = await githubGet<Array<{
      login: string;
      avatar_url: string;
      contributions: number;
    }>>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contributors`, token, {
      per_page: 100,
    });

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((c) => ({
      login: c.login,
      avatarUrl: c.avatar_url || '',
      contributions: c.contributions || 0,
    }));
  } catch (err) {
    if (err instanceof GitHubApiError && err.code === 'EMPTY_REPO') {
      return [];
    }
    throw err;
  }
}

export interface RawPullRequestItem {
  number: number;
  title: string;
  state: string;
  mergedAt: string | null;
  createdAt: string;
  updatedAt: string;
  userLogin: string;
  reviewCount: number;
}

export async function fetchRepositoryPullsAndReviews(
  owner: string,
  repo: string,
  token?: string | null
): Promise<{ pulls: RawPullRequestItem[]; sampledForReviews: number }> {
  const { data } = await githubGet<Array<{
    number: number;
    title: string;
    state: string;
    merged_at: string | null;
    created_at: string;
    updated_at: string;
    user: { login: string } | null;
  }>>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`, token, {
    state: 'all',
    sort: 'updated',
    direction: 'desc',
    per_page: 50,
  });

  if (!Array.isArray(data) || data.length === 0) {
    return { pulls: [], sampledForReviews: 0 };
  }

  // Sample up to 10 most recent PRs for actual review participation counts
  const sampleSize = Math.min(10, data.length);
  const reviewCounts = new Map<number, number>();

  await Promise.all(
    data.slice(0, sampleSize).map(async (pr) => {
      try {
        const { data: reviews } = await githubGet<Array<{ id: number }>>(
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pr.number}/reviews`,
          token,
          { per_page: 30 }
        );
        reviewCounts.set(pr.number, Array.isArray(reviews) ? reviews.length : 0);
      } catch {
        reviewCounts.set(pr.number, 0);
      }
    })
  );

  const pulls: RawPullRequestItem[] = data.map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    mergedAt: pr.merged_at,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    userLogin: pr.user?.login || 'unknown',
    reviewCount: reviewCounts.get(pr.number) ?? 0,
  }));

  return { pulls, sampledForReviews: sampleSize };
}

export interface DocumentationSignals {
  hasReadme: boolean;
  readmeLength: number;
  hasDocsFolder: boolean;
  hasContributing: boolean;
  hasLicense: boolean;
}

export async function fetchDocumentationSignals(
  owner: string,
  repo: string,
  hasLicenseFromMeta: boolean,
  token?: string | null
): Promise<DocumentationSignals> {
  let hasReadme = false;
  let readmeLength = 0;
  let hasDocsFolder = false;
  let hasContributing = false;
  let hasLicense = hasLicenseFromMeta;

  try {
    const { data: contents } = await githubGet<Array<{ name: string; type: string }>>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents`,
      token
    );
    if (Array.isArray(contents)) {
      for (const entry of contents) {
        const lower = entry.name.toLowerCase();
        if (lower.startsWith('readme')) {
          hasReadme = true;
        }
        if (entry.type === 'dir' && (lower === 'docs' || lower === 'doc' || lower === 'documentation')) {
          hasDocsFolder = true;
        }
        if (lower.startsWith('contributing')) {
          hasContributing = true;
        }
        if (lower.startsWith('license')) {
          hasLicense = true;
        }
      }
    }
  } catch {
    // Empty repo or inaccessible contents
  }

  if (hasReadme) {
    try {
      const { data: readmeData } = await githubGet<{ content?: string; size?: number }>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`,
        token
      );
      if (readmeData.content) {
        const decoded = Buffer.from(readmeData.content, 'base64').toString('utf-8');
        readmeLength = decoded.trim().length;
      } else if (typeof readmeData.size === 'number') {
        readmeLength = readmeData.size;
      }
    } catch {
      // README exists in listing or failed decode
    }
  }

  return {
    hasReadme,
    readmeLength,
    hasDocsFolder,
    hasContributing,
    hasLicense,
  };
}
