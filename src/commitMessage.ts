import type { FileStatus } from "./types";

export function fileBaseName(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

/** GitHub Desktop-style one-line summary for a single staged file. */
export function suggestCommitTitle(file: FileStatus): string {
  const name = fileBaseName(file.path);
  switch (file.status) {
    case "added":
    case "untracked":
      return `Create ${name}`;
    case "deleted":
      return `Delete ${name}`;
    case "renamed":
      return `Rename ${name}`;
    default:
      return `Update ${name}`;
  }
}

export function formatCommitMessage(title: string, description: string): string {
  const t = title.trim();
  const d = description.trim();
  if (!d) return t;
  return `${t}\n\n${d}`;
}
