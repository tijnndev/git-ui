import { useState, useEffect } from "react";
import { X, FileText, GitMerge, RotateCcw, Tag, ArrowDown, History, ChevronDown, Copy, GitBranch } from "lucide-react";
import type { CommitInfo, FileStatus, FileDiff } from "../types";
import * as api from "../api";
import DiffViewer from "./DiffViewer";
import { useToast } from "../toast";

interface Props {
  commit: CommitInfo;
  repoPath: string;
  onClose: () => void;
  onRefresh: () => void;
  onOpenFileHistory: (filePath: string) => void;
}

export default function CommitDetail({ commit, repoPath, onClose, onRefresh, onOpenFileHistory }: Props) {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagMsg, setTagMsg] = useState("");
  const [showTagForm, setShowTagForm] = useState(false);
  const [showResetMenu, setShowResetMenu] = useState(false);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const toast = useToast();

  useEffect(() => {
    setFiles([]);
    setSelectedFile(null);
    setDiff(null);
    api.getCommitFiles(repoPath, commit.oid).then(setFiles).catch(console.error);
  }, [commit.oid, repoPath]);

  const loadDiff = async (filePath: string) => {
    setSelectedFile(filePath);
    setLoadingDiff(true);
    try {
      const diffs = await api.getDiff(repoPath, commit.oid);
      const found = diffs.find((d) => d.path === filePath) ?? null;
      setDiff(found);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDiff(false);
    }
  };

  const handleCherryPick = async () => {
    try {
      await api.cherryPick(repoPath, commit.oid);
      toast.success(`Cherry-picked ${commit.short_oid}`);
      onRefresh();
    } catch (e) { toast.error(String(e), 0); }
  };

  const handleRevert = async () => {
    try {
      await api.revertCommit(repoPath, commit.oid);
      toast.success(`Reverted ${commit.short_oid}`);
      onRefresh();
    } catch (e) { toast.error(String(e), 0); }
  };

  const handleReset = async (mode: "soft" | "mixed" | "hard") => {
    const label = { soft: "Soft", mixed: "Mixed", hard: "Hard" }[mode];
    if (mode === "hard" && !confirm(`Hard reset to ${commit.short_oid}? All uncommitted changes will be lost.`)) return;
    try {
      await api.resetToCommit(repoPath, commit.oid, mode);
      toast.success(`${label} reset to ${commit.short_oid}`);
      setShowResetMenu(false);
      onRefresh();
    } catch (e) { toast.error(String(e), 0); }
  };

  const handleCheckoutCommit = async () => {
    if (!confirm(`Checkout commit ${commit.short_oid}? HEAD will be detached.`)) return;
    try {
      await api.checkoutCommit(repoPath, commit.oid);
      toast.success(`Checked out ${commit.short_oid} (detached HEAD)`);
      onRefresh();
    } catch (e) { toast.error(String(e), 0); }
  };

  const handleCreateTag = async () => {
    if (!tagName.trim()) return;
    try {
      await api.createTag(repoPath, tagName.trim(), commit.oid, tagMsg.trim() || undefined);
      toast.success(`Tag "${tagName.trim()}" created`);
      setTagName(""); setTagMsg(""); setShowTagForm(false);
      onRefresh();
    } catch (e) { toast.error(String(e), 0); }
  };

  const handleCopySha = async () => {
    await navigator.clipboard.writeText(commit.oid);
    toast.success("SHA copied to clipboard");
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    try {
      await api.createBranch(repoPath, newBranchName.trim(), commit.oid);
      toast.success(`Branch "${newBranchName.trim()}" created`);
      setNewBranchName(""); setShowBranchForm(false);
      onRefresh();
    } catch (e) { toast.error(String(e), 0); }
  };

  const date = new Date(commit.timestamp * 1000);

  return (
    <div className="commit-detail">
      <div className="commit-detail-header">
        <div className="commit-meta">
          <div className="commit-message-full">{commit.message}</div>
          <div className="commit-info-row">
            <span className="commit-author">{commit.author_name} &lt;{commit.author_email}&gt;</span>
            <span className="commit-date">{date.toLocaleString()}</span>
          <span className="commit-hash monospace" style={{ cursor: "pointer" }} onClick={handleCopySha} title="Click to copy">{commit.oid}</span>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose}><X size={14} /></button>
      </div>

      {/* Action toolbar */}
      <div className="commit-actions">
        <button className="commit-action-btn" onClick={handleCherryPick} title="Cherry-pick this commit onto the current branch">
          <GitMerge size={13} />
          Cherry-pick
        </button>
        <button className="commit-action-btn" onClick={handleRevert} title="Create a new commit that reverts this commit">
          <RotateCcw size={13} />
          Revert
        </button>
        <button className="commit-action-btn" onClick={handleCheckoutCommit} title="Checkout this commit (detached HEAD)">
          <ArrowDown size={13} />
          Checkout
        </button>
        <div className="commit-action-dropdown">
          <button
            className="commit-action-btn"
            onClick={() => setShowResetMenu((v) => !v)}
            title="Reset current branch to this commit"
          >
            <History size={13} />
            Reset
            <ChevronDown size={11} />
          </button>
          {showResetMenu && (
            <div className="dropdown-menu">
              <button onClick={() => handleReset("soft")}>Soft - keep changes staged</button>
              <button onClick={() => handleReset("mixed")}>Mixed - keep changes unstaged</button>
              <button onClick={() => handleReset("hard")} className="danger">Hard - discard all changes</button>
            </div>
          )}
        </div>
        <button className="commit-action-btn" onClick={() => setShowTagForm((v) => !v)} title="Create a tag at this commit">
          <Tag size={13} />
          Tag
        </button>
        <button className="commit-action-btn" onClick={() => setShowBranchForm((v) => !v)} title="Create a new branch at this commit">
          <GitBranch size={13} />
          Branch
        </button>
        <button className="commit-action-btn" onClick={handleCopySha} title="Copy full SHA to clipboard">
          <Copy size={13} />
          Copy SHA
        </button>
      </div>

      {showBranchForm && (
        <div className="tag-form">
          <input
            autoFocus
            placeholder="New branch name"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateBranch(); if (e.key === "Escape") setShowBranchForm(false); }}
          />
          <button className="btn-primary" onClick={handleCreateBranch} disabled={!newBranchName.trim()}>
            <GitBranch size={12} /> Create Branch
          </button>
        </div>
      )}

      {showTagForm && (
        <div className="tag-form">
          <input
            autoFocus
            placeholder="Tag name (e.g. v1.0.0)"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateTag(); if (e.key === "Escape") setShowTagForm(false); }}
          />
          <input
            placeholder="Message (optional - leave blank for lightweight tag)"
            value={tagMsg}
            onChange={(e) => setTagMsg(e.target.value)}
          />
          <button className="btn-primary" onClick={handleCreateTag} disabled={!tagName.trim()}>
            <Tag size={12} /> Create Tag
          </button>
        </div>
      )}

      <div className="commit-detail-body">
        <div className="commit-files-panel">
          <div className="panel-title">Changed Files ({files.length})</div>
          {files.map((f) => (
            <div
              key={f.path}
              className={`file-item ${selectedFile === f.path ? "selected" : ""}`}
              onClick={() => loadDiff(f.path)}
            >
              <span className={`status-badge status-${f.status}`}>{f.status[0].toUpperCase()}</span>
              <FileText size={12} />
              <span className="file-path">{f.path}</span>
              <button
                className="icon-btn"
                title="File history"
                onClick={(e) => { e.stopPropagation(); onOpenFileHistory(f.path); }}
              >
                <History size={10} />
              </button>
            </div>
          ))}
        </div>

        <div className="diff-panel">
          {loadingDiff ? (
            <div className="loading-overlay"><div className="spinner" /></div>
          ) : diff ? (
            <DiffViewer diff={diff} />
          ) : (
            <div className="empty-state">
              <FileText size={32} />
              <p>Select a file to view diff</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
