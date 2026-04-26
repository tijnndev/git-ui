import { useState, useRef, useEffect } from "react";
import { FolderOpen, FolderPlus, Star, Trash2, GitBranch, Clock, Plus, Tag, Edit2, Key, X, CheckSquare, Square, MoveRight, Search, Download, FolderSearch, FolderCog } from "lucide-react";
import type { RecentRepo, RepoCategory } from "../types";
import { loadAccounts, injectToken } from "../github-accounts";
import type { GitHubAccount } from "../github-accounts";
import { getStatus, cloneRepo, openInExplorer, getHeadBehind } from "../api";
import { open } from "@tauri-apps/plugin-dialog";

const PRESET_COLORS = [
  "#009280", "#6366f1", "#f05050", "#e8b84b",
  "#00c896", "#818cf8", "#f97316", "#ec4899",
];

// ── Helpers ──────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ── Clone Dialog ─────────────────────────────────────────────

interface GhRepo {
  id: number;
  name: string;
  full_name: string;
  clone_url: string;
  ssh_url: string;
  description: string | null;
  private: boolean;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  owner: { login: string };
}

interface CloneDialogProps {
  onClose: () => void;
  onCloned: (path: string) => void;
  existingRepoNames: Set<string>;
}

function CloneDialog({ onClose, onCloned, existingRepoNames }: CloneDialogProps) {
  const [accounts, setAccounts] = useState<GitHubAccount[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [reposByOwner, setReposByOwner] = useState<Map<string, GhRepo[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<GhRepo | null>(null);
  const [dest, setDest] = useState("");
  const [folderName, setFolderName] = useState("");
  const [useSSH, setUseSSH] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;

  // Load accounts from persistent store on mount
  useEffect(() => {
    loadAccounts().then((list) => {
      setAccounts(list);
      if (list.length > 0) setAccountId((prev) => prev || list[0].id);
    });
  }, []);

  // Fetch all repos (personal + orgs) whenever account changes
  useEffect(() => {
    if (!selectedAccount?.token) { setReposByOwner(new Map()); return; }
    setLoading(true);
    setFetchError(null);
    setSelected(null);
    setReposByOwner(new Map());

    const headers = { Authorization: `token ${selectedAccount.token}`, Accept: "application/vnd.github+json" };

    const fetchAllPages = async (): Promise<GhRepo[]> => {
      let page = 1;
      let all: GhRepo[] = [];
      while (true) {
        const res = await fetch(
          `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
          { headers }
        );
        if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
        const data: GhRepo[] = await res.json();
        all = [...all, ...data];
        if (data.length < 100) break;
        page++;
      }
      return all;
    };

    fetchAllPages()
      .then((repos) => {
        // Group by owner.login; personal first, then orgs alphabetically
        const username = selectedAccount.username.toLowerCase();
        const grouped = new Map<string, GhRepo[]>();
        // Personal first
        for (const r of repos) {
          if (r.owner.login.toLowerCase() === username) {
            if (!grouped.has(r.owner.login)) grouped.set(r.owner.login, []);
            grouped.get(r.owner.login)!.push(r);
          }
        }
        // Then orgs alphabetically
        const orgEntries: [string, GhRepo[]][] = [];
        for (const r of repos) {
          if (r.owner.login.toLowerCase() !== username) {
            const existing = orgEntries.find(([k]) => k === r.owner.login);
            if (existing) existing[1].push(r);
            else orgEntries.push([r.owner.login, [r]]);
          }
        }
        orgEntries.sort(([a], [b]) => a.localeCompare(b));
        for (const [org, orgRepos] of orgEntries) grouped.set(org, orgRepos);
        setReposByOwner(grouped);
      })
      .catch((e) => setFetchError(String(e)))
      .finally(() => setLoading(false));
  }, [accountId]);

  // Auto-set folder name when repo selected
  useEffect(() => {
    if (selected) setFolderName(selected.name);
  }, [selected]);

  const q = search.toLowerCase();
  // Build filtered sections: Map<owner, GhRepo[]>
  const filteredByOwner = new Map<string, GhRepo[]>();
  for (const [owner, repos] of reposByOwner) {
    const filtered = repos.filter((r) =>
      !existingRepoNames.has(r.name.toLowerCase()) &&
      (q === "" || r.full_name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q))
    );
    if (filtered.length > 0) filteredByOwner.set(owner, filtered);
  }

  const pickDest = async () => {
    const sel = await open({ directory: true, multiple: false });
    if (sel && typeof sel === "string") setDest(sel);
  };

  const handleClone = async () => {
    if (!selected || !dest || !folderName) return;
    let url = useSSH ? selected.ssh_url : selected.clone_url;
    if (!useSSH && selectedAccount) {
      url = injectToken(url, selectedAccount);
    }
    const finalDest = dest.replace(/\\/g, "/") + "/" + folderName;
    setCloning(true);
    setCloneError(null);
    try {
      await cloneRepo(url, finalDest);
      onCloned(finalDest);
    } catch (e) {
      setCloneError(String(e));
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal clone-modal">
        <div className="modal-header">
          <span>Clone Repository</span>
          <button className="icon-btn" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="clone-modal-body">
          {/* Left: repo browser */}
          <div className="clone-browser">
            {accounts.length === 0 ? (
              <div className="clone-no-accounts">
                No GitHub accounts configured.
                <br />Go to <strong>Settings → GitHub Accounts</strong> to add one.
              </div>
            ) : (
              <>
                {/* Account selector */}
                <div className="clone-account-bar">
                  {accounts.map((a) => (
                    <button
                      key={a.id}
                      className={`clone-account-btn${accountId === a.id ? " active" : ""}`}
                      onClick={() => setAccountId(a.id)}
                    >
                      <span className="clone-account-avatar">{(a.label || a.username)[0].toUpperCase()}</span>
                      {a.label || a.username}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="clone-search-row">
                  <Search size={13} className="clone-search-icon" />
                  <input
                    className="form-input clone-search-input"
                    placeholder="Search repositories…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Repo list */}
                <div className="clone-repo-list">
                  {loading && <div className="clone-list-hint">Loading repositories…</div>}
                  {fetchError && <div className="clone-list-hint error">{fetchError}</div>}
                  {!loading && !fetchError && filteredByOwner.size === 0 && (
                    <div className="clone-list-hint">No repositories found</div>
                  )}
                  {!loading && !fetchError && Array.from(filteredByOwner.entries()).map(([owner, repos]) => (
                    <div key={owner}>
                      <div className="clone-owner-header">{owner}</div>
                      {repos.map((r) => (
                        <button
                          key={r.id}
                          className={`clone-repo-item${selected?.id === r.id ? " active" : ""}`}
                          onClick={() => setSelected(r)}
                        >
                          <div className="clone-repo-item-top">
                            <span className="clone-repo-name">{r.name}</span>
                            {r.private && <span className="clone-repo-badge private">Private</span>}
                            {r.language && <span className="clone-repo-badge lang">{r.language}</span>}
                          </div>
                          {r.description && (
                            <div className="clone-repo-desc">{r.description}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right: clone options */}
          <div className="clone-options">
            {selected ? (
              <>
                <div className="clone-selected-name">
                  <GitBranch size={14} />
                  {selected.full_name}
                  {selected.private && <span className="clone-repo-badge private" style={{ marginLeft: 6 }}>Private</span>}
                </div>

                <div className="clone-url-toggle">
                  <button
                    className={`clone-url-tab${!useSSH ? " active" : ""}`}
                    onClick={() => setUseSSH(false)}
                  >HTTPS</button>
                  <button
                    className={`clone-url-tab${useSSH ? " active" : ""}`}
                    onClick={() => setUseSSH(true)}
                  >SSH</button>
                </div>
                <input
                  className="form-input"
                  readOnly
                  value={useSSH ? selected.ssh_url : selected.clone_url}
                  style={{ marginBottom: 12, fontSize: 11, color: "var(--text-muted)" }}
                />

                <label className="form-label">Destination folder</label>
                <div className="form-input-row" style={{ marginBottom: 12 }}>
                  <input
                    className="form-input"
                    placeholder="Choose a folder…"
                    value={dest}
                    readOnly
                    style={{ flex: 1, cursor: "pointer" }}
                    onClick={pickDest}
                  />
                  <button className="btn-secondary" style={{ flexShrink: 0 }} onClick={pickDest}>
                    <FolderSearch size={13} />
                  </button>
                </div>

                <label className="form-label">Folder name</label>
                <input
                  className="form-input"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  style={{ marginBottom: 6 }}
                />
                {dest && folderName && (
                  <div className="form-section-hint">Will clone into: {dest}/{folderName}</div>
                )}
                {cloneError && (
                  <div className="form-section-hint" style={{ color: "var(--danger)", marginTop: 8 }}>{cloneError}</div>
                )}
              </>
            ) : (
              <div className="clone-no-selection">
                <GitBranch size={32} />
                <p>Select a repository to clone</p>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={cloning}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleClone}
            disabled={!selected || !dest || !folderName || cloning}
          >
            <Download size={13} />
            {cloning ? "Cloning…" : "Clone"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Category Form Modal ──────────────────────────────────────

interface CategoryFormProps {
  initial?: RepoCategory;
  onSave: (cat: Omit<RepoCategory, "id">) => void;
  onClose: () => void;
}

function CategoryForm({ initial, onSave, onClose }: CategoryFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0]);
  const [accountId, setAccountId] = useState<string>(initial?.accountId ?? "");
  const [accounts, setAccounts] = useState<GitHubAccount[]>([]);

  useEffect(() => { loadAccounts().then(setAccounts); }, []);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      color,
      accountId: accountId || null,
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal category-form-modal">
        <div className="modal-header">
          <span>{initial ? "Edit Category" : "New Category"}</span>
          <button className="icon-btn" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body category-form-body">
          <label className="form-label">Name</label>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Work, Personal, Client"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />

          <label className="form-label" style={{ marginTop: 16 }}>Color</label>
          <div className="color-swatches">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch${color === c ? " selected" : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>

          <div className="form-section-header">
            <Key size={12} />
            Authentication
            <span className="form-section-hint">optional - uses accounts from Settings → GitHub Accounts</span>
          </div>

          {accounts.length === 0 ? (
            <p className="form-no-accounts">No accounts saved yet. Add one in <strong>Settings → GitHub Accounts</strong>.</p>
          ) : (
            <>
              <label className="form-label">Account</label>
              <select
                className="form-input form-select"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">- None -</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label ? `${a.label} (${a.username})` : a.username}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!name.trim()}>
            {initial ? "Save Changes" : "Create Category"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Repo Card ────────────────────────────────────────────────

interface RepoCardProps {
  repo: RecentRepo;
  categories: RepoCategory[];
  selected: boolean;
  selectionActive: boolean;
  hasDirty: boolean;
  hasBehind: boolean;
  onOpen: () => void;
  onPin: () => void;
  onRemove: () => void;
  onAssignCategory: (categoryId: string | null) => void;
  onToggleSelect: () => void;
  assignOpen: boolean;
  onOpenAssign: (e: React.MouseEvent) => void;
}

function RepoCard({ repo, categories, selected, selectionActive, hasDirty, hasBehind, onOpen, onPin, onRemove, onAssignCategory, onToggleSelect, assignOpen, onOpenAssign }: RepoCardProps) {
  const category = categories.find((c) => c.id === repo.categoryId);

  return (
    <div
      className={`launchpad-card${assignOpen ? " assign-active" : ""}${selected ? " card-selected" : ""}`}
      onClick={(e) => {
        if (selectionActive) { e.stopPropagation(); onToggleSelect(); return; }
        onOpen();
      }}
      style={category ? { borderLeftColor: category.color, borderLeftWidth: 3 } : undefined}
    >
      {/* Selection checkbox overlay */}
      <button
        className={`card-select-btn${selected ? " visible" : ""}`}
        title={selected ? "Deselect" : "Select"}
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
      >
        {selected ? <CheckSquare size={14} /> : <Square size={14} />}
      </button>

      <div
        className="launchpad-card-icon"
        style={category ? { background: `${category.color}22`, color: category.color } : undefined}
      >
        <GitBranch size={22} />
      </div>
      <div className="launchpad-card-info">
        <div className="launchpad-card-name">
            {repo.name}
            {hasDirty && <span className="repo-dirty-dot" title="Uncommitted changes" />}
            {hasBehind && <span className="repo-behind-dot" title="Commits to pull" />}
          </div>
        <div className="launchpad-card-path">{repo.path}</div>
        <div className="launchpad-card-meta">
          <Clock size={11} />
          {relativeTime(repo.lastOpened)}
          {category && (
            <span className="card-category-badge" style={{ background: `${category.color}22`, color: category.color }}>
              <span className="category-dot-sm" style={{ background: category.color }} />
              {category.name}
            </span>
          )}
        </div>
      </div>
      <div className="launchpad-card-actions" onClick={(e) => e.stopPropagation()}>
        <div className="assign-wrapper">
          <button
            className="launchpad-action-btn"
            title="Assign to category"
            onClick={onOpenAssign}
          >
            <Tag size={13} />
          </button>
          {assignOpen && (
            <div className="assign-dropdown">
              <div className="assign-dropdown-title">Assign to category</div>
              <button
                className={`assign-option${!repo.categoryId ? " active" : ""}`}
                onMouseDown={(e) => { e.stopPropagation(); onAssignCategory(null); }}
              >
                <span className="category-dot-sm" style={{ background: "var(--text-muted)" }} />
                None
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`assign-option${repo.categoryId === cat.id ? " active" : ""}`}
                  onMouseDown={(e) => { e.stopPropagation(); onAssignCategory(cat.id); }}
                >
                  <span className="category-dot-sm" style={{ background: cat.color }} />
                  {cat.name}
                  {cat.accountId && <Key size={10} style={{ marginLeft: "auto", color: "var(--text-muted)" }} />}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className={`launchpad-action-btn ${repo.pinned ? "pinned" : ""}`}
          title={repo.pinned ? "Unpin" : "Pin"}
          onClick={onPin}
        >
          <Star size={13} fill={repo.pinned ? "currentColor" : "none"} />
        </button>
        <button
          className="launchpad-action-btn"
          title="Open in Explorer"
          onClick={() => openInExplorer(repo.path).catch(() => {})}
        >
          <FolderCog size={13} />
        </button>
        <button
          className="launchpad-action-btn danger"
          title="Remove from list"
          onClick={onRemove}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

interface Props {
  onOpenRepo: () => void;
  onOpenMultiple: () => void;
  recentRepos: RecentRepo[];
  categories: RepoCategory[];
  onSelectRecent: (path: string) => void;
  onPinToggle: (path: string) => void;
  onRemove: (path: string) => void;
  onCreateCategory: (cat: Omit<RepoCategory, "id">) => void;
  onUpdateCategory: (cat: RepoCategory) => void;
  onDeleteCategory: (id: string) => void;
  onAssignCategory: (repoPath: string, categoryId: string | null) => void;
  onBulkAssignCategory: (paths: string[], categoryId: string | null) => void;
  onAddToLaunchpad: (path: string) => void;
}

export default function WelcomeScreen({
  onOpenRepo, onOpenMultiple, recentRepos, categories,
  onSelectRecent, onPinToggle, onRemove,
  onCreateCategory, onUpdateCategory, onDeleteCategory, onAssignCategory, onBulkAssignCategory,
  onAddToLaunchpad,
}: Props) {
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<RepoCategory | null>(null);
  const [assignDropdownFor, setAssignDropdownFor] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const bulkMenuRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [dirtyPaths, setDirtyPaths] = useState<Set<string>>(new Set());
  const [behindPaths, setBehindPaths] = useState<Set<string>>(new Set());
  const [ghAccounts, setGhAccounts] = useState<GitHubAccount[]>([]);

  useEffect(() => { loadAccounts().then(setGhAccounts); }, []);

  useEffect(() => {
    let cancelled = false;
    const paths = recentRepos.map((r) => r.path);
    (async () => {
      const results = await Promise.allSettled(paths.map((p) => getStatus(p)));
      if (cancelled) return;
      const dirty = new Set<string>();
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value.length > 0) dirty.add(paths[i]);
      });
      setDirtyPaths(dirty);
    })();
    // Check behind in parallel
    (async () => {
      const results = await Promise.allSettled(paths.map((p) => getHeadBehind(p)));
      if (cancelled) return;
      const behind = new Set<string>();
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value > 0) behind.add(paths[i]);
      });
      setBehindPaths(behind);
    })();
    return () => { cancelled = true; };
  }, [recentRepos]);

  const selectionActive = selectedPaths.size > 0;

  const toggleSelect = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  const clearSelection = () => { setSelectedPaths(new Set()); setBulkMenuOpen(false); };

  const bulkMove = (categoryId: string | null) => {
    onBulkAssignCategory([...selectedPaths], categoryId);
    clearSelection();
  };

  // Filter repos by search query
  const query = search.toLowerCase();
  const filteredRepos = query
    ? recentRepos.filter((r) => r.name.toLowerCase().includes(query) || r.path.toLowerCase().includes(query))
    : recentRepos;

  // Group repos by category
  const categoryRepos = new Map<string, RecentRepo[]>();
  const uncategorized: RecentRepo[] = [];
  for (const repo of filteredRepos) {
    if (repo.categoryId && categories.some((c) => c.id === repo.categoryId)) {
      const arr = categoryRepos.get(repo.categoryId) ?? [];
      arr.push(repo);
      categoryRepos.set(repo.categoryId, arr);
    } else {
      uncategorized.push(repo);
    }
  }

  const pinned = filteredRepos.filter((r) => r.pinned);

  function renderCard(repo: RecentRepo) {
    return (
      <RepoCard
        key={repo.path}
        repo={repo}
        categories={categories}
        selected={selectedPaths.has(repo.path)}
        selectionActive={selectionActive}
        hasDirty={dirtyPaths.has(repo.path)}
        hasBehind={behindPaths.has(repo.path)}
        onOpen={() => onSelectRecent(repo.path)}
        onPin={() => onPinToggle(repo.path)}
        onRemove={() => onRemove(repo.path)}
        onAssignCategory={(catId) => {
          onAssignCategory(repo.path, catId);
          setAssignDropdownFor(null);
        }}
        onToggleSelect={() => toggleSelect(repo.path)}
        assignOpen={assignDropdownFor === repo.path}
        onOpenAssign={(e) => {
          e.stopPropagation();
          setAssignDropdownFor((prev) => (prev === repo.path ? null : repo.path));
        }}
      />
    );
  }

  return (
    <div className="launchpad">
      {/* Backdrop to close assign dropdown - rendered before everything else */}
      {assignDropdownFor && (
        <div
          className="launchpad-backdrop"
          onMouseDown={() => setAssignDropdownFor(null)}
        />
      )}

      <div className="launchpad-header">
        <div className="launchpad-logo">
          <GitBranch size={28} />
        </div>
        <div>
          <h1 className="launchpad-title">Git UI</h1>
          <p className="launchpad-subtitle">Your Git launchpad</p>
        </div>
        <div className="launchpad-header-actions">
          <button className="btn-secondary" onClick={() => setShowCategoryForm(true)}>
            <Plus size={13} />
            New Category
          </button>
          <button className="btn-secondary" onClick={() => setShowCloneDialog(true)}>
            <Download size={13} />
            Clone Repo
          </button>
          <button className="btn-secondary" onClick={onOpenMultiple}>
            <FolderPlus size={14} />
            Add Repos
          </button>
          <button className="btn-primary" onClick={onOpenRepo}>
            <FolderOpen size={15} />
            Open Repository
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="launchpad-search">
        <Search size={13} className="launchpad-search-icon" />
        <input
          className="launchpad-search-input"
          type="text"
          placeholder="Search repositories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        >
        </input>
        {search && (
          <button className="launchpad-search-clear" onClick={() => setSearch("")}>
            <X size={12} />
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selectionActive && (
        <div className="bulk-action-bar">
          <span className="bulk-count">{selectedPaths.size} selected</span>
          <div className="bulk-action-dropdown" ref={bulkMenuRef}>
            <button
              className="btn-secondary"
              onClick={() => setBulkMenuOpen((v) => !v)}
            >
              <MoveRight size={13} />
              Move to category
            </button>
            {bulkMenuOpen && (
              <div className="bulk-menu">
                <button className="assign-option" onMouseDown={() => { bulkMove(null); setBulkMenuOpen(false); }}>
                  <span className="category-dot-sm" style={{ background: "var(--text-muted)" }} />
                  Uncategorized
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    className="assign-option"
                    onMouseDown={() => { bulkMove(cat.id); setBulkMenuOpen(false); }}
                  >
                    <span className="category-dot-sm" style={{ background: cat.color }} />
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="icon-btn" title="Clear selection" onClick={clearSelection}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="launchpad-body">
        {recentRepos.length === 0 && categories.length === 0 ? (
          <div className="launchpad-empty">
            <GitBranch size={48} />
            <h2>No repositories yet</h2>
            <p>Open a repository to get started</p>
            <button className="btn-primary" onClick={onOpenRepo}>
              <FolderOpen size={15} />
              Open Repository
            </button>
          </div>
        ) : (
          <>
            {/* Pinned - shown only when no categories are defined */}
            {categories.length === 0 && pinned.length > 0 && (
              <section className="launchpad-section">
                <div className="launchpad-section-title">
                  <Star size={13} fill="currentColor" />
                  Pinned
                </div>
                <div className="launchpad-grid">
                  {pinned.map(renderCard)}
                </div>
              </section>
            )}

            {/* Category sections */}
            {categories.map((cat) => {
              const repos = categoryRepos.get(cat.id) ?? [];
              return (
                <section key={cat.id} className="launchpad-section">
                  <div className="launchpad-section-title launchpad-category-title">
                    <span className="category-dot" style={{ background: cat.color }} />
                    <span className="category-title-text">{cat.name}</span>
                    {cat.accountId && (() => {
                      const acc = ghAccounts.find((a) => a.id === cat.accountId);
                      return acc ? (
                        <span className="category-auth-badge" title={`Auth: ${acc.username}`}>
                          <Key size={10} />
                          {acc.label || acc.username}
                        </span>
                      ) : null;
                    })()}
                    <span className="section-count">{repos.length}</span>
                    <div className="category-title-actions">
                      <button
                        className="icon-btn"
                        title="Edit category"
                        onClick={() => setEditingCategory(cat)}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        className="icon-btn danger"
                        title="Delete category"
                        onClick={() => {
                          if (confirm(`Delete category "${cat.name}"? Repositories will become uncategorized.`)) {
                            onDeleteCategory(cat.id);
                          }
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  {repos.length > 0 ? (
                    <div className="launchpad-grid">
                      {repos.map(renderCard)}
                    </div>
                  ) : (
                    <div className="category-empty-hint">
                      No repositories - use the <Tag size={11} className="inline-icon" /> button on a repo card to assign it here.
                    </div>
                  )}
                </section>
              );
            })}

            {/* Recent (no categories) / Uncategorized (with categories) */}
            {categories.length === 0 ? (
              <section className="launchpad-section">
                <div className="launchpad-section-title">
                  <Clock size={13} />
                  {pinned.length > 0 ? "Recent" : "All Repositories"}
                </div>
                <div className="launchpad-grid">
                  {(pinned.length > 0 ? recentRepos.filter((r) => !r.pinned) : recentRepos).map(renderCard)}
                </div>
              </section>
            ) : (
              uncategorized.length > 0 && (
                <section className="launchpad-section">
                  <div className="launchpad-section-title">
                    <GitBranch size={13} />
                    Uncategorized
                    <span className="section-count">{uncategorized.length}</span>
                  </div>
                  <div className="launchpad-grid">
                    {uncategorized.map(renderCard)}
                  </div>
                </section>
              )
            )}
          </>
        )}
      </div>

      {(showCategoryForm || editingCategory) && (
        <CategoryForm
          initial={editingCategory ?? undefined}
          onSave={(cat) => {
            if (editingCategory) {
              onUpdateCategory({ ...cat, id: editingCategory.id });
            } else {
              onCreateCategory(cat);
            }
            setShowCategoryForm(false);
            setEditingCategory(null);
          }}
          onClose={() => {
            setShowCategoryForm(false);
            setEditingCategory(null);
          }}
        />
      )}
      {showCloneDialog && (
        <CloneDialog
          onClose={() => setShowCloneDialog(false)}
          existingRepoNames={new Set(recentRepos.map((r) => r.name.toLowerCase()))}
          onCloned={(path) => {
            onAddToLaunchpad(path);
            setShowCloneDialog(false);
          }}
        />
      )}
    </div>
  );
}

