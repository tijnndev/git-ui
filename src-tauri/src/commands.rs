use tauri::command;
use crate::models::*;
use crate::git_ops;

#[command]
pub fn get_repo_summary(repo_path: String) -> Result<RepoSummary, String> {
    git_ops::get_repo_summary(&repo_path)
}

#[command]
pub fn get_commits(repo_path: String, branch: Option<String>, limit: Option<usize>) -> Result<Vec<CommitInfo>, String> {
    git_ops::get_commits(&repo_path, branch, limit.unwrap_or(500))
}

#[command]
pub fn get_all_commits(repo_path: String, limit: Option<usize>) -> Result<Vec<CommitInfo>, String> {
    git_ops::get_all_commits(&repo_path, limit.unwrap_or(500))
}

#[command]
pub fn get_branches(repo_path: String) -> Result<Vec<BranchInfo>, String> {
    git_ops::get_branches(&repo_path)
}

#[command]
pub fn get_status(repo_path: String) -> Result<Vec<FileStatus>, String> {
    git_ops::get_status(&repo_path)
}

#[command]
pub fn get_diff(repo_path: String, commit_oid: Option<String>, staged: Option<bool>) -> Result<Vec<FileDiff>, String> {
    git_ops::get_diff(&repo_path, commit_oid, staged.unwrap_or(false))
}

#[command]
pub fn stage_file(repo_path: String, file_path: String) -> Result<(), String> {
    git_ops::stage_file(&repo_path, &file_path)
}

#[command]
pub fn unstage_file(repo_path: String, file_path: String) -> Result<(), String> {
    git_ops::unstage_file(&repo_path, &file_path)
}

#[command]
pub fn stage_all(repo_path: String) -> Result<(), String> {
    git_ops::stage_all(&repo_path)
}

#[command]
pub fn commit(repo_path: String, message: String) -> Result<String, String> {
    git_ops::commit(&repo_path, &message)
}

#[command]
pub fn create_branch(repo_path: String, name: String, from_oid: Option<String>) -> Result<(), String> {
    git_ops::create_branch(&repo_path, &name, from_oid)
}

#[command]
pub fn checkout_branch(repo_path: String, branch_name: String) -> Result<(), String> {
    git_ops::checkout_branch(&repo_path, &branch_name)
}

#[command]
pub fn delete_branch(repo_path: String, branch_name: String) -> Result<(), String> {
    git_ops::delete_branch(&repo_path, &branch_name)
}

#[command]
pub fn get_remotes(repo_path: String) -> Result<Vec<RemoteInfo>, String> {
    git_ops::get_remotes(&repo_path)
}

#[command]
pub fn fetch(repo_path: String, remote_name: String) -> Result<(), String> {
    git_ops::fetch(&repo_path, &remote_name)
}

#[command]
pub fn get_tags(repo_path: String) -> Result<Vec<TagInfo>, String> {
    git_ops::get_tags(&repo_path)
}

#[command]
pub fn get_stashes(repo_path: String) -> Result<Vec<StashInfo>, String> {
    git_ops::get_stashes(&repo_path)
}

#[command]
pub fn stash_save(repo_path: String, message: String) -> Result<(), String> {
    git_ops::stash_save(&repo_path, &message)
}

#[command]
pub fn stash_pop(repo_path: String) -> Result<(), String> {
    git_ops::stash_pop(&repo_path)
}

#[command]
pub fn get_commit_files(repo_path: String, commit_oid: String) -> Result<Vec<FileStatus>, String> {
    git_ops::get_commit_files(&repo_path, &commit_oid)
}

#[command]
pub fn init_repo(repo_path: String) -> Result<(), String> {
    git_ops::init_repo(&repo_path)
}

#[command]
pub fn clone_repo(url: String, dest: String) -> Result<(), String> {
    git_ops::clone_repo(&url, &dest)
}
