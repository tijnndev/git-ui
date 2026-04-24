import { useRef, useState, useCallback, useEffect, type ReactNode } from "react";

interface Props {
  top: ReactNode;
  bottom: ReactNode;
  /** Initial height of the bottom panel in px */
  defaultBottomHeight?: number;
  minTop?: number;
  minBottom?: number;
}

export default function ResizableSplit({
  top,
  bottom,
  defaultBottomHeight = 320,
  minTop = 120,
  minBottom = 80,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bottomHeight, setBottomHeight] = useState(defaultBottomHeight);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;
    startHeight.current = bottomHeight;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, [bottomHeight]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const delta = startY.current - e.clientY;
      const totalHeight = containerRef.current.clientHeight;
      const newBottom = Math.min(
        totalHeight - minTop,
        Math.max(minBottom, startHeight.current + delta)
      );
      setBottomHeight(newBottom);
    };

    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [minTop, minBottom]);

  return (
    <div className="resizable-split" ref={containerRef}>
      <div className="resizable-top" style={{ minHeight: minTop }}>
        {top}
      </div>
      <div className="resizable-handle" onMouseDown={onMouseDown}>
        <div className="resizable-handle-grip" />
      </div>
      <div className="resizable-bottom" style={{ height: bottomHeight, minHeight: minBottom }}>
        {bottom}
      </div>
    </div>
  );
}
