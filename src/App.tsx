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
import type { CommitInfo, BranchInfo, FileStatus, RepoSummary, RecentRepo } from "./types";
import * as api from "./api";

export type Tab = "graph" | "working";

function repoName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function parseStoredRepos(): RecentRepo[] {
  try {
    const raw = JSON.parse(localStorage.getItem("recent_repos") || "[]");
    if (!Array.isArray(raw) || raw.length === 0) return [];
    // Migrate from old string[] format
    if (typeof raw[0] === "string") {
      return (raw as string[]).map((p) => ({
        path: p, name: repoName(p), lastOpened: Date.now(), pinned: false,
      }));
    }
    return raw as RecentRepo[];
  } catch {
    return [];
  }
}

export default function App() {
  const [repoPath, setRepoPath] = useState<string | null>(null);
  const [repoSummary, setRepoSummary] = useState<RepoSummary | null>(null);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [status, setStatus] = useState<FileStatus[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("graph");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentRepos, setRecentRepos] = useState<RecentRepo[]>(parseStoredRepos);

  const saveRecentRepos = useCallback((repos: RecentRepo[]) => {
    setRecentRepos(repos);
    localStorage.setItem("recent_repos", JSON.stringify(repos));
  }, []);

  // resetTab=true when opening a new repo, false when just refreshing
  const loadRepo = useCallback(async (path: string, resetTab = true) => {
    setLoading(true);
    setError(null);
    try {
      const [summary, allCommits, allBranches, fileStatus] = await Promise.all([
        api.getRepoSummary(path),
        api.getAllCommits(path, 500),
        api.getBranches(path),
        api.getStatus(path),
      ]);
      setRepoPath(path);
      setRepoSummary(summary);
      setCommits(allCommits);
      setBranches(allBranches);
      setStatus(fileStatus);
      setSelectedCommit(null);
      if (resetTab) setActiveTab("graph");

      const existing = recentRepos.find((r) => r.path === path);
      const entry: RecentRepo = {
        path,
        name: repoName(path),
        lastOpened: Date.now(),
        pinned: existing?.pinned ?? false,
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
    setSelectedCommit(null);
    setError(null);
  }, []);

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
        <TitleBar title="Git UI" repoPath={null} onOpenRepo={openRepo} onRefresh={() => {}} onGoHome={null} />
        <WelcomeScreen
          onOpenRepo={openRepo}
          recentRepos={recentRepos}
          onSelectRecent={(path) => loadRepo(path, true)}
          onPinToggle={togglePin}
          onRemove={removeRecent}
        />
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
          repoPath={repoPath}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onCheckout={async (branch) => {
            await api.checkoutBranch(repoPath, branch);
            refresh();
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
                  selectedCommit={selectedCommit}
                  onSelectCommit={setSelectedCommit}
                />
              }
              bottom={
                selectedCommit ? (
                  <CommitDetail
                    commit={selectedCommit}
                    repoPath={repoPath}
                    onClose={() => setSelectedCommit(null)}
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
    </div>
  );
}
