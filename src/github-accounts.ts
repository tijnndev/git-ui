// GitHub account (Personal Access Token) storage.
// Stored separately from AppSettings under a dedicated localStorage key.
// Tokens are stored in plain text in localStorage — acceptable for a local desktop app.

export interface GitHubAccount {
  id: string;        // random uuid
  label: string;     // user-facing alias, e.g. "work" or "personal"
  username: string;  // GitHub username
  token: string;     // Personal Access Token (classic or fine-grained)
}

const STORAGE_KEY = "git_ui_github_accounts";

export function loadAccounts(): GitHubAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GitHubAccount[]) : [];
  } catch {
    return [];
  }
}

export function saveAccounts(accounts: GitHubAccount[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

/** Inject credentials into a GitHub HTTPS remote URL.
 *  e.g. https://github.com/foo/bar.git  →  https://username:token@github.com/foo/bar.git */
export function injectToken(remoteUrl: string, account: GitHubAccount): string {
  try {
    const u = new URL(remoteUrl);
    if (!u.hostname.endsWith("github.com")) return remoteUrl;
    u.username = encodeURIComponent(account.username);
    u.password = encodeURIComponent(account.token);
    return u.toString();
  } catch {
    return remoteUrl;
  }
}

/** Find the best matching account for a remote URL.
 *  Prefers an account whose username appears in the URL path; falls back to first. */
export function findAccountForUrl(
  remoteUrl: string,
  accounts: GitHubAccount[],
): GitHubAccount | null {
  if (accounts.length === 0) return null;
  try {
    const u = new URL(remoteUrl);
    if (!u.hostname.endsWith("github.com")) return null;
    const path = u.pathname.toLowerCase();
    const match = accounts.find((a) => path.startsWith(`/${a.username.toLowerCase()}/`));
    return match ?? accounts[0];
  } catch {
    return accounts[0];
  }
}
