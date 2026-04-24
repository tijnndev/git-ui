import { getCurrentWindow } from "@tauri-apps/api/window";
import { FolderOpen, RefreshCw, Minus, Square, X, GitBranch, LayoutGrid, Settings } from "lucide-react";

// Stable reference — created once at module load, not per render
const appWindow = getCurrentWindow();

interface Props {
  title: string;
  repoPath: string | null;
  onOpenRepo: () => void;
  onRefresh: () => void;
  onGoHome: (() => void) | null;
  onOpenSettings: () => void;
}

export default function TitleBar({ title, repoPath, onOpenRepo, onRefresh, onGoHome, onOpenSettings }: Props) {

  return (
    <div className="titlebar">
      <div className="titlebar-left" data-tauri-drag-region>
        <div className="titlebar-icon">
          <GitBranch size={16} />
        </div>
        <span className="titlebar-title">{title}</span>
        {repoPath && (
          <span className="titlebar-path">{repoPath}</span>
        )}
      </div>
      <div className="titlebar-drag-fill" data-tauri-drag-region />
      <div className="titlebar-actions">
        {onGoHome && (
          <button className="titlebar-btn" onClick={onGoHome} title="Launchpad">
            <LayoutGrid size={14} />
          </button>
        )}
        <button className="titlebar-btn" onClick={onOpenRepo} title="Open Repository">
          <FolderOpen size={14} />
        </button>
        {repoPath && (
          <button className="titlebar-btn" onClick={onRefresh} title="Refresh (Ctrl+R)">
            <RefreshCw size={14} />
          </button>
        )}
        <button className="titlebar-btn" onClick={onOpenSettings} title="Settings">
          <Settings size={14} />
        </button>
      </div>
      <div className="titlebar-controls">
        <button className="win-btn minimize" onMouseDown={(e) => { e.stopPropagation(); appWindow.minimize(); }}>
          <Minus size={10} />
        </button>
        <button className="win-btn maximize" onMouseDown={(e) => { e.stopPropagation(); appWindow.toggleMaximize(); }}>
          <Square size={10} />
        </button>
        <button className="win-btn close" onMouseDown={(e) => { e.stopPropagation(); appWindow.close(); }}>
          <X size={10} />
        </button>
      </div>
    </div>
  );
}
