import { invoke } from "@tauri-apps/api/core";
import type {
  CommitInfo, BranchInfo, FileStatus, FileDiff,
  RemoteInfo, StashInfo, TagInfo, RepoSummary, BranchAheadBehind
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

export async function gitPull(repoPath: string, remote?: string): Promise<string> {
  return invoke("git_pull", { repoPath, remote });
}

export async function discardFile(repoPath: string, filePath: string): Promise<void> {
  return invoke("discard_file", { repoPath, filePath });
}

export async function mergeBranch(repoPath: string, branchName: string): Promise<string> {
  return invoke("merge_branch", { repoPath, branchName });
}

export async function renameBranch(repoPath: string, oldName: string, newName: string): Promise<void> {
  return invoke("rename_branch", { repoPath, oldName, newName });
}

export async function amendCommit(repoPath: string, message: string): Promise<string> {
  return invoke("amend_commit", { repoPath, message });
}

export async function stashDrop(repoPath: string, index: number): Promise<void> {
  return invoke("stash_drop", { repoPath, index });
}

export async function cherryPick(repoPath: string, commitOid: string): Promise<void> {
  return invoke("cherry_pick", { repoPath, commitOid });
}

export async function revertCommit(repoPath: string, commitOid: string): Promise<void> {
  return invoke("revert_commit", { repoPath, commitOid });
}

export async function resetToCommit(repoPath: string, commitOid: string, mode: "soft" | "mixed" | "hard"): Promise<void> {
  return invoke("reset_to_commit", { repoPath, commitOid, mode });
}

export async function checkoutCommit(repoPath: string, commitOid: string): Promise<void> {
  return invoke("checkout_commit", { repoPath, commitOid });
}

export async function createTag(repoPath: string, name: string, commitOid: string, message?: string): Promise<void> {
  return invoke("create_tag", { repoPath, name, commitOid, message: message ?? null });
}

export async function deleteTag(repoPath: string, name: string): Promise<void> {
  return invoke("delete_tag", { repoPath, name });
}

export async function getFileHistory(repoPath: string, filePath: string, limit?: number): Promise<CommitInfo[]> {
  return invoke("get_file_history", { repoPath, filePath, limit });
}

export async function addRemote(repoPath: string, name: string, url: string): Promise<void> {
  return invoke("add_remote", { repoPath, name, url });
}

export async function removeRemote(repoPath: string, name: string): Promise<void> {
  return invoke("remove_remote", { repoPath, name });
}

export async function fetchAll(repoPath: string): Promise<void> {
  return invoke("fetch_all", { repoPath });
}

export async function openInExplorer(path: string): Promise<void> {
  return invoke("open_in_explorer", { path });
}

export async function rebaseBranch(repoPath: string, ontoBranch: string): Promise<void> {
  return invoke("rebase_branch", { repoPath, ontoBranch });
}

export async function checkoutRemoteBranch(repoPath: string, remoteBranch: string): Promise<void> {
  return invoke("checkout_remote_branch", { repoPath, remoteBranch });
}

export async function stashApply(repoPath: string, index: number): Promise<void> {
  return invoke("stash_apply", { repoPath, index });
}

export async function pushUpstream(repoPath: string, remote: string, branch: string, username?: string, token?: string): Promise<string> {
  return invoke("push_upstream", { repoPath, remote, branch, username, token });
}

export async function forcePush(repoPath: string, remote: string, branch: string, username?: string, token?: string): Promise<string> {
  return invoke("force_push", { repoPath, remote, branch, username, token });
}

export async function openTerminal(path: string): Promise<void> {
  return invoke("open_terminal", { path });
}

export async function discardAll(repoPath: string): Promise<void> {
  return invoke("discard_all", { repoPath });
}

export async function pushTag(repoPath: string, tagName: string, remote = "origin"): Promise<void> {
  return invoke("push_tag", { repoPath, tagName, remote });
}

export async function pushAllTags(repoPath: string, remote = "origin"): Promise<void> {
  return invoke("push_all_tags", { repoPath, remote });
}

export async function deleteRemoteBranch(repoPath: string, remote: string, branch: string): Promise<void> {
  return invoke("delete_remote_branch", { repoPath, remote, branch });
}

export async function squashMerge(repoPath: string, branchName: string): Promise<string> {
  return invoke("squash_merge", { repoPath, branchName });
}

export async function getBranchesAheadBehind(repoPath: string): Promise<BranchAheadBehind[]> {
  return invoke("get_branches_ahead_behind", { repoPath });
}

export async function getHeadBehind(repoPath: string): Promise<number> {
  return invoke("get_head_behind", { repoPath });
}
