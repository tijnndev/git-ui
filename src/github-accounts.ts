// GitHub account (Personal Access Token) storage.
// Stored via tauri-plugin-store (same backing file as settings) so that accounts
// persist across both dev and production builds. Previously used localStorage,
// which is scoped to the webview origin and therefore did NOT survive switching
// between `tauri dev` (http://localhost:…) and the production app (tauri://localhost).

import { storeGet, storeSet } from "./store";

export interface GitHubAccount {
  id: string;        // random uuid
  label: string;     // user-facing alias, e.g. "work" or "personal"
  username: string;  // GitHub username
  token: string;     // Personal Access Token (classic or fine-grained)
}

const STORE_KEY = "github_accounts";
const LEGACY_LS_KEY = "git_ui_github_accounts";

export async function loadAccounts(): Promise<GitHubAccount[]> {
  // Try tauri-plugin-store first
  const stored = await storeGet<GitHubAccount[]>(STORE_KEY);
  if (stored && stored.length > 0) return stored;

  // One-time migration from localStorage (only present on the current origin)
  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    if (raw) {
      const migrated = JSON.parse(raw) as GitHubAccount[];
      if (migrated.length > 0) {
        await storeSet(STORE_KEY, migrated);
        localStorage.removeItem(LEGACY_LS_KEY);
        return migrated;
      }
    }
  } catch {
    // ignore
  }

  return [];
}

export async function saveAccounts(accounts: GitHubAccount[]): Promise<void> {
  await storeSet(STORE_KEY, accounts);
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
