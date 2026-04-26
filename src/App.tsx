import { useState, useEffect, useCallback } from "react";
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
import type { CommitInfo, BranchInfo, FileStatus, RepoSummary, RecentRepo, TagInfo, RepoCategory } from "./types";
import type { AppSettings } from "./settings";
import { loadSettings, saveSettings, DEFAULT_SETTINGS, applySettings } from "./settings";
import { storeGet, storeSet } from "./store";
import { nanoid } from "./nanoid";
import * as api from "./api";
import { useToast } from "./toast";

export type Tab = "graph" | "working";

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
  const [activeTab, setActiveTab] = useState<Tab>("graph");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentRepos, setRecentRepos] = useState<RecentRepo[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [fileHistoryPath, setFileHistoryPath] = useState<string | null>(null);
  const [categories, setCategories] = useState<RepoCategory[]>([]);

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

  // resetTab=true when opening a new repo, false when just refreshing
  const loadRepo = useCallback(async (path: string, resetTab = true) => {
    setLoading(true);
    setError(null);
    try {
      const [summary, allCommits, allBranches, fileStatus, allTags] = await Promise.all([
        api.getRepoSummary(path),
        api.getAllCommits(path, 500),
        api.getBranches(path),
        api.getStatus(path),
        api.getTags(path),
      ]);
      setRepoPath(path);
      setRepoSummary(summary);
      setCommits(allCommits);
      setBranches(allBranches);
      setStatus(fileStatus);
      setTags(allTags);
      setSelectedCommit(null);
      if (resetTab) setActiveTab("graph");

      const existing = recentRepos.find((r) => r.path === path);
      const entry: RecentRepo = {
        path,
        name: repoName(path),
        lastOpened: Date.now(),
        pinned: existing?.pinned ?? false,
        categoryId: existing?.categoryId ?? null,
      };
      const updated = [entry, ...recentRepos.filter((r) => r.path !== path)].slice(0, 20);
      saveRecentRepos(updated);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [recentRepos, saveRecentRepos]);

  const openRepo = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      loadRepo(selected, true);
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

  // refresh never resets the active tab
  const refresh = useCallback(async () => {
    if (!repoPath) return;
    loadRepo(repoPath, false);
  }, [repoPath, loadRepo]);

  const goHome = useCallback(() => {
    setRepoPath(null);
    setRepoSummary(null);
    setCommits([]);
    setBranches([]);
    setStatus([]);
    setTags([]);
    setSelectedCommit(null);
    setError(null);
  }, []);

  const handlePull = useCallback(async () => {
    if (!repoPath || pulling) return;
    setPulling(true);
    setError(null);
    try {
      const msg = await api.gitPull(repoPath);
      toast.success(msg?.trim() || "Already up to date");
      refresh();
    } catch (e) {
      toast.error(String(e), 0);
    } finally {
      setPulling(false);
    }
  }, [repoPath, pulling, refresh, toast]);

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

  if (!repoPath) {
    return (
      <div className="app">
        <TitleBar title="Git UI" repoPath={null} onOpenRepo={openRepo} onRefresh={() => {}} onGoHome={null} onOpenSettings={() => setShowSettings(true)} />
        <WelcomeScreen
          onOpenRepo={openRepo}
          onOpenMultiple={openMultipleRepos}
          recentRepos={recentRepos}
          categories={categories}
          onSelectRecent={(path) => loadRepo(path, true)}
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
        onOpenSettings={() => setShowSettings(true)}        onPull={handlePull}
        pulling={pulling}      />
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
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onCheckout={async (branch) => {
            await api.checkoutBranch(repoPath, branch);
            refresh();
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
        />
        <div className="content-area">
          {loading ? (
            <div className="loading-overlay">
              <div className="spinner" />
              <span>Loading repository...</span>
            </div>
          ) : activeTab === "working" ? (
            <WorkingDirectory
              repoPath={repoPath}
              status={status}
              onRefresh={refresh}
            />
          ) : (
            <ResizableSplit
              top={
                <CommitGraph
                  commits={commits}
                  branches={branches}
                  tags={tags}
                  selectedCommit={selectedCommit}
                  onSelectCommit={setSelectedCommit}
                  settings={settings}
                />
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
          )}
        </div>
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
          onSelectCommit={(c) => { setSelectedCommit(c); setFileHistoryPath(null); setActiveTab("graph"); }}
        />
      )}
    </div>
  );
}
