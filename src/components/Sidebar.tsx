import { useState, useEffect, useMemo } from "react";
import {
  GitBranch, Tag, Package, Cloud, ChevronDown,
  ChevronRight, Plus, Trash2, Check, Circle,
  GitMerge, Edit2, X, RefreshCw, Link, Upload, Download, Shuffle
} from "lucide-react";
import type { BranchInfo, RepoSummary, TagInfo, StashInfo, RemoteInfo, BranchAheadBehind } from "../types";
import * as api from "../api";
import { useToast } from "../toast";
import { loadAccounts, findAccountForUrl, injectToken } from "../github-accounts";
import { describePullTooltip } from "../pullTooltip";

interface Props {
  branches: BranchInfo[];
  tags: TagInfo[];
  repoPath: string;
  onCheckout: (branch: string) => void;
  onMerge: (branch: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onRefresh: () => void;
  repoSummary: RepoSummary | null;
  categoryAccountId?: string | null;
}
export default function Sidebar({
  branches, tags, repoPath, onCheckout, onMerge, onRename, onRefresh, repoSummary, categoryAccountId
}: Props) {
  const [localOpen, setLocalOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [stashOpen, setStashOpen] = useState(false);
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchBasedOn, setNewBranchBasedOn] = useState("");
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
  const [pushingBranch, setPushingBranch] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [aheadBehind, setAheadBehind] = useState<Map<string, { ahead: number; behind: number }>>(new Map());
  const [pushingTag, setPushingTag] = useState<string | null>(null);
  const [deletingRemoteBranch, setDeletingRemoteBranch] = useState<string | null>(null);
  const [checkoutPending, setCheckoutPending] = useState<string | null>(null);
  const [branchContextMenu, setBranchContextMenu] = useState<{ branch: string; isHead: boolean; x: number; y: number } | null>(null);
  const toast = useToast();

  const loadRemotes = () => {
    api.getRemotes(repoPath).then(setRemotes).catch(() => setRemotes([]));
  };

  const loadAheadBehind = () => {
    api.getBranchesAheadBehind(repoPath).then((data) => {
      const m = new Map<string, { ahead: number; behind: number }>();
      data.forEach((ab: BranchAheadBehind) => m.set(ab.name, { ahead: ab.ahead, behind: ab.behind }));
      setAheadBehind(m);
    }).catch(() => {});
  };

  const localBranches = branches.filter((b) => !b.is_remote);
  const remoteBranches = branches.filter((b) => b.is_remote);

  const headBranchName = repoSummary?.head_branch ?? null;
  // Prefer summary (true HEAD symref); avoid localBranches.find(is_head) alone - multiple
  // branches can share HEAD's commit and the first match was often wrong (e.g. main).
  const currentLocalBranchName =
    headBranchName && !headBranchName.startsWith("HEAD detached")
      ? headBranchName
      : localBranches.find((b) => b.is_head)?.name ?? "";

  const sortedLocalBranches = useMemo(
    () =>
      [...localBranches].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [localBranches],
  );

  const sortedRemoteBranches = useMemo(
    () =>
      [...remoteBranches].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [remoteBranches],
  );

  /** Remotes shown in branch picker: drop symbolic refs like origin/HEAD and branches already present as locals. */
  const remotesForBranchPicker = useMemo(() => {
    const localNames = new Set(localBranches.map((b) => b.name));
    return sortedRemoteBranches.filter((r) => {
      if (r.name.endsWith("/HEAD")) return false;
      const i = r.name.indexOf("/");
      if (i === -1) return true;
      const tail = r.name.slice(i + 1);
      if (localNames.has(tail)) return false;
      return true;
    });
  }, [sortedRemoteBranches, localBranches]);

  const allBranchesForBase = useMemo(
    () => [...sortedLocalBranches, ...remotesForBranchPicker],
    [sortedLocalBranches, remotesForBranchPicker],
  );

  const hasBranchChoices =
    sortedLocalBranches.length + remotesForBranchPicker.length > 0;

  const handleBranchSelect = async (value: string) => {
    if (!value || checkoutPending) return;
    if (value === currentLocalBranchName) return;
    const isRemote = remoteBranches.some((r) => r.name === value);
    setCheckoutPending(value);
    try {
      if (isRemote) {
        await api.checkoutRemoteBranch(repoPath, value);
        onRefresh();
      } else {
        await onCheckout(value);
      }
    } catch (e) {
      if (isRemote) {
        toast.error(String(e), 0);
      }
      // local: App sets error banner via onCheckout throw
    } finally {
      setCheckoutPending(null);
    }
  };

  useEffect(() => {
    if (!repoPath) return;
    api.getStashes(repoPath).then(setStashes).catch(() => setStashes([]));
    loadRemotes();
    loadAheadBehind();
  }, [repoPath]);

  useEffect(() => {
    if (!branchContextMenu) return;
    const close = () => setBranchContextMenu(null);
    const closeOnEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setBranchContextMenu(null); };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", closeOnEsc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", closeOnEsc);
    };
  }, [branchContextMenu]);

  const submitNewBranch = async () => {
    const name = newBranchName.trim();
    if (!name) return;
    if (!allBranchesForBase.length) {
      toast.error("Fetch the repository to load branches first.", 0);
      return;
    }
    const base = allBranchesForBase.find((b) => b.name === newBranchBasedOn);
    try {
      await api.createBranch(repoPath, name, base?.tip_oid);
      setNewBranchName("");
      setShowNewBranch(false);
      await onCheckout(name);
      onRefresh();
    } catch (e) {
      toast.error(String(e), 0);
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

  const handleStashApply = async (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    try {
      await api.stashApply(repoPath, index);
      onRefresh();
    } catch (e) { alert(String(e)); }
  };

  const handlePushBranch = async (e: React.MouseEvent, branchName: string) => {
    e.stopPropagation();
    setPushingBranch(branchName);
    try {
      let username: string | undefined;
      let token: string | undefined;
      if (categoryAccountId) {
        const accounts = await loadAccounts();
        const acc = accounts.find((a) => a.id === categoryAccountId);
        if (!acc) {
          toast.error("No GitHub account found for this category. Go to Settings → GitHub Accounts and re-add your account.", 0);
          return;
        }
        username = acc.username;
        token = acc.token;
      }
      await api.pushUpstream(repoPath, "origin", branchName, username, token);
      onRefresh();
    } catch (ex) { toast.error(String(ex), 0); }
    finally { setPushingBranch(null); }
  };

  const handleForcePush = async (e: React.MouseEvent, branchName: string) => {
    e.stopPropagation();
    if (!confirm(`Force-push "${branchName}" to origin? (uses --force-with-lease)`)) return;
    setPushingBranch(branchName);
    try {
      let username: string | undefined;
      let token: string | undefined;
      if (categoryAccountId) {
        const accounts = await loadAccounts();
        const acc = accounts.find((a) => a.id === categoryAccountId);
        if (!acc) {
          toast.error("No GitHub account found for this category. Go to Settings → GitHub Accounts and re-add your account.", 0);
          return;
        }
        username = acc.username;
        token = acc.token;
      }
      await api.forcePush(repoPath, "origin", branchName, username, token);
      onRefresh();
    } catch (ex) { toast.error(String(ex), 0); }
    finally { setPushingBranch(null); }
  };

  const handlePull = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setPulling(true);
    try {
      let remoteArg: string | undefined;
      try {
        const remoteUrl = await api.getRemoteUrl(repoPath, "origin");
        const accounts = await loadAccounts();
        const account =
          (categoryAccountId ? accounts.find((a) => a.id === categoryAccountId) : null)
          ?? findAccountForUrl(remoteUrl, accounts);

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
        // No remote configured – fall back to plain pull
      }

      const msg = await api.gitPull(repoPath, remoteArg);
      toast.success(msg?.trim() || "Already up to date");
      onRefresh();
    } catch (ex) { toast.error(String(ex), 0); }
    finally { setPulling(false); }
  };

  const handleRebaseBranch = async (e: React.MouseEvent, branchName: string) => {
    e.stopPropagation();
    if (!confirm(`Rebase current branch onto "${branchName}"?`)) return;
    try { await api.rebaseBranch(repoPath, branchName); onRefresh(); }
    catch (ex) { alert(String(ex)); }
  };

  const handleCheckoutRemote = async (e: React.MouseEvent, remoteBranch: string) => {
    e.stopPropagation();
    try { await api.checkoutRemoteBranch(repoPath, remoteBranch); onRefresh(); }
    catch (ex) { alert(String(ex)); }
  };

  const handleSquashMerge = async (e: React.MouseEvent, branchName: string) => {
    e.stopPropagation();
    if (!confirm(`Squash-merge "${branchName}" into current branch? Changes will be staged but not committed.`)) return;
    try {
      const msg = await api.squashMerge(repoPath, branchName);
      alert(msg);
      onRefresh();
    } catch (ex) { alert(String(ex)); }
  };

  const handlePushTag = async (e: React.MouseEvent, tagName: string) => {
    e.stopPropagation();
    setPushingTag(tagName);
    try { await api.pushTag(repoPath, tagName); }
    catch (ex) { alert(String(ex)); }
    finally { setPushingTag(null); }
  };

  const handlePushAllTags = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try { await api.pushAllTags(repoPath); }
    catch (ex) { alert(String(ex)); }
  };

  const handleDeleteRemoteBranch = async (e: React.MouseEvent, fullName: string) => {
    e.stopPropagation();
    // fullName is "origin/feature" - split into remote + branch
    const slash = fullName.indexOf("/");
    if (slash === -1) return;
    const remote = fullName.slice(0, slash);
    const branch = fullName.slice(slash + 1);
    if (!confirm(`Delete remote branch "${fullName}"? This cannot be undone.`)) return;
    setDeletingRemoteBranch(fullName);
    try { await api.deleteRemoteBranch(repoPath, remote, branch); onRefresh(); }
    catch (ex) { alert(String(ex)); }
    finally { setDeletingRemoteBranch(null); }
  };

  return (
    <>
    <div className="sidebar">
      <div className="sidebar-section">
        <div className="section-header">
          <span className="section-title">Repository</span>
          <button
            className={`icon-btn${pulling ? " spin-btn" : ""}`}
            title={describePullTooltip(repoSummary?.head_branch ?? null, branches)}
            onClick={handlePull}
          >
            <Download size={12} className={pulling ? "spin" : ""} />
          </button>
        </div>
        <div className="repo-info repo-branch-toolbar">
          <div className="branch-select-row">
            <GitBranch size={14} className="branch-select-icon" aria-hidden />
            <select
              className="branch-select"
              aria-label="Current branch"
              value={currentLocalBranchName}
              disabled={!!checkoutPending || !hasBranchChoices}
              onChange={(e) => {
                const v = e.target.value;
                if (v) void handleBranchSelect(v);
              }}
            >
              {!currentLocalBranchName && hasBranchChoices && (
                <option value="" disabled>
                  Detached HEAD - select branch
                </option>
              )}
              {!hasBranchChoices && (
                <option value="">(no branches - fetch remotes)</option>
              )}
              {sortedLocalBranches.length > 0 && (
                <optgroup label="Local">
                  {sortedLocalBranches.map((b) => (
                    <option key={`local:${b.name}`} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {remotesForBranchPicker.length > 0 && (
                <optgroup label="Remote">
                  {remotesForBranchPicker.map((b) => (
                    <option key={`remote:${b.name}`} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              type="button"
              className="icon-btn branch-add-btn"
              title="New branch…"
              onClick={() => {
                if (showNewBranch) {
                  setShowNewBranch(false);
                  return;
                }
                setNewBranchBasedOn(
                  currentLocalBranchName ||
                    sortedLocalBranches[0]?.name ||
                    remotesForBranchPicker[0]?.name ||
                    "",
                );
                setShowNewBranch(true);
              }}
            >
              <Plus size={14} />
            </button>
          </div>
          {showNewBranch && (
            <div className="new-branch-panel">
              <input
                className="new-branch-panel-input"
                autoFocus
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="Name of new branch…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitNewBranch();
                  if (e.key === "Escape") {
                    setShowNewBranch(false);
                    setNewBranchName("");
                  }
                }}
              />
              <label className="new-branch-panel-label">
                Based on
                <select
                  className="branch-select branch-select-inline"
                  value={
                    allBranchesForBase.some((b) => b.name === newBranchBasedOn)
                      ? newBranchBasedOn
                      : allBranchesForBase[0]?.name ?? ""
                  }
                  onChange={(e) => setNewBranchBasedOn(e.target.value)}
                >
                  {sortedLocalBranches.length > 0 && (
                    <optgroup label="Local">
                      {sortedLocalBranches.map((b) => (
                        <option key={`nb:local:${b.name}`} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {remotesForBranchPicker.length > 0 && (
                    <optgroup label="Remote">
                      {remotesForBranchPicker.map((b) => (
                        <option key={`nb:remote:${b.name}`} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              <div className="new-branch-panel-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowNewBranch(false);
                    setNewBranchName("");
                  }}
                >
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={() => void submitNewBranch()}>
                  Create branch
                </button>
              </div>
            </div>
          )}
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
        </div>

        {localOpen && localBranches.map((b) => (
          <div
            key={b.name}
            className={`branch-item ${b.is_head ? "active" : ""}${checkoutPending === b.name ? " branch-item-checkout-pending" : ""}`}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setBranchContextMenu({ branch: b.name, isHead: b.is_head, x: e.clientX, y: e.clientY });
            }}
          >
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
                <span className="branch-item-label">
                  {b.is_head && <span className="head-indicator"><Circle size={7} fill="currentColor" /></span>}
                  <span className="branch-name">{b.name}</span>
                  {checkoutPending === b.name && (
                    <RefreshCw size={11} className="branch-checkout-spinner spin" aria-hidden />
                  )}
                  {(() => { const ab = aheadBehind.get(b.name); return ab && (ab.ahead > 0 || ab.behind > 0) ? (
                    <span className="branch-ab">
                      {ab.ahead > 0 && <span title={`${ab.ahead} commit(s) ahead`}>↑{ab.ahead}</span>}
                      {ab.behind > 0 && <span title={`${ab.behind} commit(s) behind`}>↓{ab.behind}</span>}
                    </span>
                  ) : null; })()}
                </span>
                <button
                  className={`icon-btn${pushingBranch === b.name ? " spin-btn" : ""}`}
                  onClick={(e) => handlePushBranch(e, b.name)}
                  title={`Push ${b.name}`}
                >
                  <Upload size={10} className={pushingBranch === b.name ? "spin" : ""} />
                </button>
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
        {remoteOpen && remotesForBranchPicker.length > 0 && (
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4 }}>
            {remotesForBranchPicker.map((b) => (
              <div key={b.name} className="branch-item remote" style={{ paddingLeft: 20 }}>
                <GitBranch size={10} style={{ opacity: 0.5, flexShrink: 0 }} />
                <span className="branch-name" style={{ flex: 1 }}>{b.name}</span>
                <button
                  className="icon-btn"
                  title={`Create a local branch tracking ${b.name}`}
                  onClick={(e) => handleCheckoutRemote(e, b.name)}
                >
                  <GitBranch size={10} />
                </button>
                <button
                  className={`icon-btn danger${deletingRemoteBranch === b.name ? " spin-btn" : ""}`}
                  title={`Delete remote branch ${b.name}`}
                  onClick={(e) => handleDeleteRemoteBranch(e, b.name)}
                >
                  <Trash2 size={10} />
                </button>
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
            onClick={(e) => handlePushAllTags(e)}
            title="Push all tags to origin"
          >
            <Upload size={11} />
          </button>
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
            <span className="branch-name" style={{ flex: 1 }}>{t.name}</span>
            <button
              className={`icon-btn${pushingTag === t.name ? " spin-btn" : ""}`}
              title={`Push tag ${t.name} to origin`}
              onClick={(e) => handlePushTag(e, t.name)}
            >
              <Upload size={10} className={pushingTag === t.name ? "spin" : ""} />
            </button>
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
              title="Apply stash (keep in stash list)"
              onClick={(e) => handleStashApply(e, s.index)}
            >
              <Download size={10} />
            </button>
            <button
              className="icon-btn"
              title="Pop stash (apply & remove)"
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

    {branchContextMenu && (
      <div
        className="branch-context-menu"
        style={{ top: branchContextMenu.y, left: branchContextMenu.x }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button onClick={(e) => { handlePushBranch(e, branchContextMenu.branch); setBranchContextMenu(null); }}>
          <Upload size={12} /> Push {branchContextMenu.branch}
        </button>
        <button onClick={(e) => { handleForcePush(e, branchContextMenu.branch); setBranchContextMenu(null); }}>
          <Upload size={12} style={{ opacity: 0.5 }} /> Force-push {branchContextMenu.branch}
        </button>
        <button onClick={(e) => { startRename(e, branchContextMenu.branch); setBranchContextMenu(null); }}>
          <Edit2 size={12} /> Rename
        </button>
        {!branchContextMenu.isHead && (
          <>
            <div className="branch-context-menu-separator" />
            <button onClick={(e) => { void (async () => { setBranchContextMenu(null); await handleRebaseBranch(e, branchContextMenu.branch); })(); }}>
              <Shuffle size={12} /> Rebase current onto {branchContextMenu.branch}
            </button>
            <button onClick={(e) => { void (async () => { setBranchContextMenu(null); await handleSquashMerge(e, branchContextMenu.branch); })(); }}>
              <GitMerge size={12} style={{ opacity: 0.6 }} /> Squash-merge into current
            </button>
            <button onClick={(e) => { e.stopPropagation(); setBranchContextMenu(null); onMerge(branchContextMenu.branch); }}>
              <GitMerge size={12} /> Merge into current
            </button>
            <div className="branch-context-menu-separator" />
            <button className="danger" onClick={(e) => { void (async () => { setBranchContextMenu(null); await handleDeleteBranch(e, branchContextMenu.branch); })(); }}>
              <Trash2 size={12} /> Delete {branchContextMenu.branch}
            </button>
          </>
        )}
      </div>
    )}
    </>
  );
}
