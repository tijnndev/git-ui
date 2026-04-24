import { invoke } from "@tauri-apps/api/core";
import type {
  CommitInfo, BranchInfo, FileStatus, FileDiff,
  RemoteInfo, StashInfo, TagInfo, RepoSummary
} from "./types";

export async function getRepoSummary(repoPath: string): Promise<RepoSummary> {
  return invoke("get_repo_summary", { repoPath });
}

export async function gitPush(
  repoPath: string,
  remote?: string,
  branch?: string,
): Promise<string> {
  return invoke("git_push", { repoPath, remote, branch });
}

export async function getRemoteUrl(repoPath: string, remote: string): Promise<string> {
  return invoke("get_remote_url", { repoPath, remote });
}

export async function getCommits(repoPath: string, branch?: string, limit?: number): Promise<CommitInfo[]> {
  return invoke("get_commits", { repoPath, branch, limit });
}

export async function getAllCommits(repoPath: string, limit?: number): Promise<CommitInfo[]> {
  return invoke("get_all_commits", { repoPath, limit });
}

export async function getBranches(repoPath: string): Promise<BranchInfo[]> {
  return invoke("get_branches", { repoPath });
}

export async function getStatus(repoPath: string): Promise<FileStatus[]> {
  return invoke("get_status", { repoPath });
}

export async function getDiff(repoPath: string, commitOid?: string, staged?: boolean): Promise<FileDiff[]> {
  return invoke("get_diff", { repoPath, commitOid, staged });
}

export async function stageFile(repoPath: string, filePath: string): Promise<void> {
  return invoke("stage_file", { repoPath, filePath });
}

export async function unstageFile(repoPath: string, filePath: string): Promise<void> {
  return invoke("unstage_file", { repoPath, filePath });
}

export async function stageAll(repoPath: string): Promise<void> {
  return invoke("stage_all", { repoPath });
}

export async function commitChanges(repoPath: string, message: string): Promise<string> {
  return invoke("commit", { repoPath, message });
}

export async function createBranch(repoPath: string, name: string, fromOid?: string): Promise<void> {
  return invoke("create_branch", { repoPath, name, fromOid });
}

export async function checkoutBranch(repoPath: string, branchName: string): Promise<void> {
  return invoke("checkout_branch", { repoPath, branchName });
}

export async function deleteBranch(repoPath: string, branchName: string): Promise<void> {
  return invoke("delete_branch", { repoPath, branchName });
}

export async function getRemotes(repoPath: string): Promise<RemoteInfo[]> {
  return invoke("get_remotes", { repoPath });
}

export async function fetchRemote(repoPath: string, remoteName: string): Promise<void> {
  return invoke("fetch", { repoPath, remoteName });
}

export async function getTags(repoPath: string): Promise<TagInfo[]> {
  return invoke("get_tags", { repoPath });
}

export async function getStashes(repoPath: string): Promise<StashInfo[]> {
  return invoke("get_stashes", { repoPath });
}

export async function stashSave(repoPath: string, message: string): Promise<void> {
  return invoke("stash_save", { repoPath, message });
}

export async function stashPop(repoPath: string): Promise<void> {
  return invoke("stash_pop", { repoPath });
}

export async function getCommitFiles(repoPath: string, commitOid: string): Promise<FileStatus[]> {
  return invoke("get_commit_files", { repoPath, commitOid });
}

export async function initRepo(repoPath: string): Promise<void> {
  return invoke("init_repo", { repoPath });
}

export async function cloneRepo(url: string, dest: string): Promise<void> {
  return invoke("clone_repo", { url, dest });
}
