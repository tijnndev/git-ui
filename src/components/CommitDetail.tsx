import { useState, useEffect } from "react";
import { X, FileText } from "lucide-react";
import type { CommitInfo, FileStatus, FileDiff } from "../types";
import * as api from "../api";
import DiffViewer from "./DiffViewer";

interface Props {
  commit: CommitInfo;
  repoPath: string;
  onClose: () => void;
}

export default function CommitDetail({ commit, repoPath, onClose }: Props) {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  useEffect(() => {
    setFiles([]);
    setSelectedFile(null);
    setDiff(null);
    api.getCommitFiles(repoPath, commit.oid).then(setFiles).catch(console.error);
  }, [commit.oid, repoPath]);

  const loadDiff = async (filePath: string) => {
    setSelectedFile(filePath);
    setLoadingDiff(true);
    try {
      const diffs = await api.getDiff(repoPath, commit.oid);
      const found = diffs.find((d) => d.path === filePath) ?? null;
      setDiff(found);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDiff(false);
    }
  };

  const date = new Date(commit.timestamp * 1000);

  return (
    <div className="commit-detail">
      <div className="commit-detail-header">
        <div className="commit-meta">
          <div className="commit-message-full">{commit.message}</div>
          <div className="commit-info-row">
            <span className="commit-author">{commit.author_name} &lt;{commit.author_email}&gt;</span>
            <span className="commit-date">{date.toLocaleString()}</span>
            <span className="commit-hash monospace">{commit.oid}</span>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose}><X size={14} /></button>
      </div>

      <div className="commit-detail-body">
        <div className="commit-files-panel">
          <div className="panel-title">Changed Files ({files.length})</div>
          {files.map((f) => (
            <div
              key={f.path}
              className={`file-item ${selectedFile === f.path ? "selected" : ""}`}
              onClick={() => loadDiff(f.path)}
            >
              <span className={`status-badge status-${f.status}`}>{f.status[0].toUpperCase()}</span>
              <FileText size={12} />
              <span className="file-path">{f.path}</span>
            </div>
          ))}
        </div>

        <div className="diff-panel">
          {loadingDiff ? (
            <div className="loading-overlay"><div className="spinner" /></div>
          ) : diff ? (
            <DiffViewer diff={diff} />
          ) : (
            <div className="empty-state">
              <FileText size={32} />
              <p>Select a file to view diff</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
