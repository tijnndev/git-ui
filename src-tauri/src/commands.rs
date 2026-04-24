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

#[command]
pub fn git_push(repo_path: String, remote: Option<String>, branch: Option<String>) -> Result<String, String> {
    use std::process::Command;

    let remote_name = remote.unwrap_or_else(|| "origin".to_string());
    let mut args = vec!["push", &remote_name];
    let branch_owned;
    if let Some(ref b) = branch {
        branch_owned = b.clone();
        args.push(&branch_owned);
    }

    let output = Command::new("git")
        .args(&args)
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{}{}", stdout, stderr).trim().to_string();

    if output.status.success() {
        Ok(if combined.is_empty() { "Push successful".to_string() } else { combined })
    } else {
        Err(if combined.is_empty() { "git push failed".to_string() } else { combined })
    }
}

#[command]
pub fn get_remote_url(repo_path: String, remote: String) -> Result<String, String> {
    use git2::Repository;
    let repo = Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let rem = repo.find_remote(&remote).map_err(|e| e.to_string())?;
    Ok(rem.url().unwrap_or("").to_string())
}
