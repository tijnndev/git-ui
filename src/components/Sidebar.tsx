import { useState } from "react";
import {
  GitBranch, GitCommit, Tag, Package, Cloud, ChevronDown,
  ChevronRight, Plus, Trash2, Check, GitFork, Circle
} from "lucide-react";
import type { BranchInfo, RepoSummary } from "../types";
import type { Tab } from "../App";
import * as api from "../api";

interface Props {
  branches: BranchInfo[];
  repoPath: string;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onCheckout: (branch: string) => void;
  onRefresh: () => void;
  repoSummary: RepoSummary | null;
}

export default function Sidebar({
  branches, repoPath, activeTab, onTabChange, onCheckout, onRefresh, repoSummary
}: Props) {
  const [localOpen, setLocalOpen] = useState(true);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");

  const localBranches = branches.filter((b) => !b.is_remote);
  const remoteBranches = branches.filter((b) => b.is_remote);

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
          <div
            key={b.name}
            className={`branch-item ${b.is_head ? "active" : ""}`}
            onClick={() => !b.is_head && onCheckout(b.name)}
          >
            {b.is_head && <span className="head-indicator"><Circle size={7} fill="currentColor" /></span>}
            <span className="branch-name">{b.name}</span>
            {!b.is_head && (
              <button
                className="icon-btn danger"
                onClick={(e) => handleDeleteBranch(e, b.name)}
                title="Delete branch"
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="sidebar-section">
        <div
          className="section-header clickable"
          onClick={() => setRemoteOpen(!remoteOpen)}
        >
          {remoteOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Cloud size={12} />
          <span className="section-title">Remote Branches</span>
          <span className="badge">{remoteBranches.length}</span>
        </div>
        {remoteOpen && remoteBranches.map((b) => (
          <div key={b.name} className="branch-item remote">
            <span className="branch-name">{b.name}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-section">
        <div
          className="section-header clickable"
          onClick={() => setTagsOpen(!tagsOpen)}
        >
          {tagsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Tag size={12} />
          <span className="section-title">Tags</span>
        </div>
      </div>
    </div>
  );
}
