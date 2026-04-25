use git2::{Repository, BranchType, StatusOptions, Oid, Signature};
use std::path::Path;
use crate::models::*;

fn map_status(s: git2::Status) -> String {
    if s.contains(git2::Status::INDEX_NEW) { return "added".into(); }
    if s.contains(git2::Status::INDEX_MODIFIED) { return "modified".into(); }
    if s.contains(git2::Status::INDEX_DELETED) { return "deleted".into(); }
    if s.contains(git2::Status::INDEX_RENAMED) { return "renamed".into(); }
    if s.contains(git2::Status::WT_NEW) { return "untracked".into(); }
    if s.contains(git2::Status::WT_MODIFIED) { return "modified".into(); }
    if s.contains(git2::Status::WT_DELETED) { return "deleted".into(); }
    if s.contains(git2::Status::CONFLICTED) { return "conflicted".into(); }
    "unknown".into()
}

pub fn get_repo_summary(repo_path: &str) -> Result<RepoSummary, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let head_branch = repo.head().ok().and_then(|h| {
        if h.is_branch() {
            h.shorthand().map(|s| s.to_string())
        } else {
            h.peel_to_commit().ok().map(|c| format!("HEAD detached at {}", &c.id().to_string()[..7]))
        }
    });
    let head_oid = repo.head().ok()
        .and_then(|h| h.peel_to_commit().ok())
        .map(|c| c.id().to_string());

    Ok(RepoSummary {
        path: repo_path.to_string(),
        head_branch,
        head_oid,
        is_bare: repo.is_bare(),
    })
}

pub fn get_commits(repo_path: &str, branch: Option<String>, limit: usize) -> Result<Vec<CommitInfo>, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let mut revwalk = repo.revwalk().map_err(|e| e.message().to_string())?;
    revwalk.set_sorting(git2::Sort::TIME | git2::Sort::TOPOLOGICAL).map_err(|e| e.message().to_string())?;

    if let Some(branch_name) = branch {
        let reference = repo.find_reference(&format!("refs/heads/{}", branch_name))
            .or_else(|_| repo.find_reference(&format!("refs/remotes/{}", branch_name)))
            .map_err(|e| e.message().to_string())?;
        let oid = reference.peel_to_commit().map_err(|e| e.message().to_string())?.id();
        revwalk.push(oid).map_err(|e| e.message().to_string())?;
    } else {
        revwalk.push_head().map_err(|e| e.message().to_string())?;
    }

    let mut commits = Vec::new();
    for (i, oid_result) in revwalk.enumerate() {
        if i >= limit { break; }
        let oid = oid_result.map_err(|e| e.message().to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.message().to_string())?;
        let short_oid = oid.to_string()[..7].to_string();
        let message = commit.summary().unwrap_or("").to_string();
        let author = commit.author();
        let parents: Vec<String> = (0..commit.parent_count())
            .filter_map(|i| commit.parent_id(i).ok())
            .map(|p| p.to_string())
            .collect();

        commits.push(CommitInfo {
            oid: oid.to_string(),
            short_oid,
            message,
            author_name: author.name().unwrap_or("Unknown").to_string(),
            author_email: author.email().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
            parents,
        });
    }

    Ok(commits)
}

pub fn get_all_commits(repo_path: &str, limit: usize) -> Result<Vec<CommitInfo>, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let mut revwalk = repo.revwalk().map_err(|e| e.message().to_string())?;
    revwalk.set_sorting(git2::Sort::TIME | git2::Sort::TOPOLOGICAL).map_err(|e| e.message().to_string())?;
    revwalk.push_glob("refs/heads/*").map_err(|e| e.message().to_string())?;

    let mut commits = Vec::new();
    for (i, oid_result) in revwalk.enumerate() {
        if i >= limit { break; }
        let oid = oid_result.map_err(|e| e.message().to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.message().to_string())?;
        let short_oid = oid.to_string()[..7].to_string();
        let message = commit.summary().unwrap_or("").to_string();
        let author = commit.author();
        let parents: Vec<String> = (0..commit.parent_count())
            .filter_map(|i| commit.parent_id(i).ok())
            .map(|p| p.to_string())
            .collect();

        commits.push(CommitInfo {
            oid: oid.to_string(),
            short_oid,
            message,
            author_name: author.name().unwrap_or("Unknown").to_string(),
            author_email: author.email().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
            parents,
        });
    }

    Ok(commits)
}

pub fn get_branches(repo_path: &str) -> Result<Vec<BranchInfo>, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let head_oid = repo.head().ok()
        .and_then(|h| h.peel_to_commit().ok())
        .map(|c| c.id());

    let mut branches = Vec::new();

    for branch_result in repo.branches(Some(BranchType::Local)).map_err(|e| e.message().to_string())? {
        let (branch, _) = branch_result.map_err(|e| e.message().to_string())?;
        let name = branch.name().map_err(|e| e.message().to_string())?
            .unwrap_or("").to_string();
        let tip = branch.get().peel_to_commit().map_err(|e| e.message().to_string())?;
        let is_head = head_oid.map(|h| h == tip.id()).unwrap_or(false);
        let upstream = branch.upstream().ok()
            .and_then(|u| u.name().ok().flatten().map(|s| s.to_string()));

        branches.push(BranchInfo {
            name,
            is_head,
            is_remote: false,
            upstream,
            tip_oid: tip.id().to_string(),
        });
    }

    for branch_result in repo.branches(Some(BranchType::Remote)).map_err(|e| e.message().to_string())? {
        let (branch, _) = branch_result.map_err(|e| e.message().to_string())?;
        let name = branch.name().map_err(|e| e.message().to_string())?
            .unwrap_or("").to_string();
        let tip = branch.get().peel_to_commit().map_err(|e| e.message().to_string())?;

        branches.push(BranchInfo {
            name,
            is_head: false,
            is_remote: true,
            upstream: None,
            tip_oid: tip.id().to_string(),
        });
    }

    Ok(branches)
}

pub fn get_status(repo_path: &str) -> Result<Vec<FileStatus>, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(true);

    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.message().to_string())?;
    let mut result = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let s = entry.status();
        let staged = s.intersects(
            git2::Status::INDEX_NEW | git2::Status::INDEX_MODIFIED |
            git2::Status::INDEX_DELETED | git2::Status::INDEX_RENAMED
        );
        result.push(FileStatus {
            path,
            status: map_status(s),
            staged,
        });
    }

    Ok(result)
}

pub fn get_diff(repo_path: &str, commit_oid: Option<String>, staged: bool) -> Result<Vec<FileDiff>, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let diff = if let Some(oid_str) = commit_oid {
        let oid = Oid::from_str(&oid_str).map_err(|e| e.message().to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.message().to_string())?;
        let tree = commit.tree().map_err(|e| e.message().to_string())?;
        let parent_tree = commit.parent(0).ok()
            .and_then(|p| p.tree().ok());
        repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None)
            .map_err(|e| e.message().to_string())?
    } else if staged {
        let head_tree = repo.head().ok()
            .and_then(|h| h.peel_to_commit().ok())
            .and_then(|c| c.tree().ok());
        repo.diff_tree_to_index(head_tree.as_ref(), None, None)
            .map_err(|e| e.message().to_string())?
    } else {
        repo.diff_index_to_workdir(None, None)
            .map_err(|e| e.message().to_string())?
    };

    let mut file_diffs: Vec<FileDiff> = Vec::new();

    diff.print(git2::DiffFormat::Patch, |delta, hunk, line| {
        let path = delta.new_file().path()
            .or_else(|| delta.old_file().path())
            .and_then(|p| p.to_str())
            .unwrap_or("")
            .to_string();

        let entry = file_diffs.iter_mut().find(|f| f.path == path);
        let file_diff = if let Some(e) = entry {
            e
        } else {
            file_diffs.push(FileDiff { path: path.clone(), hunks: Vec::new() });
            file_diffs.last_mut().unwrap()
        };

        if let Some(h) = hunk {
            let header = std::str::from_utf8(h.header()).unwrap_or("").trim().to_string();
            if file_diff.hunks.last().map(|h: &DiffHunk| h.header != header).unwrap_or(true) {
                file_diff.hunks.push(DiffHunk { header, lines: Vec::new() });
            }
        }

        let content = std::str::from_utf8(line.content()).unwrap_or("").to_string();
        let origin = line.origin();

        if let Some(hunk) = file_diff.hunks.last_mut() {
            hunk.lines.push(DiffLine {
                origin,
                content: content.trim_end_matches('\n').to_string(),
                old_lineno: line.old_lineno(),
                new_lineno: line.new_lineno(),
            });
        }

        true
    }).map_err(|e| e.message().to_string())?;

    Ok(file_diffs)
}

pub fn stage_file(repo_path: &str, file_path: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let mut index = repo.index().map_err(|e| e.message().to_string())?;
    index.add_path(Path::new(file_path)).map_err(|e| e.message().to_string())?;
    index.write().map_err(|e| e.message().to_string())?;
    Ok(())
}

pub fn unstage_file(repo_path: &str, file_path: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let head = repo.head().ok()
        .and_then(|h| h.peel_to_commit().ok());

    if let Some(commit) = head {
        repo.reset_default(Some(commit.as_object()), &[Path::new(file_path)])
            .map_err(|e| e.message().to_string())?;
    } else {
        let mut index = repo.index().map_err(|e| e.message().to_string())?;
        index.remove_path(Path::new(file_path)).map_err(|e| e.message().to_string())?;
        index.write().map_err(|e| e.message().to_string())?;
    }
    Ok(())
}

pub fn stage_all(repo_path: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let mut index = repo.index().map_err(|e| e.message().to_string())?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| e.message().to_string())?;
    index.write().map_err(|e| e.message().to_string())?;
    Ok(())
}

pub fn commit(repo_path: &str, message: &str) -> Result<String, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let mut index = repo.index().map_err(|e| e.message().to_string())?;
    let tree_id = index.write_tree().map_err(|e| e.message().to_string())?;
    let tree = repo.find_tree(tree_id).map_err(|e| e.message().to_string())?;

    let config = repo.config().map_err(|e| e.message().to_string())?;
    let name = config.get_string("user.name").unwrap_or_else(|_| "Unknown".to_string());
    let email = config.get_string("user.email").unwrap_or_else(|_| "unknown@example.com".to_string());
    let sig = Signature::now(&name, &email).map_err(|e| e.message().to_string())?;

    let parent_commit = repo.head().ok()
        .and_then(|h| h.peel_to_commit().ok());

    let oid = if let Some(parent) = parent_commit {
        repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[&parent])
            .map_err(|e| e.message().to_string())?
    } else {
        repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &[])
            .map_err(|e| e.message().to_string())?
    };

    Ok(oid.to_string())
}

pub fn create_branch(repo_path: &str, name: &str, from_oid: Option<String>) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let commit = if let Some(oid_str) = from_oid {
        let oid = Oid::from_str(&oid_str).map_err(|e| e.message().to_string())?;
        repo.find_commit(oid).map_err(|e| e.message().to_string())?
    } else {
        repo.head().map_err(|e| e.message().to_string())?
            .peel_to_commit().map_err(|e| e.message().to_string())?
    };
    repo.branch(name, &commit, false).map_err(|e| e.message().to_string())?;
    Ok(())
}

pub fn checkout_branch(repo_path: &str, branch_name: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let refname = format!("refs/heads/{}", branch_name);
    let obj = repo.revparse_single(&refname).map_err(|e| e.message().to_string())?;
    repo.checkout_tree(&obj, None).map_err(|e| e.message().to_string())?;
    repo.set_head(&refname).map_err(|e| e.message().to_string())?;
    Ok(())
}

pub fn delete_branch(repo_path: &str, branch_name: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let mut branch = repo.find_branch(branch_name, BranchType::Local)
        .map_err(|e| e.message().to_string())?;
    branch.delete().map_err(|e| e.message().to_string())?;
    Ok(())
}

pub fn get_remotes(repo_path: &str) -> Result<Vec<RemoteInfo>, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let remote_names = repo.remotes().map_err(|e| e.message().to_string())?;
    let mut result = Vec::new();
    for name in remote_names.iter().flatten() {
        let remote = repo.find_remote(name).map_err(|e| e.message().to_string())?;
        result.push(RemoteInfo {
            name: name.to_string(),
            url: remote.url().unwrap_or("").to_string(),
        });
    }
    Ok(result)
}

pub fn fetch(repo_path: &str, remote_name: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let mut remote = repo.find_remote(remote_name).map_err(|e| e.message().to_string())?;
    let mut fetch_opts = git2::FetchOptions::new();
    fetch_opts.download_tags(git2::AutotagOption::All);
    remote.fetch(&[] as &[&str], Some(&mut fetch_opts), None)
        .map_err(|e| e.message().to_string())?;
    Ok(())
}

pub fn get_tags(repo_path: &str) -> Result<Vec<TagInfo>, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let mut tags = Vec::new();
    let tag_names = repo.tag_names(None).map_err(|e| e.message().to_string())?;
    for name in tag_names.iter().flatten() {
        let reference = repo.find_reference(&format!("refs/tags/{}", name))
            .map_err(|e| e.message().to_string())?;
        let oid = reference.peel_to_commit()
            .map(|c| c.id())
            .or_else(|_| reference.target().ok_or_else(|| "no target".to_string()))
            .map_err(|e| e.to_string())?;
        let message = reference.peel_to_tag().ok()
            .and_then(|t| t.message().map(|m| m.to_string()));
        tags.push(TagInfo {
            name: name.to_string(),
            oid: oid.to_string(),
            message,
        });
    }
    Ok(tags)
}

pub fn get_stashes(repo_path: &str) -> Result<Vec<StashInfo>, String> {
    let mut repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let mut stashes = Vec::new();
    repo.stash_foreach(|index, message, oid| {
        stashes.push(StashInfo {
            index,
            message: message.to_string(),
            oid: oid.to_string(),
        });
        true
    }).map_err(|e| e.message().to_string())?;
    Ok(stashes)
}

pub fn stash_save(repo_path: &str, message: &str) -> Result<(), String> {
    let mut repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let config = repo.config().map_err(|e| e.message().to_string())?;
    let name = config.get_string("user.name").unwrap_or_else(|_| "Unknown".to_string());
    let email = config.get_string("user.email").unwrap_or_else(|_| "unknown@example.com".to_string());
    let sig = Signature::now(&name, &email).map_err(|e| e.message().to_string())?;
    repo.stash_save(&sig, message, None).map_err(|e| e.message().to_string())?;
    Ok(())
}

pub fn stash_pop(repo_path: &str) -> Result<(), String> {
    let mut repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    repo.stash_pop(0, None).map_err(|e| e.message().to_string())?;
    Ok(())
}

pub fn get_commit_files(repo_path: &str, commit_oid: &str) -> Result<Vec<FileStatus>, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let oid = Oid::from_str(commit_oid).map_err(|e| e.message().to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.message().to_string())?;
    let tree = commit.tree().map_err(|e| e.message().to_string())?;
    let parent_tree = commit.parent(0).ok()
        .and_then(|p| p.tree().ok());
    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), None)
        .map_err(|e| e.message().to_string())?;

    let mut files = Vec::new();
    for delta in diff.deltas() {
        let path = delta.new_file().path()
            .or_else(|| delta.old_file().path())
            .and_then(|p| p.to_str())
            .unwrap_or("")
            .to_string();
        let status = match delta.status() {
            git2::Delta::Added => "added",
            git2::Delta::Deleted => "deleted",
            git2::Delta::Modified => "modified",
            git2::Delta::Renamed => "renamed",
            _ => "modified",
        };
        files.push(FileStatus { path, status: status.to_string(), staged: true });
    }

    Ok(files)
}

pub fn init_repo(repo_path: &str) -> Result<(), String> {
    Repository::init(repo_path).map_err(|e| e.message().to_string())?;
    Ok(())
}

pub fn clone_repo(url: &str, dest: &str) -> Result<(), String> {
    Repository::clone(url, dest).map_err(|e| e.message().to_string())?;
    Ok(())
}

pub fn pull(repo_path: &str) -> Result<String, String> {
    use std::process::Command;
    let output = Command::new("git")
        .args(["pull"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{}{}", stdout, stderr).trim().to_string();
    if output.status.success() {
        Ok(if combined.is_empty() { "Already up to date.".to_string() } else { combined })
    } else {
        Err(if combined.is_empty() { "git pull failed".to_string() } else { combined })
    }
}

pub fn discard_file(repo_path: &str, file_path: &str) -> Result<(), String> {
    use std::process::Command;
    // `git restore` (git ≥ 2.23) discards working-tree changes cleanly.
    // Fall back to `git checkout HEAD -- <file>` for older versions.
    let out = Command::new("git")
        .args(["restore", "--", file_path])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;
    if out.status.success() { return Ok(()); }
    let out2 = Command::new("git")
        .args(["checkout", "HEAD", "--", file_path])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;
    if out2.status.success() { return Ok(()); }
    let err = String::from_utf8_lossy(&out2.stderr).trim().to_string();
    Err(if err.is_empty() { "discard failed".to_string() } else { err })
}

pub fn merge_branch(repo_path: &str, branch_name: &str) -> Result<String, String> {
    use std::process::Command;
    let output = Command::new("git")
        .args(["merge", branch_name])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{}{}", stdout, stderr).trim().to_string();
    if output.status.success() {
        Ok(if combined.is_empty() { "Merge complete".to_string() } else { combined })
    } else {
        Err(if combined.is_empty() { "git merge failed".to_string() } else { combined })
    }
}

pub fn rename_branch(repo_path: &str, old_name: &str, new_name: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let mut branch = repo.find_branch(old_name, BranchType::Local)
        .map_err(|e| e.message().to_string())?;
    branch.rename(new_name, false).map_err(|e| e.message().to_string())?;
    Ok(())
}

pub fn amend_commit(repo_path: &str, message: &str) -> Result<String, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let mut index = repo.index().map_err(|e| e.message().to_string())?;
    let tree_id = index.write_tree().map_err(|e| e.message().to_string())?;
    let tree = repo.find_tree(tree_id).map_err(|e| e.message().to_string())?;

    let config = repo.config().map_err(|e| e.message().to_string())?;
    let name = config.get_string("user.name").unwrap_or_else(|_| "Unknown".to_string());
    let email = config.get_string("user.email").unwrap_or_else(|_| "unknown@example.com".to_string());
    let sig = Signature::now(&name, &email).map_err(|e| e.message().to_string())?;

    let head_commit = repo.head()
        .map_err(|e| e.message().to_string())?
        .peel_to_commit()
        .map_err(|e| e.message().to_string())?;

    let oid = head_commit.amend(
        Some("HEAD"),
        Some(&sig),
        Some(&sig),
        None,
        Some(message),
        Some(&tree),
    ).map_err(|e| e.message().to_string())?;

    Ok(oid.to_string())
}

pub fn stash_drop(repo_path: &str, index: usize) -> Result<(), String> {
    let mut repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    repo.stash_drop(index).map_err(|e| e.message().to_string())?;
    Ok(())
}

pub fn cherry_pick(repo_path: &str, commit_oid: &str) -> Result<(), String> {
    use std::process::Command;
    let out = Command::new("git")
        .args(["cherry-pick", commit_oid])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;
    if out.status.success() { return Ok(()); }
    let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
    Err(if err.is_empty() { "cherry-pick failed".to_string() } else { err })
}

pub fn revert_commit(repo_path: &str, commit_oid: &str) -> Result<(), String> {
    use std::process::Command;
    let out = Command::new("git")
        .args(["revert", "--no-edit", commit_oid])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;
    if out.status.success() { return Ok(()); }
    let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
    Err(if err.is_empty() { "revert failed".to_string() } else { err })
}

pub fn reset_to_commit(repo_path: &str, commit_oid: &str, mode: &str) -> Result<(), String> {
    use std::process::Command;
    let flag = match mode {
        "soft"  => "--soft",
        "hard"  => "--hard",
        _       => "--mixed",
    };
    let out = Command::new("git")
        .args(["reset", flag, commit_oid])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;
    if out.status.success() { return Ok(()); }
    let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
    Err(if err.is_empty() { "reset failed".to_string() } else { err })
}

pub fn checkout_commit(repo_path: &str, commit_oid: &str) -> Result<(), String> {
    use std::process::Command;
    let out = Command::new("git")
        .args(["checkout", commit_oid])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;
    if out.status.success() { return Ok(()); }
    let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
    Err(if err.is_empty() { "checkout failed".to_string() } else { err })
}

pub fn create_tag(repo_path: &str, name: &str, commit_oid: &str, message: Option<&str>) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    let oid = Oid::from_str(commit_oid).map_err(|e| e.message().to_string())?;
    let obj = repo.find_object(oid, None).map_err(|e| e.message().to_string())?;
    if let Some(msg) = message.filter(|m| !m.is_empty()) {
        let config = repo.config().map_err(|e| e.message().to_string())?;
        let author_name = config.get_string("user.name").unwrap_or_else(|_| "Unknown".to_string());
        let author_email = config.get_string("user.email").unwrap_or_else(|_| "unknown@example.com".to_string());
        let sig = Signature::now(&author_name, &author_email).map_err(|e| e.message().to_string())?;
        repo.tag(name, &obj, &sig, msg, false).map_err(|e| e.message().to_string())?;
    } else {
        repo.tag_lightweight(name, &obj, false).map_err(|e| e.message().to_string())?;
    }
    Ok(())
}

pub fn delete_tag(repo_path: &str, name: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    repo.tag_delete(name).map_err(|e| e.message().to_string())?;
    Ok(())
}

pub fn get_file_history(repo_path: &str, file_path: &str, limit: usize) -> Result<Vec<CommitInfo>, String> {
    use std::process::Command;
    // Use git log with --follow to handle renames
    let out = Command::new("git")
        .args([
            "log",
            &format!("--max-count={}", limit),
            "--follow",
            "--pretty=format:%H|%h|%s|%an|%ae|%ct|%P",
            "--",
            file_path,
        ])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(if err.is_empty() { "git log failed".to_string() } else { err });
    }
    let stdout = String::from_utf8_lossy(&out.stdout);
    let mut commits = Vec::new();
    for line in stdout.lines() {
        let parts: Vec<&str> = line.splitn(7, '|').collect();
        if parts.len() < 6 { continue; }
        let parents: Vec<String> = if parts.len() == 7 && !parts[6].is_empty() {
            parts[6].split_whitespace().map(|s| s.to_string()).collect()
        } else {
            vec![]
        };
        commits.push(CommitInfo {
            oid: parts[0].to_string(),
            short_oid: parts[1].to_string(),
            message: parts[2].to_string(),
            author_name: parts[3].to_string(),
            author_email: parts[4].to_string(),
            timestamp: parts[5].parse().unwrap_or(0),
            parents,
        });
    }
    Ok(commits)
}

pub fn add_remote(repo_path: &str, name: &str, url: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    repo.remote(name, url).map_err(|e| e.message().to_string())?;
    Ok(())
}

pub fn remove_remote(repo_path: &str, name: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.message().to_string())?;
    repo.remote_delete(name).map_err(|e| e.message().to_string())?;
    Ok(())
}

pub fn fetch_all(repo_path: &str) -> Result<(), String> {
    use std::process::Command;
    let out = Command::new("git")
        .args(["fetch", "--all"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;
    if out.status.success() { return Ok(()); }
    let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
    Err(if err.is_empty() { "git fetch --all failed".to_string() } else { err })
}

pub fn open_in_explorer(path: &str) -> Result<(), String> {
    use std::process::Command;
    #[cfg(target_os = "windows")]
    Command::new("explorer").arg(path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    Command::new("open").arg(path).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    Command::new("xdg-open").arg(path).spawn().map_err(|e| e.to_string())?;
    Ok(())
}
