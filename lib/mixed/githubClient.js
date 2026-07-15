/**
 * lib/mixed/githubClient.js
 *
 * Minimal GitHub REST client for the Mixed map repo sync. Uses node-fetch
 * (already a project dependency) rather than adding @octokit/rest.
 *
 * The auth token, if present, is never logged — errors are sanitised before
 * being thrown/logged so an Authorization header can't leak into logs.
 */

import fetch from "node-fetch";

export class GithubFetchError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "GithubFetchError";
    this.status = status;
  }
}

function sanitiseErr(err) {
  if (!err) return err;
  const message = String(err.message || err).replace(/token [A-Za-z0-9_-]+/gi, "token [redacted]");
  return message;
}

export function createGithubClient({ org, token }) {
  if (!org) throw new Error("createGithubClient requires an org");

  const authHeaders = token
    ? { Authorization: `token ${token}`, Accept: "application/vnd.github+json" }
    : { Accept: "application/vnd.github+json" };

  async function apiGet(path) {
    const res = await fetch(`https://api.github.com${path}`, { headers: authHeaders });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new GithubFetchError(`GitHub API ${path} failed: ${sanitiseErr(new Error(`${res.status} ${res.statusText}`))}`, { status: res.status });
    }
    return res.json();
  }

  /** Recursive tree listing for a repo/branch. Returns null if repo/branch missing. */
  async function getTree(repo, branch) {
    const data = await apiGet(`/repos/${org}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    if (!data) return null;
    return Array.isArray(data.tree) ? data.tree : [];
  }

  /** Raw file content fetch. Returns null on 404 (used for existence checks too). */
  async function getFileRaw(repo, branch, path) {
    const url = `https://raw.githubusercontent.com/${org}/${repo}/${branch}/${path}`;
    const res = await fetch(url, token ? { headers: { Authorization: `token ${token}` } } : undefined);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new GithubFetchError(`GitHub raw fetch ${path} failed: ${sanitiseErr(new Error(`${res.status} ${res.statusText}`))}`, { status: res.status });
    }
    return res.text();
  }

  /** Returns { sha, committedAt } for the latest commit on a branch. */
  async function getLatestCommitSha(repo, branch) {
    const data = await apiGet(`/repos/${org}/${repo}/commits/${encodeURIComponent(branch)}`);
    if (!data) return null;
    return {
      sha: data.sha || null,
      committedAt: data.commit?.committer?.date || data.commit?.author?.date || null,
    };
  }

  function buildRawUrl(repo, branch, path) {
    return `https://raw.githubusercontent.com/${org}/${repo}/${branch}/${path}`;
  }

  return { getTree, getFileRaw, getLatestCommitSha, buildRawUrl };
}
