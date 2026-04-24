import { useMemo, useRef, useEffect, useCallback } from "react";
import type { CommitInfo, BranchInfo } from "../types";

interface Props {
  commits: CommitInfo[];
  branches: BranchInfo[];
  selectedCommit: CommitInfo | null;
  onSelectCommit: (commit: CommitInfo) => void;
}

interface LaneCommit {
  commit: CommitInfo;
  lane: number;
  totalLanes: number;
  connections: { fromLane: number; toLane: number; toRow: number }[];
}

const LANE_COLORS = [
  "#009280", "#00b8a0", "#e8b84b", "#e07840",
  "#f05050", "#00c896", "#60c8b0", "#c8a020",
  "#d06030", "#40a890",
];

const ROW_HEIGHT = 36;
const LANE_WIDTH = 18;
const DOT_RADIUS = 5;
const LEFT_PADDING = 16;

function computeGraph(commits: CommitInfo[]): LaneCommit[] {
  // Assign each commit a lane using a simple slot-filling algorithm
  const result: LaneCommit[] = [];
  const oidToRow = new Map<string, number>();
  const lanes: (string | null)[] = []; // lane -> oid of commit that "owns" it

  commits.forEach((commit, row) => {
    oidToRow.set(commit.oid, row);
  });

  commits.forEach((commit, row) => {
    // Find if any lane is already "expecting" this commit (from a parent ref)
    let lane = lanes.findIndex((l) => l === commit.oid);
    if (lane === -1) {
      // Assign a new lane
      lane = lanes.findIndex((l) => l === null);
      if (lane === -1) {
        lane = lanes.length;
        lanes.push(null);
      }
    }

    // Claim the lane
    lanes[lane] = null;

    // Reserve lanes for parents
    const connections: LaneCommit["connections"] = [];
    commit.parents.forEach((parentOid, i) => {
      const parentRow = oidToRow.get(parentOid);
      if (parentRow === undefined) return;

      if (i === 0) {
        // First parent continues in same lane
        lanes[lane] = parentOid;
        connections.push({ fromLane: lane, toLane: lane, toRow: parentRow });
      } else {
        // Merge parent — find or allocate a new lane
        let mergedLane = lanes.findIndex((l) => l === parentOid);
        if (mergedLane === -1) {
          mergedLane = lanes.findIndex((l) => l === null);
          if (mergedLane === -1) {
            mergedLane = lanes.length;
            lanes.push(null);
          }
          lanes[mergedLane] = parentOid;
        }
        connections.push({ fromLane: lane, toLane: mergedLane, toRow: parentRow });
      }
    });

    const totalLanes = Math.max(lanes.filter(Boolean).length + 1, lane + 1);
    result.push({ commit, lane, totalLanes, connections });
  });

  return result;
}

export default function CommitGraph({ commits, branches, selectedCommit, onSelectCommit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphData = useMemo(() => computeGraph(commits), [commits]);

  const branchMap = useMemo(() => {
    const m = new Map<string, string[]>();
    branches.forEach((b) => {
      const existing = m.get(b.tip_oid) ?? [];
      existing.push(b.name);
      m.set(b.tip_oid, existing);
    });
    return m;
  }, [branches]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = graphData.length * ROW_HEIGHT;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const maxLanes = Math.max(...graphData.map((g) => g.lane + 1), 1);
    const graphWidth = LEFT_PADDING + maxLanes * LANE_WIDTH;

    // Draw connections
    graphData.forEach(({ lane, connections }, row) => {
      const x1 = LEFT_PADDING + lane * LANE_WIDTH;
      const y1 = row * ROW_HEIGHT + ROW_HEIGHT / 2;

      connections.forEach(({ fromLane, toLane, toRow }) => {
        const x2 = LEFT_PADDING + toLane * LANE_WIDTH;
        const y2 = toRow * ROW_HEIGHT + ROW_HEIGHT / 2;
        const color = LANE_COLORS[toLane % LANE_COLORS.length];

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        if (fromLane === toLane) {
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
        } else {
          // Bezier curve for merges/branches
          ctx.moveTo(x1, y1);
          const mid = y1 + (y2 - y1) * 0.5;
          ctx.bezierCurveTo(x1, mid, x2, mid, x2, y2);
        }
        ctx.stroke();
      });
    });

    // Draw dots and row highlight
    graphData.forEach(({ commit, lane }, row) => {
      const x = LEFT_PADDING + lane * LANE_WIDTH;
      const y = row * ROW_HEIGHT + ROW_HEIGHT / 2;
      const color = LANE_COLORS[lane % LANE_COLORS.length];
      const isSelected = selectedCommit?.oid === commit.oid;

      if (isSelected) {
        ctx.fillStyle = "rgba(0, 146, 128, 0.12)";
        ctx.fillRect(0, row * ROW_HEIGHT, width, ROW_HEIGHT);
      }

      // Dot
      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    return graphWidth;
  }, [graphData, selectedCommit]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const row = Math.floor(y / ROW_HEIGHT);
    if (row >= 0 && row < graphData.length) {
      onSelectCommit(graphData[row].commit);
    }
  }, [graphData, onSelectCommit]);

  const maxLanes = Math.max(...graphData.map((g) => g.lane + 1), 1);
  const graphWidth = LEFT_PADDING + maxLanes * LANE_WIDTH + 8;

  return (
    <div className="commit-graph-container" ref={containerRef}>
      <div className="commit-graph-header">
        <span style={{ width: graphWidth, flexShrink: 0 }}>Graph</span>
        <span className="col-message">Message</span>
        <span className="col-author">Author</span>
        <span className="col-date">Date</span>
        <span className="col-hash">Hash</span>
      </div>

      <div className="commit-graph-scroll">
        <div className="commit-graph-inner" style={{ height: graphData.length * ROW_HEIGHT }}>
          <canvas
            ref={canvasRef}
            className="graph-canvas"
            style={{ width: graphWidth }}
            onClick={handleCanvasClick}
          />
          <div className="commit-rows" style={{ marginLeft: graphWidth }}>
            {graphData.map(({ commit }, row) => {
              const isSelected = selectedCommit?.oid === commit.oid;
              const labels = branchMap.get(commit.oid) ?? [];
              const date = new Date(commit.timestamp * 1000);
              const dateStr = date.toLocaleDateString(undefined, {
                month: "short", day: "numeric", year: "numeric"
              });

              return (
                <div
                  key={commit.oid}
                  className={`commit-row ${isSelected ? "selected" : ""}`}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => onSelectCommit(commit)}
                >
                  <span className="col-message">
                    {labels.map((l) => (
                      <span key={l} className={`branch-label ${l.startsWith("origin/") ? "remote" : ""}`}>
                        {l}
                      </span>
                    ))}
                    {commit.message}
                  </span>
                  <span className="col-author">{commit.author_name}</span>
                  <span className="col-date">{dateStr}</span>
                  <span className="col-hash monospace">{commit.short_oid}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
