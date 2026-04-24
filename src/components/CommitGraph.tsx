import { useMemo, useRef, useEffect, useCallback } from "react";
import type { CommitInfo, BranchInfo } from "../types";
import type { AppSettings } from "../settings";

interface Props {
  commits: CommitInfo[];
  branches: BranchInfo[];
  selectedCommit: CommitInfo | null;
  onSelectCommit: (commit: CommitInfo) => void;
  settings: AppSettings;
}

interface LaneCommit {
  commit: CommitInfo;
  lane: number;
  totalLanes: number;
}

interface GraphEdge {
  fromLane: number;
  toLane: number;
  row: number; // edge spans from center of `row` to center of `row + 1`
}

const LANE_COLORS = [
  "#009280",  // 0 teal       – main / lane 0
  "#e8b84b",  // 1 amber
  "#60a8f0",  // 2 blue
  "#e07840",  // 3 orange
  "#b06af0",  // 4 purple
  "#00c896",  // 5 green
  "#f05050",  // 6 red
  "#00cce0",  // 7 cyan
  "#d060a8",  // 8 pink
  "#a0c030",  // 9 lime
];

const ROW_HEIGHT = 36;
const LANE_WIDTH = 18;
const DOT_RADIUS = 5;
const LEFT_PADDING = 16;
const TEXT_GAP = 10;    // px between last lane and first text
const HASH_COL_W = 74;
const DATE_COL_W = 108;
const AUTHOR_COL_W = 136;

function computeGraph(commits: CommitInfo[]): { nodes: LaneCommit[]; edges: GraphEdge[] } {
  const oidToRow = new Map<string, number>();
  commits.forEach((c, i) => oidToRow.set(c.oid, i));

  const nodes: LaneCommit[] = [];
  const edges: GraphEdge[] = [];

  // activeLanes[i] = oid this lane is traveling toward (null = free)
  const activeLanes: (string | null)[] = [];
  // wireLane per (commitOid, parentIndex): the lane the wire travels on
  const commitWireLanes = new Map<string, number[]>();

  const allocLane = (oid: string): number => {
    let l = activeLanes.findIndex(o => o === oid);
    if (l !== -1) return l;
    l = activeLanes.findIndex(o => o === null);
    if (l === -1) { l = activeLanes.length; activeLanes.push(null); }
    activeLanes[l] = oid;
    return l;
  };

  // Pass 1: assign lanes
  commits.forEach((commit) => {
    let lane = activeLanes.findIndex(o => o === commit.oid);
    if (lane === -1) {
      lane = activeLanes.findIndex(o => o === null);
      if (lane === -1) { lane = activeLanes.length; activeLanes.push(null); }
    }

    // Free ALL lanes pointing to this commit (handles multi-parent convergence)
    for (let i = 0; i < activeLanes.length; i++) {
      if (activeLanes[i] === commit.oid) activeLanes[i] = null;
    }

    const parentWireLanes: number[] = [];
    commit.parents.forEach((parentOid, i) => {
      if (!oidToRow.has(parentOid)) { parentWireLanes.push(-1); return; }
      if (i === 0) {
        activeLanes[lane] = parentOid;
        parentWireLanes.push(lane); // first parent: wire stays on this lane
      } else {
        const ml = allocLane(parentOid);
        parentWireLanes.push(ml); // merge parent: gets its own dedicated lane
      }
    });
    commitWireLanes.set(commit.oid, parentWireLanes);

    const maxLane = activeLanes.reduce((m, v, i) => v !== null ? Math.max(m, i) : m, lane);
    nodes.push({ commit, lane, totalLanes: maxLane + 1 });
  });

  // Pass 2: generate per-row edge segments
  nodes.forEach(({ commit, lane: LC }, RC) => {
    const pWireLanes = commitWireLanes.get(commit.oid) ?? [];
    commit.parents.forEach((parentOid, idx) => {
      const RP = oidToRow.get(parentOid);
      if (RP === undefined) return;
      const LP = nodes[RP].lane;
      const WL = pWireLanes[idx];
      if (WL === undefined || WL === -1) return;

      if (RP === RC + 1) {
        // Adjacent rows: single segment straight from LC to LP
        edges.push({ fromLane: LC, toLane: LP, row: RC });
      } else {
        // First segment: LC → WL  (fork if WL != LC, straight if same)
        edges.push({ fromLane: LC, toLane: WL, row: RC });
        // Middle segments: straight on WL
        for (let r = RC + 1; r < RP - 1; r++) {
          edges.push({ fromLane: WL, toLane: WL, row: r });
        }
        // Last segment: WL → LP  (converge if WL != LP, straight if same)
        edges.push({ fromLane: WL, toLane: LP, row: RP - 1 });
      }
    });
  });

  return { nodes, edges };
}

export default function CommitGraph({ commits, branches, selectedCommit, onSelectCommit, settings }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const ROW_H = settings.graphRowHeight;
  const LANE_W = settings.graphLaneWidth;

  const graphData = useMemo(() => computeGraph(commits), [commits]);

  const branchMap = useMemo(() => {
    const m = new Map<string, BranchInfo[]>();
    branches.forEach((b) => {
      const existing = m.get(b.tip_oid) ?? [];
      existing.push(b);
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
    if (width <= 0) return;
    const height = graphData.nodes.length * ROW_H;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    ctx.textBaseline = "middle";

    const maxLanesVal = Math.max(...graphData.nodes.map(n => n.lane + 1), 1);
    const graphAreaW = LEFT_PADDING + maxLanesVal * LANE_W;

    // Helper: rounded rect path
    function roundRectPath(x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }

    // Draw all edge segments
    graphData.edges.forEach(({ fromLane, toLane, row }) => {
      const x1 = LEFT_PADDING + fromLane * LANE_W;
      const y1 = row * ROW_H + ROW_H / 2;
      const x2 = LEFT_PADDING + toLane * LANE_W;
      const y2 = (row + 1) * ROW_H + ROW_H / 2;
      const color = LANE_COLORS[Math.max(fromLane, toLane) % LANE_COLORS.length];

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      if (fromLane === toLane) {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      } else {
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(x1, y1 + ROW_H * 0.5, x2, y2 - ROW_H * 0.5, x2, y2);
      }
      ctx.stroke();
    });

    // Derive column widths from settings
    const showAuthor = settings.showAuthorCol;
    const showDate   = settings.showDateCol;
    const showHash   = settings.showHashCol;
    const authorW = showAuthor ? AUTHOR_COL_W : 0;
    const dateW   = showDate   ? DATE_COL_W   : 0;
    const hashW   = showHash   ? HASH_COL_W   : 0;
    const rightCols = authorW + dateW + hashW;

    // Draw dots + text
    graphData.nodes.forEach(({ commit, lane }, row) => {
      const dotX = LEFT_PADDING + lane * LANE_W;
      const cy = row * ROW_H + ROW_H / 2;
      const color = LANE_COLORS[lane % LANE_COLORS.length];
      const isSelected = selectedCommit?.oid === commit.oid;

      // Row selection highlight
      if (isSelected) {
        ctx.fillStyle = "rgba(0, 146, 128, 0.12)";
        ctx.fillRect(0, row * ROW_H, width, ROW_H);
      }

      // Dot
      ctx.beginPath();
      ctx.arc(dotX, cy, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Branch label pills
      const branchInfos = branchMap.get(commit.oid) ?? [];
      const sorted = [...branchInfos].sort((a, b) => {
        if (a.is_head !== b.is_head) return a.is_head ? -1 : 1;
        if (a.is_remote !== b.is_remote) return a.is_remote ? 1 : -1;
        return a.name.localeCompare(b.name);
      });

      let tx = graphAreaW + TEXT_GAP;
      const PILL_H = 15;
      const PILL_PAD_X = 6;
      ctx.font = "bold 10px ui-sans-serif, system-ui, sans-serif";

      sorted.forEach((b) => {
        const displayName = b.is_remote ? b.name.replace(/^[^/]+\//, "") : b.name;
        const prefix = b.is_head ? "► " : (b.is_remote ? "⬡ " : "");
        const label = prefix + displayName;
        const tw = ctx.measureText(label).width;
        const pillW = tw + PILL_PAD_X * 2;

        if (b.is_head) {
          ctx.fillStyle = "#009280";
          roundRectPath(tx, cy - PILL_H / 2, pillW, PILL_H, 3);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
        } else if (b.is_remote) {
          ctx.fillStyle = "rgba(14, 90, 130, 0.40)";
          roundRectPath(tx, cy - PILL_H / 2, pillW, PILL_H, 3);
          ctx.fill();
          ctx.strokeStyle = "#1a88b0";
          ctx.lineWidth = 0.8;
          roundRectPath(tx, cy - PILL_H / 2, pillW, PILL_H, 3);
          ctx.stroke();
          ctx.fillStyle = "#60c8f0";
        } else {
          ctx.fillStyle = "rgba(0, 146, 128, 0.18)";
          roundRectPath(tx, cy - PILL_H / 2, pillW, PILL_H, 3);
          ctx.fill();
          ctx.strokeStyle = "#009280";
          ctx.lineWidth = 0.8;
          roundRectPath(tx, cy - PILL_H / 2, pillW, PILL_H, 3);
          ctx.stroke();
          ctx.fillStyle = "#00c896";
        }

        ctx.fillText(label, tx + PILL_PAD_X, cy);
        tx += pillW + 4;
      });

      // Message
      const msgMaxW = Math.max(width - rightCols - tx - 16, 40);
      ctx.font = `${settings.graphFontSize}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillStyle = isSelected ? "#ffffff" : "#e0e0e0";
      ctx.fillText(commit.message.split("\n")[0], tx + 4, cy, msgMaxW);

      // Author
      if (showAuthor) {
        ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
        ctx.fillStyle = "#727272";
        ctx.fillText(commit.author_name, width - authorW - dateW - hashW, cy, authorW - 8);
      }

      // Date
      if (showDate) {
        const dateStr = new Date(commit.timestamp * 1000).toLocaleDateString(undefined, {
          month: "short", day: "numeric", year: "numeric",
        });
        ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
        ctx.fillStyle = "#727272";
        ctx.fillText(dateStr, width - dateW - hashW, cy, dateW - 8);
      }

      // Hash
      if (showHash) {
        ctx.font = `11px 'SFMono-Regular', Consolas, monospace`;
        ctx.fillStyle = "#4a4a4a";
        ctx.fillText(commit.short_oid, width - hashW, cy, hashW - 4);
      }
    });
  }, [graphData, selectedCommit, branchMap, settings, ROW_H, LANE_W]);

  useEffect(() => { draw(); }, [draw]);

  // Redraw when container is resized (e.g. dragging the resizable split)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const row = Math.floor(y / ROW_H);
    if (row >= 0 && row < graphData.nodes.length) {
      onSelectCommit(graphData.nodes[row].commit);
    }
  }, [graphData, onSelectCommit, ROW_H]);

  return (
    <div className="commit-graph-container" ref={containerRef}>
      <div className="commit-graph-header">
        <span style={{ flex: 1 }}>Message</span>
        {settings.showAuthorCol && <span style={{ width: AUTHOR_COL_W, flexShrink: 0 }}>Author</span>}
        {settings.showDateCol   && <span style={{ width: DATE_COL_W,   flexShrink: 0 }}>Date</span>}
        {settings.showHashCol   && <span style={{ width: HASH_COL_W,   flexShrink: 0 }}>Hash</span>}
      </div>

      <div className="commit-graph-scroll">
        <div className="commit-graph-inner" style={{ height: graphData.nodes.length * ROW_H }}>
          <canvas
            ref={canvasRef}
            className="graph-canvas"
            style={{ width: "100%", display: "block" }}
            onClick={handleCanvasClick}
          />
        </div>
      </div>
    </div>
  );
}
