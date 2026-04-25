import { useState, useEffect } from "react";
import {
  GitBranch, GitCommit, Tag, Package, Cloud, ChevronDown,
  ChevronRight, Plus, Trash2, Check, GitFork, Circle,
  GitMerge, Edit2, X, RefreshCw, Link
} from "lucide-react";
import type { BranchInfo, RepoSummary, TagInfo, StashInfo, RemoteInfo } from "../types";
import type { Tab } from "../App";
import * as api from "../api";

interface Props {
  branches: BranchInfo[];
  tags: TagInfo[];
  repoPath: string;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onCheckout: (branch: string) => void;
  onMerge: (branch: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onRefresh: () => void;
  repoSummary: RepoSummary | null;
}
export default function Sidebar({
  branches, tags, repoPath, activeTab, onTabChange, onCheckout, onMerge, onRename, onRefresh, repoSummary
}: Props) {
  const [localOpen, setLocalOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [stashOpen, setStashOpen] = useState(false);
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [renamingBranch, setRenamingBranch] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [stashes, setStashes] = useState<StashInfo[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [showNewTag, setShowNewTag] = useState(false);
  const [remoteOpen, setRemoteOpen] = useState(true);
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [showAddRemote, setShowAddRemote] = useState(false);
  const [newRemoteName, setNewRemoteName] = useState("");
  const [newRemoteUrl, setNewRemoteUrl] = useState("");
  const [fetchingRemote, setFetchingRemote] = useState<string | null>(null);
  const [fetchingAll, setFetchingAll] = useState(false);

  const loadRemotes = () => {
    api.getRemotes(repoPath).then(setRemotes).catch(() => setRemotes([]));
  };

  const localBranches = branches.filter((b) => !b.is_remote);
  const remoteBranches = branches.filter((b) => b.is_remote);

  useEffect(() => {
    if (!repoPath) return;
    api.getStashes(repoPath).then(setStashes).catch(() => setStashes([]));
    loadRemotes();
  }, [repoPath]);

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    try {
      await api.createBranch(repoPath, newBranchName.trim());
      setNewBranchName("");
      setShowNewBranch(false);
      onRefresh();
    } catch (e) {
      alert(String(e));
    }
  };

  const handleDeleteBranch = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    if (!confirm(`Delete branch "${name}"?`)) return;
    try {
      await api.deleteBranch(repoPath, name);
      onRefresh();
    } catch (e) {
      alert(String(e));
    }
  };

  const startRename = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setRenamingBranch(name);
    setRenameValue(name);
  };

  const commitRename = async () => {
    if (!renamingBranch || !renameValue.trim() || renameValue === renamingBranch) {
      setRenamingBranch(null);
      return;
    }
    try {
      await onRename(renamingBranch, renameValue.trim());
    } catch {/* handled in App */}
    setRenamingBranch(null);
  };

  const handleStashPop = async (index: number) => {
    try {
      await api.stashPop(repoPath);
      const updated = await api.getStashes(repoPath);
      setStashes(updated);
      onRefresh();
    } catch (e) {
      alert(String(e));
    }
  };

  const handleStashDrop = async (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (!confirm("Drop this stash?")) return;
    try {
      await api.stashDrop(repoPath, index);
      const updated = await api.getStashes(repoPath);
      setStashes(updated);
      onRefresh();
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === "graph" ? "active" : ""}`}
          onClick={() => onTabChange("graph")}
        >
          <GitCommit size={14} />
          Graph
        </button>
        <button
          className={`sidebar-tab ${activeTab === "working" ? "active" : ""}`}
          onClick={() => onTabChange("working")}
        >
          <Package size={14} />
          Changes
        </button>
      </div>

      <div className="sidebar-section">
        <div className="section-header">
          <span className="section-title">Repository</span>
        </div>
        <div className="repo-info">
          <div className="repo-head">
            <GitFork size={12} />
            <span>{repoSummary?.head_branch ?? "HEAD detached"}</span>
          </div>
        </div>
      </div>

      {/* Local Branches */}
      <div className="sidebar-section">
        <div
          className="section-header clickable"
          onClick={() => setLocalOpen(!localOpen)}
        >
          {localOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <GitBranch size={12} />
          <span className="section-title">Local Branches</span>
          <span className="badge">{localBranches.length}</span>
          <button
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); setShowNewBranch(true); }}
            title="New branch"
          >
            <Plus size={12} />
          </button>
        </div>

        {showNewBranch && (
          <div className="new-branch-form">
            <input
              autoFocus
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="branch-name"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateBranch();
                if (e.key === "Escape") { setShowNewBranch(false); setNewBranchName(""); }
              }}
            />
            <button onClick={handleCreateBranch}><Check size={12} /></button>
          </div>
        )}

        {localOpen && localBranches.map((b) => (
          <div key={b.name} className={`branch-item ${b.is_head ? "active" : ""}`}>
            {renamingBranch === b.name ? (
              <div className="new-branch-form" style={{ flex: 1 }}>
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenamingBranch(null);
                  }}
                  onBlur={commitRename}
                />
                <button onClick={commitRename}><Check size={12} /></button>
              </div>
            ) : (
              <>
                {b.is_head && <span className="head-indicator"><Circle size={7} fill="currentColor" /></span>}
                <span className="branch-name" onClick={() => !b.is_head && onCheckout(b.name)}>{b.name}</span>
                <button className="icon-btn" onClick={(e) => startRename(e, b.name)} title="Rename branch">
                  <Edit2 size={10} />
                </button>
                {!b.is_head && (
                  <>
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onMerge(b.name); }} title={`Merge ${b.name} into current branch`}>
                      <GitMerge size={10} />
                    </button>
                    <button className="icon-btn danger" onClick={(e) => handleDeleteBranch(e, b.name)} title="Delete branch">
                      <Trash2 size={10} />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Remotes */}
      <div className="sidebar-section">
        <div
          className="section-header clickable"
          onClick={() => setRemoteOpen(!remoteOpen)}
        >
          {remoteOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Cloud size={12} />
          <span className="section-title">Remotes</span>
          <span className="badge">{remotes.length}</span>
          <button
            className={`icon-btn${fetchingAll ? " spin-btn" : ""}`}
            title="Fetch all remotes"
            onClick={async (e) => {
              e.stopPropagation();
              setFetchingAll(true);
              try { await api.fetchAll(repoPath); onRefresh(); }
              catch (ex) { alert(String(ex)); }
              finally { setFetchingAll(false); }
            }}
          >
            <RefreshCw size={11} className={fetchingAll ? "spin" : ""} />
          </button>
          <button
            className="icon-btn"
            title="Add remote"
            onClick={(e) => { e.stopPropagation(); setShowAddRemote((v) => !v); setRemoteOpen(true); }}
          >
            <Plus size={12} />
          </button>
        </div>

        {showAddRemote && (
          <div className="new-branch-form" style={{ flexDirection: "column", gap: 4, padding: "6px 8px" }}>
            <input
              autoFocus
              value={newRemoteName}
              onChange={(e) => setNewRemoteName(e.target.value)}
              placeholder="remote name (e.g. origin)"
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", gap: 4 }}>
              <input
                value={newRemoteUrl}
                onChange={(e) => setNewRemoteUrl(e.target.value)}
                placeholder="URL"
                style={{ flex: 1 }}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && newRemoteName.trim() && newRemoteUrl.trim()) {
                    try {
                      await api.addRemote(repoPath, newRemoteName.trim(), newRemoteUrl.trim());
                      setNewRemoteName(""); setNewRemoteUrl(""); setShowAddRemote(false);
                      loadRemotes();
                    } catch (ex) { alert(String(ex)); }
                  }
                  if (e.key === "Escape") { setShowAddRemote(false); setNewRemoteName(""); setNewRemoteUrl(""); }
                }}
              />
              <button onClick={async () => {
                if (!newRemoteName.trim() || !newRemoteUrl.trim()) return;
                try {
                  await api.addRemote(repoPath, newRemoteName.trim(), newRemoteUrl.trim());
                  setNewRemoteName(""); setNewRemoteUrl(""); setShowAddRemote(false);
                  loadRemotes();
                } catch (ex) { alert(String(ex)); }
              }}><Check size={12} /></button>
            </div>
          </div>
        )}

        {remoteOpen && remotes.map((r) => (
          <div key={r.name} className="branch-item remote">
            <Link size={10} style={{ opacity: 0.6, flexShrink: 0 }} />
            <span className="branch-name" title={r.url} style={{ flex: 1 }}>{r.name}</span>
            <button
              className={`icon-btn${fetchingRemote === r.name ? " spin-btn" : ""}`}
              title={`Fetch ${r.name}`}
              onClick={async (e) => {
                e.stopPropagation();
                setFetchingRemote(r.name);
                try { await api.fetchRemote(repoPath, r.name); onRefresh(); }
                catch (ex) { alert(String(ex)); }
                finally { setFetchingRemote(null); }
              }}
            >
              <RefreshCw size={10} className={fetchingRemote === r.name ? "spin" : ""} />
            </button>
            <button
              className="icon-btn danger"
              title={`Remove remote ${r.name}`}
              onClick={async (e) => {
                e.stopPropagation();
                if (!confirm(`Remove remote "${r.name}"?`)) return;
                try { await api.removeRemote(repoPath, r.name); loadRemotes(); onRefresh(); }
                catch (ex) { alert(String(ex)); }
              }}
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}

        {/* Remote Branches (collapsed under Remotes) */}
        {remoteOpen && remoteBranches.length > 0 && (
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4 }}>
            {remoteBranches.map((b) => (
              <div key={b.name} className="branch-item remote" style={{ paddingLeft: 20 }}>
                <GitBranch size={10} style={{ opacity: 0.5, flexShrink: 0 }} />
                <span className="branch-name">{b.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="sidebar-section">
        <div
          className="section-header clickable"
          onClick={() => setTagsOpen(!tagsOpen)}
        >
          {tagsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Tag size={12} />
          <span className="section-title">Tags</span>
          <span className="badge">{tags.length}</span>
          <button
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); setShowNewTag((v) => !v); setTagsOpen(true); }}
            title="Create tag on HEAD"
          >
            <Plus size={12} />
          </button>
        </div>
        {showNewTag && (
          <div className="new-branch-form">
            <input
              autoFocus
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="tag-name"
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newTagName.trim()) {
                  try {
                    // Use HEAD commit - sidebar doesn't know the oid, so get it via summary
                    const summary = await api.getRepoSummary(repoPath);
                    if (summary.head_oid) {
                      await api.createTag(repoPath, newTagName.trim(), summary.head_oid);
                      setNewTagName(""); setShowNewTag(false); onRefresh();
                    }
                  } catch (ex) { alert(String(ex)); }
                }
                if (e.key === "Escape") { setShowNewTag(false); setNewTagName(""); }
              }}
            />
            <button onClick={async () => {
              if (!newTagName.trim()) return;
              try {
                const summary = await api.getRepoSummary(repoPath);
                if (summary.head_oid) {
                  await api.createTag(repoPath, newTagName.trim(), summary.head_oid);
                  setNewTagName(""); setShowNewTag(false); onRefresh();
                }
              } catch (ex) { alert(String(ex)); }
            }}><Check size={12} /></button>
          </div>
        )}
        {tagsOpen && tags.map((t) => (
          <div key={t.name} className="branch-item">
            <Tag size={10} style={{ opacity: 0.6, flexShrink: 0 }} />
            <span className="branch-name">{t.name}</span>
            <button
              className="icon-btn danger"
              title="Delete tag"
              onClick={async (e) => {
                e.stopPropagation();
                if (!confirm(`Delete tag "${t.name}"?`)) return;
                try { await api.deleteTag(repoPath, t.name); onRefresh(); }
                catch (ex) { alert(String(ex)); }
              }}
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* Stashes */}
      <div className="sidebar-section">
        <div
          className="section-header clickable"
          onClick={() => setStashOpen(!stashOpen)}
        >
          {stashOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Package size={12} />
          <span className="section-title">Stashes</span>
          <span className="badge">{stashes.length}</span>
        </div>
        {stashOpen && stashes.map((s) => (
          <div key={s.index} className="branch-item">
            <span className="branch-name" style={{ flex: 1 }}>{s.message}</span>
            <button
              className="icon-btn"
              title="Pop stash"
              onClick={(e) => { e.stopPropagation(); handleStashPop(s.index); }}
            >
              <Check size={10} />
            </button>
            <button
              className="icon-btn danger"
              title="Drop stash"
              onClick={(e) => handleStashDrop(e, s.index)}
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
