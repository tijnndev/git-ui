import { useState, useEffect } from "react";
import { Plus, Minus, Check, RotateCcw, Package, Upload } from "lucide-react";
import type { FileStatus, FileDiff } from "../types";
import * as api from "../api";
import DiffViewer from "./DiffViewer";
import { loadAccounts, findAccountForUrl, injectToken } from "../github-accounts";
import { useToast } from "../toast";

interface Props {
  repoPath: string;
  status: FileStatus[];
  onRefresh: () => void;
}

export default function WorkingDirectory({ repoPath, status, onRefresh }: Props) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedStaged, setSelectedStaged] = useState(false);
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);
  const [stashMsg, setStashMsg] = useState("");
  const [pushing, setPushing] = useState(false);
  const toast = useToast();

  const staged = status.filter((f) => f.staged);
  const unstaged = status.filter((f) => !f.staged);

  useEffect(() => {
    setSelectedFile(null);
    setDiff(null);
  }, [repoPath]);

  const loadDiff = async (filePath: string, staged: boolean) => {
    setSelectedFile(filePath);
    setSelectedStaged(staged);
    try {
      const diffs = await api.getDiff(repoPath, undefined, staged);
      setDiff(diffs.find((d) => d.path === filePath) ?? null);
    } catch (e) {
      console.error(e);
    }
  };

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
      await api.commitChanges(repoPath, commitMsg.trim());
      setCommitMsg("");
      onRefresh();
      toast.success("Commit created");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCommitting(false);
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
      // Try to inject stored GitHub credentials into the remote URL
      let remoteArg: string | undefined;
      try {
        const remoteUrl = await api.getRemoteUrl(repoPath, "origin");
        const accounts = loadAccounts();
        const account = findAccountForUrl(remoteUrl, accounts);
        if (account) {
          remoteArg = injectToken(remoteUrl, account);
        }
      } catch {
        // No remote or no matching account — fall back to plain push
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
    <div className="working-directory">
      <div className="wd-left">
        {diff ? (
          <DiffViewer diff={diff} />
        ) : (
          <div className="empty-state">
            <RotateCcw size={32} />
            <p>Select a file to view changes</p>
          </div>
        )}
      </div>

      <div className="wd-right">
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
              onClick={() => loadDiff(f.path, true)}
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
              <button className="icon-btn" onClick={handleStageAll} title="Stage all">
                <Plus size={12} />
              </button>
            )}
          </div>
          {unstaged.length === 0 ? (
            <div className="empty-files">Working tree clean</div>
          ) : unstaged.map((f) => (
            <div
              key={f.path}
              className={`file-item ${selectedFile === f.path && !selectedStaged ? "selected" : ""}`}
              onClick={() => loadDiff(f.path, false)}
            >
              <span className={`status-badge status-${f.status}`}>{f.status[0].toUpperCase()}</span>
              <span className="file-path">{f.path}</span>
              <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleStage(f.path); }}>
                <Plus size={10} />
              </button>
            </div>
          ))}
        </div>

        <div className="commit-form">
          <textarea
            className="commit-input"
            placeholder="Commit message..."
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            rows={3}
          />
          <button
            className="btn-primary"
            onClick={handleCommit}
            disabled={!commitMsg.trim() || staged.length === 0 || committing}
          >
            <Check size={14} />
            {committing ? "Committing..." : "Commit"}
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
    </div>
  );
}
