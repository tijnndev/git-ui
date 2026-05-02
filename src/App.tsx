import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import CommitGraph from "./components/CommitGraph";
import CommitDetail from "./components/CommitDetail";
import WorkingDirectory from "./components/WorkingDirectory";
import WelcomeScreen from "./components/WelcomeScreen";
import ResizableSplit from "./components/ResizableSplit";
import SettingsPage from "./components/SettingsPage";
import FileHistory from "./components/FileHistory";
import DiffViewer from "./components/DiffViewer";
import type { CommitInfo, BranchInfo, FileStatus, RepoSummary, RecentRepo, TagInfo, RepoCategory, FileDiff } from "./types";
import type { AppSettings } from "./settings";
import { loadSettings, saveSettings, DEFAULT_SETTINGS, applySettings } from "./settings";
import { storeGet, storeSet } from "./store";
import { nanoid } from "./nanoid";
import * as api from "./api";
import { loadAccounts, findAccountForUrl, injectToken } from "./github-accounts";
import { useToast } from "./toast";
import { describePullTooltip } from "./pullTooltip";

function repoName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

async function loadRecentRepos(): Promise<RecentRepo[]> {
  const raw = await storeGet<unknown[]>("recent_repos");
  if (!Array.isArray(raw) || raw.length === 0) return [];
  // Migrate from old string[] format
  if (typeof raw[0] === "string") {
    return (raw as string[]).map((p) => ({
      path: p, name: repoName(p), lastOpened: Date.now(), pinned: false,
    }));
  }
  return raw as RecentRepo[];
}

export default function App() {
  const toast = useToast();
  const [repoPath, setRepoPath] = useState<string | null>(null);
  const [repoSummary, setRepoSummary] = useState<RepoSummary | null>(null);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [status, setStatus] = useState<FileStatus[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadIdRef = useRef(0);
  const [recentRepos, setRecentRepos] = useState<RecentRepo[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [fileHistoryPath, setFileHistoryPath] = useState<string | null>(null);
  const [categories, setCategories] = useState<RepoCategory[]>([]);
  const [changesFile, setChangesFile] = useState<string | null>(null);
  const [changesStaged, setChangesStaged] = useState(false);
  const [changesDiff, setChangesDiff] = useState<FileDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(280);
  const rightDragging = useRef(false);
  const rightDragStartX = useRef(0);
  const rightDragStartW = useRef(0);

  const onRightHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    rightDragging.current = true;
    rightDragStartX.current = e.clientX;
    rightDragStartW.current = rightPanelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [rightPanelWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!rightDragging.current) return;
      const delta = rightDragStartX.current - e.clientX;
      setRightPanelWidth(Math.max(180, Math.min(520, rightDragStartW.current + delta)));
    };
    const onMouseUp = () => {
      if (!rightDragging.current) return;
      rightDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Load persisted data from store on first render
  useEffect(() => {
    loadSettings().then((s) => { setSettings(s); applySettings(s); });
    loadRecentRepos().then(setRecentRepos);
    storeGet<RepoCategory[]>("categories").then((c) => setCategories(c ?? []));
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const saveRecentRepos = useCallback((repos: RecentRepo[]) => {
    setRecentRepos(repos);
    storeSet("recent_repos", repos);
  }, []);

  const saveCategories = useCallback((cats: RepoCategory[]) => {
    setCategories(cats);
    storeSet("categories", cats);
  }, []);

  const handleCreateCategory = useCallback((cat: Omit<RepoCategory, "id">) => {
    saveCategories([...categories, { ...cat, id: nanoid() }]);
  }, [categories, saveCategories]);

  const handleUpdateCategory = useCallback((cat: RepoCategory) => {
    saveCategories(categories.map((c) => (c.id === cat.id ? cat : c)));
  }, [categories, saveCategories]);

  const handleDeleteCategory = useCallback((id: string) => {
    saveCategories(categories.filter((c) => c.id !== id));
    saveRecentRepos(recentRepos.map((r) => (r.categoryId === id ? { ...r, categoryId: null } : r)));
  }, [categories, saveCategories, recentRepos, saveRecentRepos]);

  const handleAssignCategory = useCallback((repoPath: string, categoryId: string | null) => {
    saveRecentRepos(recentRepos.map((r) => (r.path === repoPath ? { ...r, categoryId } : r)));
  }, [recentRepos, saveRecentRepos]);

  const handleBulkAssignCategory = useCallback((paths: string[], categoryId: string | null) => {
    const set = new Set(paths);
    saveRecentRepos(recentRepos.map((r) => (set.has(r.path) ? { ...r, categoryId } : r)));
  }, [recentRepos, saveRecentRepos]);

  const loadRepo = useCallback(async (path: string) => {
    const loadId = ++loadIdRef.current;
    // Show the repo page instantly — clear stale data synchronously so
    // React renders the skeleton UI in the same tick, before any await.
    setRepoPath(path);
    setRepoSummary(null);
    setCommits([]);
    setBranches([]);
    setTags([]);
    setStatus([]);
    setSelectedCommit(null);
    setChangesFile(null);
    setChangesDiff(null);
    setError(null);

    const existing = recentRepos.find((r) => r.path === path);
    const entry: RecentRepo = {
      path,
      name: repoName(path),
      lastOpened: Date.now(),
      pinned: existing?.pinned ?? false,
      categoryId: existing?.categoryId ?? null,
    };
    saveRecentRepos([entry, ...recentRepos.filter((r) => r.path !== path)].slice(0, 50));

    try {
      const [summary, fileStatus, allBranches, allTags] = await Promise.all([
        api.getRepoSummary(path),
        api.getStatus(path),
        api.getBranches(path),
        api.getTags(path),
      ]);
      if (loadId !== loadIdRef.current) return;
      setRepoSummary(summary);
      setStatus(fileStatus);
      setBranches(allBranches);
      setTags(allTags);

      const allCommits = await api.getAllCommits(path, 500);
      if (loadId !== loadIdRef.current) return;
      setCommits(allCommits);
    } catch (e) {
      if (loadId !== loadIdRef.current) return;
      setError(String(e));
    }
  }, [recentRepos, saveRecentRepos]);

  const openRepo = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      loadRepo(selected);
    }
  }, [loadRepo]);

  const openMultipleRepos = useCallback(async () => {
    const selected = await open({ directory: true, multiple: true });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    const now = Date.now();
    let updated = [...recentRepos];
    for (const p of paths) {
      if (!updated.find((r) => r.path === p)) {
        updated = [{ path: p, name: repoName(p), lastOpened: now, pinned: false, categoryId: null }, ...updated];
      }
    }
    saveRecentRepos(updated.slice(0, 50));
  }, [recentRepos, saveRecentRepos]);

  // refresh never resets anything
  const refresh = useCallback(async () => {
    if (!repoPath) return;
    loadRepo(repoPath);
  }, [repoPath, loadRepo]);

  const goHome = useCallback(() => {
    setRepoPath(null);
    setRepoSummary(null);
    setCommits([]);
    setBranches([]);
    setStatus([]);
    setTags([]);
    setSelectedCommit(null);
    setChangesFile(null);
    setChangesDiff(null);
    setError(null);
  }, []);

  const handleSelectChangesFile = useCallback(async (filePath: string, staged: boolean) => {
    if (!repoPath) return;
    setChangesFile(filePath);
    setChangesStaged(staged);
    setDiffLoading(true);
    setChangesDiff(null);
    try {
      const diffs = await api.getDiff(repoPath, undefined, staged);
      setChangesDiff(diffs.find((d) => d.path === filePath) ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setDiffLoading(false);
    }
  }, [repoPath]);

  const handlePull = useCallback(async () => {
    if (!repoPath || pulling) return;
    setPulling(true);
    setError(null);
    try {
      const categoryAccountId =
        categories.find(
          (c) => c.id === recentRepos.find((r) => r.path === repoPath)?.categoryId
        )?.accountId ?? null;

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
      refresh();
    } catch (e) {
      toast.error(String(e), 0);
    } finally {
      setPulling(false);
    }
  }, [repoPath, pulling, refresh, toast, categories, recentRepos]);

  const togglePin = useCallback((path: string) => {
    const updated = recentRepos.map((r) =>
      r.path === path ? { ...r, pinned: !r.pinned } : r
    );
    saveRecentRepos(updated);
  }, [recentRepos, saveRecentRepos]);

  const removeRecent = useCallback((path: string) => {
    saveRecentRepos(recentRepos.filter((r) => r.path !== path));
  }, [recentRepos, saveRecentRepos]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "r") {
        e.preventDefault();
        refresh();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [refresh]);

  // Auto-refresh unstaged changes every 3 seconds
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!repoPath) return;
    autoRefreshRef.current = setInterval(async () => {
      try {
        const newStatus = await api.getStatus(repoPath);
        setStatus((prev) => {
          const prevKey = prev.map((f) => `${f.path}:${f.status}:${f.staged}`).sort().join("|");
          const newKey = newStatus.map((f) => `${f.path}:${f.status}:${f.staged}`).sort().join("|");
          if (prevKey !== newKey) return newStatus;
          return prev;
        });
      } catch {
        // ignore errors during polling
      }
    }, 3000);
    return () => {
      if (autoRefreshRef.current !== null) clearInterval(autoRefreshRef.current);
    };
  }, [repoPath]);

  const pullTooltip = useMemo(
    () => describePullTooltip(repoSummary?.head_branch ?? null, branches),
    [repoSummary?.head_branch, branches],
  );

  if (!repoPath) {
    return (
      <div className="app">
        <TitleBar title="Git UI" repoPath={null} onOpenRepo={openRepo} onRefresh={() => {}} onGoHome={null} onOpenSettings={() => setShowSettings(true)} />
        <WelcomeScreen
          onOpenRepo={openRepo}
          onOpenMultiple={openMultipleRepos}
          recentRepos={recentRepos}
          categories={categories}
          onSelectRecent={(path) => loadRepo(path)}
          onPinToggle={togglePin}
          onRemove={removeRecent}
          onCreateCategory={handleCreateCategory}
          onUpdateCategory={handleUpdateCategory}
          onDeleteCategory={handleDeleteCategory}
          onAssignCategory={handleAssignCategory}
          onBulkAssignCategory={handleBulkAssignCategory}
          onAddToLaunchpad={(path) => {
            const name = repoName(path);
            if (!recentRepos.find((r) => r.path === path)) {
              saveRecentRepos([{ path, name, lastOpened: Date.now(), pinned: false, categoryId: null }, ...recentRepos].slice(0, 50));
            }
          }}
        />
        {showSettings && (
          <SettingsPage
            settings={settings}
            onSave={(s) => { saveSettings(s); applySettings(s); setSettings(s); setShowSettings(false); }}  // saveSettings is async but fire-and-forget is fine here
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <TitleBar
        title={repoSummary?.head_branch ?? "Git UI"}
        repoPath={repoPath}
        onOpenRepo={openRepo}
        onRefresh={refresh}
        onGoHome={goHome}
        onOpenSettings={() => setShowSettings(true)}
        onPull={handlePull}
        pulling={pulling}
        pullTooltip={pullTooltip}
      />
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ display: "flex", alignItems: "center" }}><X size={12} /></button>
        </div>
      )}
      <div className="main-layout">
        <Sidebar
          branches={branches}
          tags={tags}
          repoPath={repoPath}
          onCheckout={async (branch) => {
            try {
              await api.checkoutBranch(repoPath, branch);
              refresh();
            } catch (e) {
              setError(String(e));
              throw e;
            }
          }}
          onMerge={async (branch) => {
            try {
              await api.mergeBranch(repoPath, branch);
              refresh();
            } catch (e) {
              setError(String(e));
            }
          }}
          onRename={async (oldName, newName) => {
            try {
              await api.renameBranch(repoPath, oldName, newName);
              refresh();
            } catch (e) {
              setError(String(e));
            }
          }}
          onRefresh={refresh}
          repoSummary={repoSummary}
          categoryAccountId={
            categories.find(
              (c) => c.id === recentRepos.find((r) => r.path === repoPath)?.categoryId
            )?.accountId ?? null
          }
        />
        <div className="content-area">
          <ResizableSplit
              top={
                changesDiff || diffLoading ? (
                  <div className="diff-main-area">
                    <div className="diff-back-bar">
                      <button className="diff-back-btn" onClick={() => { setChangesFile(null); setChangesDiff(null); }} title="Back to graph">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </button>
                      <span className="diff-back-path">{changesFile}</span>
                    </div>
                    {diffLoading ? (
                      <div className="loading-overlay"><div className="spinner" /></div>
                    ) : changesDiff ? (
                      <div className="diff-panel" style={{ flex: 1, overflow: "auto" }}>
                        <DiffViewer diff={changesDiff} />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <CommitGraph
                    commits={commits}
                    branches={branches}
                    tags={tags}
                    selectedCommit={selectedCommit}
                    onSelectCommit={setSelectedCommit}
                    settings={settings}
                  />
                )
              }
              bottom={
                selectedCommit ? (
                  <CommitDetail
                    commit={selectedCommit}
                    repoPath={repoPath}
                    onClose={() => setSelectedCommit(null)}
                    onRefresh={refresh}
                    onOpenFileHistory={setFileHistoryPath}
                  />
                ) : (
                  <div className="empty-state">
                    <span>Select a commit to view details</span>
                  </div>
                )
              }
            />
          </div>
        <div
          className="resizable-handle-v"
          onMouseDown={onRightHandleMouseDown}
        >
          <div className="resizable-handle-grip-v" />
        </div>
        <WorkingDirectory
          repoPath={repoPath}
          status={status}
          onRefresh={refresh}
          categoryAccountId={
            categories.find(
              (c) => c.id === recentRepos.find((r) => r.path === repoPath)?.categoryId
            )?.accountId ?? null
          }
          selectedFile={changesFile}
          selectedStaged={changesStaged}
          onSelectFile={handleSelectChangesFile}
          width={rightPanelWidth}
        />
      </div>
      {showSettings && (
        <SettingsPage
          settings={settings}
          onSave={(s) => { saveSettings(s); applySettings(s); setSettings(s); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
        />
      )}
      {fileHistoryPath && repoPath && (
        <FileHistory
          repoPath={repoPath}
          filePath={fileHistoryPath}
          onClose={() => setFileHistoryPath(null)}
          onSelectCommit={(c) => { setSelectedCommit(c); setFileHistoryPath(null); }}
        />
      )}
    </div>
  );
}
