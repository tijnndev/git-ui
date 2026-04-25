export interface CommitInfo {
  oid: string;
  short_oid: string;
  message: string;
  author_name: string;
  author_email: string;
  timestamp: number;
  parents: string[];
}

export interface BranchInfo {
  name: string;
  is_head: boolean;
  is_remote: boolean;
  upstream: string | null;
  tip_oid: string;
}

export interface FileStatus {
  path: string;
  status: string;
  staged: boolean;
}

export interface DiffLine {
  origin: string;
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface FileDiff {
  path: string;
  hunks: DiffHunk[];
}

export interface RemoteInfo {
  name: string;
  url: string;
}

export interface StashInfo {
  index: number;
  message: string;
  oid: string;
}

export interface TagInfo {
  name: string;
  oid: string;
  message: string | null;
}

export interface RepoSummary {
  path: string;
  head_branch: string | null;
  head_oid: string | null;
  is_bare: boolean;
}

export interface RecentRepo {
  path: string;
  name: string;
  lastOpened: number;
  pinned: boolean;
  categoryId?: string | null;
}

export interface RepoCategory {
  id: string;
  name: string;
  color: string;
  /** id of a GitHubAccount from Settings > GitHub Accounts, or null */
  accountId: string | null;
}
