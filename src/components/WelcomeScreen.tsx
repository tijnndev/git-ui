import { FolderOpen, Star, Trash2, GitBranch, Clock } from "lucide-react";
import type { RecentRepo } from "../types";

interface Props {
  onOpenRepo: () => void;
  recentRepos: RecentRepo[];
  onSelectRecent: (path: string) => void;
  onPinToggle: (path: string) => void;
  onRemove: (path: string) => void;
}

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

interface RepoCardProps {
  repo: RecentRepo;
  onOpen: () => void;
  onPin: () => void;
  onRemove: () => void;
}

function RepoCard({ repo, onOpen, onPin, onRemove }: RepoCardProps) {
  return (
    <div className="launchpad-card" onClick={onOpen}>
      <div className="launchpad-card-icon">
        <GitBranch size={22} />
      </div>
      <div className="launchpad-card-info">
        <div className="launchpad-card-name">{repo.name}</div>
        <div className="launchpad-card-path">{repo.path}</div>
        <div className="launchpad-card-meta">
          <Clock size={11} />
          {relativeTime(repo.lastOpened)}
        </div>
      </div>
      <div className="launchpad-card-actions">
        <button
          className={`launchpad-action-btn ${repo.pinned ? "pinned" : ""}`}
          title={repo.pinned ? "Unpin" : "Pin"}
          onClick={(e) => { e.stopPropagation(); onPin(); }}
        >
          <Star size={13} fill={repo.pinned ? "currentColor" : "none"} />
        </button>
        <button
          className="launchpad-action-btn danger"
          title="Remove from list"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export default function WelcomeScreen({ onOpenRepo, recentRepos, onSelectRecent, onPinToggle, onRemove }: Props) {
  const pinned = recentRepos.filter((r) => r.pinned);
  const recent = recentRepos.filter((r) => !r.pinned);

  return (
    <div className="launchpad">
      <div className="launchpad-header">
        <div className="launchpad-logo">
          <GitBranch size={28} />
        </div>
        <div>
          <h1 className="launchpad-title">Git UI</h1>
          <p className="launchpad-subtitle">Your Git launchpad</p>
        </div>
        <div className="launchpad-header-actions">
          <button className="btn-primary" onClick={onOpenRepo}>
            <FolderOpen size={15} />
            Open Repository
          </button>
        </div>
      </div>

      <div className="launchpad-body">
        {recentRepos.length === 0 ? (
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
            {pinned.length > 0 && (
              <section className="launchpad-section">
                <div className="launchpad-section-title">
                  <Star size={13} fill="currentColor" />
                  Pinned
                </div>
                <div className="launchpad-grid">
                  {pinned.map((repo) => (
                    <RepoCard
                      key={repo.path}
                      repo={repo}
                      onOpen={() => onSelectRecent(repo.path)}
                      onPin={() => onPinToggle(repo.path)}
                      onRemove={() => onRemove(repo.path)}
                    />
                  ))}
                </div>
              </section>
            )}

            {recent.length > 0 && (
              <section className="launchpad-section">
                <div className="launchpad-section-title">
                  <Clock size={13} />
                  Recent
                </div>
                <div className="launchpad-grid">
                  {recent.map((repo) => (
                    <RepoCard
                      key={repo.path}
                      repo={repo}
                      onOpen={() => onSelectRecent(repo.path)}
                      onPin={() => onPinToggle(repo.path)}
                      onRemove={() => onRemove(repo.path)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

