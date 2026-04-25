import { useState, useEffect } from "react";
import { X, GitCommit } from "lucide-react";
import type { CommitInfo } from "../types";
import * as api from "../api";

interface Props {
  repoPath: string;
  filePath: string;
  onClose: () => void;
  onSelectCommit: (commit: CommitInfo) => void;
}

export default function FileHistory({ repoPath, filePath, onClose, onSelectCommit }: Props) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getFileHistory(repoPath, filePath)
      .then(setCommits)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [repoPath, filePath]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal file-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <GitCommit size={14} />
          <span>File History - <span className="monospace">{filePath}</span></span>
          <button className="icon-btn" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="loading-overlay"><div className="spinner" /></div>
          ) : commits.length === 0 ? (
            <div className="empty-state"><p>No history found</p></div>
          ) : commits.map((c) => (
            <div
              key={c.oid}
              className="history-row"
              onClick={() => { onSelectCommit(c); onClose(); }}
            >
              <span className="monospace history-hash">{c.short_oid}</span>
              <span className="history-msg">{c.message}</span>
              <span className="history-author">{c.author_name}</span>
              <span className="history-date">
                {new Date(c.timestamp * 1000).toLocaleDateString(undefined, {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
