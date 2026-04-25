mod models;
mod git_ops;
mod commands;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_repo_summary,
            get_commits,
            get_all_commits,
            get_branches,
            get_status,
            get_diff,
            stage_file,
            unstage_file,
            stage_all,
            commit,
            create_branch,
            checkout_branch,
            delete_branch,
            get_remotes,
            fetch,
            get_tags,
            get_stashes,
            stash_save,
            stash_pop,
            get_commit_files,
            init_repo,
            clone_repo,
            git_push,
            get_remote_url,
            git_pull,
            discard_file,
            merge_branch,
            rename_branch,
            amend_commit,
            stash_drop,
            cherry_pick,
            revert_commit,
            reset_to_commit,
            checkout_commit,
            create_tag,
            delete_tag,
            get_file_history,
            add_remote,
            remove_remote,
            fetch_all,
            open_in_explorer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
