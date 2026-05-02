import { useState, useEffect } from "react";
import { Plus, Minus, Check, RotateCcw, Package, Upload, Trash2, Edit3, Terminal } from "lucide-react";
import type { FileStatus } from "../types";
import * as api from "../api";
import { loadAccounts, findAccountForUrl, injectToken } from "../github-accounts";
import { useToast } from "../toast";
import ConfirmModal from "./ConfirmModal";

interface Props {
  repoPath: string;
  status: FileStatus[];
  onRefresh: () => void;
  categoryAccountId?: string | null;
  selectedFile?: string | null;
  selectedStaged?: boolean;
  onSelectFile?: (path: string, staged: boolean) => void;
  width?: number;
}

export default function WorkingDirectory({ repoPath, status, onRefresh, categoryAccountId, selectedFile, selectedStaged, onSelectFile, width }: Props) {
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);
  const [amend, setAmend] = useState(false);
  const [stashMsg, setStashMsg] = useState("");
  const [pushing, setPushing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState<{ filePath: string } | null>(null);
  const [confirmDiscardAll, setConfirmDiscardAll] = useState(false);
  const toast = useToast();

  const staged = status.filter((f) => f.staged);
  const unstaged = status.filter((f) => !f.staged);

  useEffect(() => {
    // nothing to clear when repo changes – parent manages selection
  }, [repoPath]);

  const handleStage = async (filePath: string) => {
    await api.stageFile(repoPath, filePath);
    onRefresh();
  };

  const handleUnstage = async (filePath: string) => {
    await api.unstageFile(repoPath, filePath);
    onRefresh();
  };

  const handleStageAll = async () => {
    await api.stageAll(repoPath);
    onRefresh();
  };

  const handleCommit = async () => {
    if (!commitMsg.trim()) return;
    setCommitting(true);
    try {
      if (amend) {
        await api.amendCommit(repoPath, commitMsg.trim());
        toast.success("Commit amended");
      } else {
        await api.commitChanges(repoPath, commitMsg.trim());
        toast.success("Commit created");
      }
      setCommitMsg("");
      setAmend(false);
      onRefresh();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCommitting(false);
    }
  };

  const handleDiscard = (filePath: string) => {
    setConfirmDiscard({ filePath });
  };

  const doDiscard = async (filePath: string) => {
    try {
      await api.discardFile(repoPath, filePath);
      onRefresh();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleDiscardAll = () => {
    const tracked = unstaged.filter((f) => f.status !== "untracked");
    if (tracked.length === 0) return;
    setConfirmDiscardAll(true);
  };

  const doDiscardAll = async () => {
    try {
      await api.discardAll(repoPath);
      onRefresh();
      toast.success("All tracked changes discarded");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleStash = async () => {
    try {
      await api.stashSave(repoPath, stashMsg || "WIP stash");
      setStashMsg("");
      onRefresh();
      toast.success("Changes stashed");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handlePush = async () => {
    setPushing(true);
    try {
      // Try to inject stored GitHub credentials into the remote URL.
      // Priority: 1) category's assigned account, 2) account whose username matches the URL
      let remoteArg: string | undefined;
      try {
        const remoteUrl = await api.getRemoteUrl(repoPath, "origin");
        const accounts = await loadAccounts();
        const account =
          (categoryAccountId ? accounts.find((a) => a.id === categoryAccountId) : null)
          ?? findAccountForUrl(remoteUrl, accounts);

        // If this repo is in a category with an account assigned but no matching account
        // was found in the store, refuse to push — a silent fallback would let Git
        // Credential Manager supply the wrong cached credentials.
        if (categoryAccountId && !account) {
          toast.error(
            "No GitHub account found for this category. Go to Settings → GitHub Accounts and re-add your account.",
            0,
          );
          return;
        }

        if (account) {
          remoteArg = injectToken(remoteUrl, account);
        }
      } catch {
        // No remote configured - fall back to plain push
      }
      const msg = await api.gitPush(repoPath, remoteArg);
      toast.success(msg || "Push successful");
      onRefresh();
    } catch (e) {
      toast.error(String(e), 0);
    } finally {
      setPushing(false);
    }
  };

  return (
    <>
    <div className="changes-sidebar" style={width !== undefined ? { width } : undefined}>
      <div className="wd-file-sections">
        <div className="wd-section">
          <div className="wd-section-header">
            <span>Staged Changes ({staged.length})</span>
            {staged.length > 0 && (
              <button className="icon-btn" onClick={() => staged.forEach((f) => handleUnstage(f.path))} title="Unstage all">
                <Minus size={12} />
              </button>
            )}
          </div>
          {staged.length === 0 ? (
            <div className="empty-files">No staged changes</div>
          ) : staged.map((f) => (
            <div
              key={f.path}
              className={`file-item ${selectedFile === f.path && selectedStaged ? "selected" : ""}`}
              onClick={() => onSelectFile?.(f.path, true)}
            >
              <span className={`status-badge status-${f.status}`}>{f.status[0].toUpperCase()}</span>
              <span className="file-path">{f.path}</span>
              <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleUnstage(f.path); }}>
                <Minus size={10} />
              </button>
            </div>
          ))}
        </div>

        <div className="wd-section">
          <div className="wd-section-header">
            <span>Unstaged Changes ({unstaged.length})</span>
            {unstaged.length > 0 && (
              <>
                <button className="icon-btn danger" onClick={handleDiscardAll} title="Discard all tracked changes">
                  <RotateCcw size={12} />
                </button>
                <button className="icon-btn" onClick={handleStageAll} title="Stage all">
                  <Plus size={12} />
                </button>
              </>
            )}
          </div>
          {unstaged.length === 0 ? (
            <div className="empty-files">Working tree clean</div>
          ) : unstaged.map((f) => (
            <div
              key={f.path}
              className={`file-item ${selectedFile === f.path && !selectedStaged ? "selected" : ""}`}
              onClick={() => onSelectFile?.(f.path, false)}
            >
              <span className={`status-badge status-${f.status}`}>{f.status[0].toUpperCase()}</span>
              <span className="file-path">{f.path}</span>
              {f.status !== "untracked" && (
                <button className="icon-btn danger" title="Discard changes" onClick={(e) => { e.stopPropagation(); handleDiscard(f.path); }}>
                  <Trash2 size={10} />
                </button>
              )}
              <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleStage(f.path); }}>
                <Plus size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="commit-form">
          <textarea
            className="commit-input"
            placeholder="Commit message..."
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            rows={3}
          />
          <label className="amend-label">
            <input type="checkbox" checked={amend} onChange={(e) => setAmend(e.target.checked)} />
            <Edit3 size={11} />
            Amend last commit
          </label>
          <button
            className="btn-primary"
            onClick={handleCommit}
            disabled={!commitMsg.trim() || (staged.length === 0 && !amend) || committing}
          >
            <Check size={14} />
            {committing ? (amend ? "Amending..." : "Committing...") : (amend ? "Amend Commit" : "Commit")}
          </button>

          <div className="stash-form">
            <input
              placeholder="Stash message (optional)"
              value={stashMsg}
              onChange={(e) => setStashMsg(e.target.value)}
            />
            <button className="btn-secondary" onClick={handleStash} disabled={status.length === 0}>
              <Package size={14} />
              Stash
            </button>
          </div>

          <button
            className="btn-secondary"
            style={{ justifyContent: "center" }}
            onClick={handlePush}
            disabled={pushing}
          >
            <Upload size={14} />
            {pushing ? "Pushing..." : "Push to remote"}
          </button>
        </div>
    </div>

    {confirmDiscard && (
      <ConfirmModal
        title="Discard Changes"
        message={`Discard changes to "${confirmDiscard.filePath}"? This cannot be undone.`}
        confirmLabel="Discard"
        danger
        onConfirm={() => { doDiscard(confirmDiscard.filePath); setConfirmDiscard(null); }}
        onCancel={() => setConfirmDiscard(null)}
      />
    )}
    {confirmDiscardAll && (
      <ConfirmModal
        title="Discard All Changes"
        message={`Discard all ${unstaged.filter((f) => f.status !== "untracked").length} tracked change(s)? This cannot be undone.`}
        confirmLabel="Discard All"
        danger
        onConfirm={() => { doDiscardAll(); setConfirmDiscardAll(false); }}
        onCancel={() => setConfirmDiscardAll(false)}
      />
    )}
    </>
  );
}
