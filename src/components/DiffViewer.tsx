import type { FileDiff } from "../types";

interface Props {
  diff: FileDiff;
}

export default function DiffViewer({ diff }: Props) {
  return (
    <div className="diff-viewer">
      <div className="diff-file-header">{diff.path}</div>
      {diff.hunks.map((hunk, hi) => (
        <div key={hi} className="diff-hunk">
          <div className="diff-hunk-header">{hunk.header}</div>
          <div className="diff-lines">
            {hunk.lines.map((line, li) => {
              const cls =
                line.origin === "+" ? "diff-add" :
                line.origin === "-" ? "diff-del" :
                "diff-ctx";
              return (
                <div key={li} className={`diff-line ${cls}`}>
                  <span className="diff-lineno old">{line.old_lineno ?? ""}</span>
                  <span className="diff-lineno new">{line.new_lineno ?? ""}</span>
                  <span className="diff-origin">{line.origin === "+" ? "+" : line.origin === "-" ? "-" : " "}</span>
                  <span className="diff-content">{line.content}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
