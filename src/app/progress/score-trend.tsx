"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { formatScore } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface TrendPoint {
  id: string;
  label: string; // e.g. "13 Nov, 4:10 pm"
  subject: string;
  points: number;
  correct: number;
  wrong: number;
  questionCount: number;
}

const HEIGHT = 200;
const PAD = { top: 22, right: 8, bottom: 22, left: 36 };
const MAX_BAR = 24;
const RADIUS = 4;

/** Column path with a rounded data-end and a square baseline. */
function columnPath(x: number, w: number, yBase: number, yEnd: number) {
  const h = Math.abs(yBase - yEnd);
  const r = Math.min(RADIUS, h / 2, w / 2);
  if (h < 0.5) return "";
  if (yEnd < yBase) {
    // grows up
    return `M${x},${yBase} V${yEnd + r} Q${x},${yEnd} ${x + r},${yEnd} H${x + w - r} Q${x + w},${yEnd} ${x + w},${yEnd + r} V${yBase} Z`;
  }
  // grows down
  return `M${x},${yBase} V${yEnd - r} Q${x},${yEnd} ${x + r},${yEnd} H${x + w - r} Q${x + w},${yEnd} ${x + w},${yEnd - r} V${yBase} Z`;
}

function niceStep(range: number) {
  const raw = range / 4;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

export function ScoreTrend({ points }: { points: TrendPoint[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const values = points.map((p) => p.points);
    const max = Math.max(4, ...values);
    const min = Math.min(0, ...values);
    const step = niceStep(max - min);
    const top = Math.ceil(max / step) * step;
    const bottom = Math.floor(min / step) * step;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const y = (v: number) => PAD.top + ((top - v) / (top - bottom)) * plotH;
    const ticks: number[] = [];
    for (let v = bottom; v <= top + 1e-9; v += step) ticks.push(Math.round(v));
    const plotW = Math.max(0, width - PAD.left - PAD.right);
    const band = points.length ? plotW / points.length : 0;
    const barW = Math.max(2, Math.min(MAX_BAR, band - 2));
    const best = values.length ? values.indexOf(Math.max(...values)) : -1;
    return { y, ticks, band, barW, best };
  }, [points, width]);

  const last = points.length - 1;
  const shown = active ?? null;

  return (
    <div ref={wrap} className="relative w-full" style={{ height: HEIGHT }}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="group" aria-label={`Score per session for the last ${points.length} sessions`}>
          {/* Gridlines + y ticks */}
          {geo.ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={geo.y(t)}
                y2={geo.y(t)}
                strokeWidth={1}
                className={t === 0 ? "stroke-foreground/30" : "stroke-border"}
              />
              <text x={PAD.left - 8} y={geo.y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {formatScore(t)}
              </text>
            </g>
          ))}

          {points.map((p, i) => {
            const cx = PAD.left + geo.band * i + geo.band / 2;
            const x = cx - geo.barW / 2;
            const y0 = geo.y(0);
            const y1 = geo.y(p.points);
            const positive = p.points >= 0;
            const labelled = i === last || i === geo.best;
            return (
              <g
                key={p.id}
                tabIndex={0}
                role="img"
                aria-label={`${p.label}, ${p.subject}: ${formatScore(p.points)} (${p.correct} correct, ${p.wrong} wrong)`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none"
              >
                {/* Hit target: the whole band, taller than the mark */}
                <rect x={PAD.left + geo.band * i} y={PAD.top} width={geo.band} height={HEIGHT - PAD.top - PAD.bottom} fill="transparent" />
                {p.points === 0 ? (
                  <rect x={x} y={y0 - 1} width={geo.barW} height={2} rx={1} className="fill-skipped" />
                ) : (
                  <path
                    d={columnPath(x, geo.barW, y0, y1)}
                    className={cn(positive ? "fill-correct" : "fill-wrong", "transition-opacity", shown !== null && shown !== i && "opacity-40")}
                  />
                )}
                {labelled && (
                  <text
                    x={cx}
                    y={positive ? y1 - 6 : y1 + 14}
                    textAnchor="middle"
                    className="fill-foreground text-[11px] font-semibold tabular-nums"
                  >
                    {formatScore(p.points)}
                  </text>
                )}
              </g>
            );
          })}

          <text x={PAD.left} y={HEIGHT - 4} className="fill-muted-foreground text-[11px]">
            Oldest
          </text>
          <text x={width - PAD.right} y={HEIGHT - 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
            Latest
          </text>
        </svg>
      )}

      {shown !== null && points[shown] && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-0 z-10 w-max max-w-56 -translate-x-1/2 rounded-lg border bg-popover px-3 py-2 text-xs shadow-float"
          style={{
            left: Math.min(Math.max(PAD.left + geo.band * shown + geo.band / 2, 90), width - 90),
          }}
        >
          <p className="text-base font-semibold tabular-nums">{formatScore(points[shown].points)}</p>
          <p className="text-muted-foreground">{points[shown].subject}</p>
          <p className="text-muted-foreground tabular-nums">
            {points[shown].correct} correct · {points[shown].wrong} wrong · {points[shown].questionCount} Qs
          </p>
          <p className="text-muted-foreground">{points[shown].label}</p>
        </div>
      )}
    </div>
  );
}
