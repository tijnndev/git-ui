use tauri::command;
use std::process::Command;
use crate::models::*;
use crate::git_ops;

fn git_cmd() -> Command {
    let mut cmd = Command::new("git");
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

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
    let remote_name = remote.unwrap_or_else(|| "origin".to_string());
    let mut args = vec!["push", &remote_name];
    let branch_owned;
    if let Some(ref b) = branch {
        branch_owned = b.clone();
        args.push(&branch_owned);
    }

    let output = git_cmd()
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

#[command]
pub fn git_pull(repo_path: String) -> Result<String, String> {
    git_ops::pull(&repo_path)
}

#[command]
pub fn discard_file(repo_path: String, file_path: String) -> Result<(), String> {
    git_ops::discard_file(&repo_path, &file_path)
}

#[command]
pub fn merge_branch(repo_path: String, branch_name: String) -> Result<String, String> {
    git_ops::merge_branch(&repo_path, &branch_name)
}

#[command]
pub fn rename_branch(repo_path: String, old_name: String, new_name: String) -> Result<(), String> {
    git_ops::rename_branch(&repo_path, &old_name, &new_name)
}

#[command]
pub fn amend_commit(repo_path: String, message: String) -> Result<String, String> {
    git_ops::amend_commit(&repo_path, &message)
}

#[command]
pub fn stash_drop(repo_path: String, index: usize) -> Result<(), String> {
    git_ops::stash_drop(&repo_path, index)
}

#[command]
pub fn cherry_pick(repo_path: String, commit_oid: String) -> Result<(), String> {
    git_ops::cherry_pick(&repo_path, &commit_oid)
}

#[command]
pub fn revert_commit(repo_path: String, commit_oid: String) -> Result<(), String> {
    git_ops::revert_commit(&repo_path, &commit_oid)
}

#[command]
pub fn reset_to_commit(repo_path: String, commit_oid: String, mode: String) -> Result<(), String> {
    git_ops::reset_to_commit(&repo_path, &commit_oid, &mode)
}

#[command]
pub fn checkout_commit(repo_path: String, commit_oid: String) -> Result<(), String> {
    git_ops::checkout_commit(&repo_path, &commit_oid)
}

#[command]
pub fn create_tag(repo_path: String, name: String, commit_oid: String, message: Option<String>) -> Result<(), String> {
    git_ops::create_tag(&repo_path, &name, &commit_oid, message.as_deref())
}

#[command]
pub fn delete_tag(repo_path: String, name: String) -> Result<(), String> {
    git_ops::delete_tag(&repo_path, &name)
}

#[command]
pub fn get_file_history(repo_path: String, file_path: String, limit: Option<usize>) -> Result<Vec<crate::models::CommitInfo>, String> {
    git_ops::get_file_history(&repo_path, &file_path, limit.unwrap_or(200))
}

#[command]
pub fn add_remote(repo_path: String, name: String, url: String) -> Result<(), String> {
    git_ops::add_remote(&repo_path, &name, &url)
}

#[command]
pub fn remove_remote(repo_path: String, name: String) -> Result<(), String> {
    git_ops::remove_remote(&repo_path, &name)
}

#[command]
pub fn fetch_all(repo_path: String) -> Result<(), String> {
    git_ops::fetch_all(&repo_path)
}

#[command]
pub fn open_in_explorer(path: String) -> Result<(), String> {
    git_ops::open_in_explorer(&path)
}

#[command]
pub fn open_terminal(path: String) -> Result<(), String> {
    git_ops::open_terminal(&path)
}

#[command]
pub fn discard_all(repo_path: String) -> Result<(), String> {
    git_ops::discard_all(&repo_path)
}

#[command]
pub fn push_tag(repo_path: String, tag_name: String, remote: String) -> Result<(), String> {
    git_ops::push_tag(&repo_path, &tag_name, &remote)
}

#[command]
pub fn push_all_tags(repo_path: String, remote: String) -> Result<(), String> {
    git_ops::push_all_tags(&repo_path, &remote)
}

#[command]
pub fn delete_remote_branch(repo_path: String, remote: String, branch: String) -> Result<(), String> {
    git_ops::delete_remote_branch(&repo_path, &remote, &branch)
}

#[command]
pub fn squash_merge(repo_path: String, branch_name: String) -> Result<String, String> {
    git_ops::squash_merge(&repo_path, &branch_name)
}

#[command]
pub fn get_branches_ahead_behind(repo_path: String) -> Result<Vec<crate::models::BranchAheadBehind>, String> {
    git_ops::get_branches_ahead_behind(&repo_path)
}

#[command]
pub fn get_head_behind(repo_path: String) -> Result<u32, String> {
    git_ops::get_head_behind(&repo_path)
}

#[command]
pub fn rebase_branch(repo_path: String, onto_branch: String) -> Result<(), String> {
    git_ops::rebase_branch(&repo_path, &onto_branch)
}

#[command]
pub fn checkout_remote_branch(repo_path: String, remote_branch: String) -> Result<(), String> {
    git_ops::checkout_remote_branch(&repo_path, &remote_branch)
}

#[command]
pub fn stash_apply(repo_path: String, index: usize) -> Result<(), String> {
    git_ops::stash_apply(&repo_path, index)
}

#[command]
pub fn push_upstream(repo_path: String, remote: String, branch: String) -> Result<String, String> {
    git_ops::push_upstream(&repo_path, &remote, &branch)
}

#[command]
pub fn force_push(repo_path: String, remote: String, branch: String) -> Result<String, String> {
    git_ops::force_push(&repo_path, &remote, &branch)
}
