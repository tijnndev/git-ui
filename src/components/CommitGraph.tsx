import { useMemo, useRef, useEffect, useCallback, useState, useDeferredValue } from "react";
import type { CommitInfo, BranchInfo, TagInfo } from "../types";
import type { AppSettings } from "../settings";

interface Props {
  commits: CommitInfo[];
  branches: BranchInfo[];
  tags: TagInfo[];
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
  fromRow: number;  // child commit row
  toRow: number;    // parent commit row
  fromLane: number; // lane at child
  toLane: number;   // lane at parent
  wireLane: number; // lane for intermediate wire (same as fromLane for straight wires)
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

  // O(1) lane lookup: oid → array of lane indices traveling toward it
  const oidToLanes = new Map<string, number[]>();
  const freeLanes: number[] = []; // sorted ascending pool
  let laneCount = 0;

  const allocFreeLane = (): number =>
    freeLanes.length > 0 ? freeLanes.shift()! : laneCount++;

  const claimLane = (oid: string, lane: number) => {
    const arr = oidToLanes.get(oid);
    if (arr) arr.push(lane);
    else oidToLanes.set(oid, [lane]);
  };

  const commitWireLanes = new Map<string, number[]>();

  // Pass 1: assign lanes (O(n) with Map-based lookups)
  commits.forEach((commit) => {
    const myLanes = oidToLanes.get(commit.oid);
    const lane = myLanes && myLanes.length > 0 ? myLanes[0] : allocFreeLane();

    // Free extra lanes pointing to this commit (multi-parent convergence)
    if (myLanes) {
      for (let i = 1; i < myLanes.length; i++) freeLanes.push(myLanes[i]);
      if (freeLanes.length > 1) freeLanes.sort((a, b) => a - b);
      oidToLanes.delete(commit.oid);
    }

    let laneConsumed = false;
    const parentWireLanes: number[] = [];
    commit.parents.forEach((parentOid, i) => {
      if (!oidToRow.has(parentOid)) { parentWireLanes.push(-1); return; }
      if (i === 0) {
        claimLane(parentOid, lane);
        parentWireLanes.push(lane);
        laneConsumed = true;
      } else {
        const existing = oidToLanes.get(parentOid);
        if (existing && existing.length > 0) {
          parentWireLanes.push(existing[0]);
        } else {
          const ml = allocFreeLane();
          claimLane(parentOid, ml);
          parentWireLanes.push(ml);
        }
      }
    });

    if (!laneConsumed) {
      freeLanes.push(lane);
      freeLanes.sort((a, b) => a - b);
    }

    commitWireLanes.set(commit.oid, parentWireLanes);
    nodes.push({ commit, lane, totalLanes: Math.max(laneCount - freeLanes.length, lane + 1) });
  });

  // Pass 2: one range-based edge per parent connection (O(n) total edges)
  nodes.forEach(({ commit, lane: LC }, RC) => {
    const pWireLanes = commitWireLanes.get(commit.oid) ?? [];
    commit.parents.forEach((parentOid, idx) => {
      const RP = oidToRow.get(parentOid);
      if (RP === undefined) return;
      const LP = nodes[RP].lane;
      const WL = pWireLanes[idx];
      if (WL === undefined || WL === -1) return;
      edges.push({ fromRow: RC, toRow: RP, fromLane: LC, toLane: LP, wireLane: WL });
    });
  });

  return { nodes, edges };
}

export default function CommitGraph({ commits, branches, tags, selectedCommit, onSelectCommit, settings }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");

  // Deferred so computeGraph runs in an interruptible background render.
  // flushSync (triggered by clicking a new repo) will abandon this render
  // immediately, letting the loading overlay appear without waiting.
  const deferredCommits = useDeferredValue(commits);
  const deferredBranches = useDeferredValue(branches);
  const deferredTags = useDeferredValue(tags);

  const ROW_H = settings.graphRowHeight;
  const LANE_W = settings.graphLaneWidth;

  const filteredCommits = useMemo(() => {
    if (!search.trim()) return deferredCommits;
    const q = search.toLowerCase();
    return deferredCommits.filter(
      (c) =>
        c.message.toLowerCase().includes(q) ||
        c.author_name.toLowerCase().includes(q) ||
        c.short_oid.toLowerCase().includes(q),
    );
  }, [deferredCommits, search]);

  const graphData = useMemo(() => computeGraph(filteredCommits), [filteredCommits]);

  const branchMap = useMemo(() => {
    const m = new Map<string, BranchInfo[]>();
    deferredBranches.forEach((b) => {
      const existing = m.get(b.tip_oid) ?? [];
      existing.push(b);
      m.set(b.tip_oid, existing);
    });
    return m;
  }, [deferredBranches]);

  const tagMap = useMemo(() => {
    const m = new Map<string, TagInfo[]>();
    deferredTags.forEach((t) => {
      const existing = m.get(t.oid) ?? [];
      existing.push(t);
      m.set(t.oid, existing);
    });
    return m;
  }, [deferredTags]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const scrollEl = scrollRef.current;
    const scrollTop = scrollEl?.scrollTop ?? 0;
    const viewH = scrollEl?.clientHeight ?? 0;
    const width = container.clientWidth;
    if (width <= 0 || viewH <= 0) return;
    const firstRow = Math.max(0, Math.floor(scrollTop / ROW_H) - 1);
    const lastRow = Math.min(graphData.nodes.length - 1, Math.ceil((scrollTop + viewH) / ROW_H) + 2);
    canvas.width = width * dpr;
    canvas.height = viewH * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${viewH}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, viewH);
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

    // Draw edges (range-based: one object per parent connection)
    graphData.edges.forEach(({ fromRow, toRow, fromLane: LC, toLane: LP, wireLane: WL }) => {
      // Cull edges entirely outside the visible range
      if (fromRow > lastRow || toRow - 1 < firstRow) return;

      const color = LANE_COLORS[Math.max(WL, LC) % LANE_COLORS.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      const drawSeg = (fl: number, tl: number, r: number) => {
        const x1 = LEFT_PADDING + fl * LANE_W;
        const y1 = r * ROW_H + ROW_H / 2 - scrollTop;
        const x2 = LEFT_PADDING + tl * LANE_W;
        const y2 = (r + 1) * ROW_H + ROW_H / 2 - scrollTop;
        ctx.beginPath();
        if (fl === tl) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
        else { ctx.moveTo(x1, y1); ctx.bezierCurveTo(x1, y1 + ROW_H * 0.5, x2, y2 - ROW_H * 0.5, x2, y2); }
        ctx.stroke();
      };

      if (toRow === fromRow + 1) {
        // Adjacent rows: single segment
        if (fromRow >= firstRow) drawSeg(LC, LP, fromRow);
      } else {
        // First segment: LC → WL
        if (fromRow >= firstRow && fromRow <= lastRow) drawSeg(LC, WL, fromRow);

        // Middle segments: straight wire on WL — draw as one continuous line
        const midStart = Math.max(fromRow + 1, firstRow);
        const midEnd = Math.min(toRow - 2, lastRow);
        if (midStart <= midEnd) {
          const x = LEFT_PADDING + WL * LANE_W;
          const y1 = midStart * ROW_H + ROW_H / 2 - scrollTop;
          const y2 = (midEnd + 1) * ROW_H + ROW_H / 2 - scrollTop;
          ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
        }

        // Last segment: WL → LP
        const lastSeg = toRow - 1;
        if (lastSeg >= firstRow && lastSeg <= lastRow) drawSeg(WL, LP, lastSeg);
      }
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
      if (row < firstRow || row > lastRow) return;
      const dotX = LEFT_PADDING + lane * LANE_W;
      const cy = row * ROW_H + ROW_H / 2 - scrollTop;
      const color = LANE_COLORS[lane % LANE_COLORS.length];
      const isSelected = selectedCommit?.oid === commit.oid;

      // Row selection highlight
      if (isSelected) {
        ctx.fillStyle = "rgba(0, 146, 128, 0.12)";
        ctx.fillRect(0, row * ROW_H - scrollTop, width, ROW_H);
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

      // Tag label pills (amber)
      const tagInfos = tagMap.get(commit.oid) ?? [];
      tagInfos.forEach((t) => {
        const label = "⬛ " + t.name;
        const tw = ctx.measureText(label).width;
        const pillW = tw + PILL_PAD_X * 2;
        ctx.fillStyle = "rgba(120, 80, 0, 0.40)";
        roundRectPath(tx, cy - PILL_H / 2, pillW, PILL_H, 3);
        ctx.fill();
        ctx.strokeStyle = "#e8b84b";
        ctx.lineWidth = 0.8;
        roundRectPath(tx, cy - PILL_H / 2, pillW, PILL_H, 3);
        ctx.stroke();
        ctx.fillStyle = "#e8b84b";
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
  }, [graphData, selectedCommit, branchMap, tagMap, settings, ROW_H, LANE_W]);

  useEffect(() => { draw(); }, [draw]);

  // Redraw on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => draw();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [draw]);

  // Redraw when container is resized (e.g. dragging the resizable split)
  useEffect(() => {
    const container = containerRef.current;
    const scrollEl = scrollRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(container);
    if (scrollEl) ro.observe(scrollEl);
    return () => ro.disconnect();
  }, [draw]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    const row = Math.floor((y + scrollTop) / ROW_H);
    if (row >= 0 && row < graphData.nodes.length) {
      onSelectCommit(graphData.nodes[row].commit);
    }
  }, [graphData, onSelectCommit, ROW_H]);

  return (
    <div className="commit-graph-container" ref={containerRef}>
      <div className="commit-graph-search">
        <input
          className="graph-search-input"
          placeholder="Search commits…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <span className="graph-search-count">
            {filteredCommits.length} / {commits.length}
          </span>
        )}
      </div>
      <div className="commit-graph-header">
        <span style={{ flex: 1 }}>Message</span>
        {settings.showAuthorCol && <span style={{ width: AUTHOR_COL_W, flexShrink: 0 }}>Author</span>}
        {settings.showDateCol   && <span style={{ width: DATE_COL_W,   flexShrink: 0 }}>Date</span>}
        {settings.showHashCol   && <span style={{ width: HASH_COL_W,   flexShrink: 0 }}>Hash</span>}
      </div>

      <div className="commit-graph-scroll" ref={scrollRef}>
        {commits.length === 0 || deferredCommits.length === 0 ? (
          <div className="graph-skeleton">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="graph-skeleton-row">
                <div className="graph-skeleton-dot" style={{ marginLeft: 16 + (i % 3) * 18 }} />
                <div className="graph-skeleton-line" style={{ width: `${30 + ((i * 37) % 40)}%` }} />
              </div>
            ))}
          </div>
        ) : (
        <div className="commit-graph-inner" style={{ height: graphData.nodes.length * ROW_H }}>
          <canvas
            ref={canvasRef}
            className="graph-canvas"
            style={{ width: "100%", display: "block", position: "sticky", top: 0 }}
            onClick={handleCanvasClick}
          />
        </div>
        )}
      </div>
    </div>
  );
}
