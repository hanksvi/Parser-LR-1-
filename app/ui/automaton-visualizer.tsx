"use client";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/ui/card";
import { Badge } from "@/app/ui/badge";
import { Button } from "@/app/ui/button";
import { ZoomIn, ZoomOut, Maximize2, Download, FileText, FileImage } from "lucide-react";
import { Move } from "lucide-react";

const ARROW_L = 12;   // largo del triángulo
const ARROW_W = 7;    // ancho del triángulo
const ARROW_MARGIN = 2.5; // separa un poquito del borde

// ===== Tipos =====
type AState = {
  name: string;
  is_final: boolean;
  transitions: Record<string, string[]>;
  shape?: "oval" | "rect";
  label?: string;
};

interface AutomatonVisualizerProps {
  automaton: {
    states: Record<string, AState>;
    start_state: string;
    alphabet: string[];
  };
  title: string;
  description: string;
}

export function AutomatonVisualizer({ automaton, title, description }: AutomatonVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Zoom / pan
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const isPanning = useRef(false);
  const last = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // === NUEVO: posiciones manuales de nodos + flags de arrastre ===
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const draggingNode = useRef<string | null>(null);
  const dragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // === NUEVO: bounds del grafo + referencia a render ===
  const graphBoundsRef = useRef<{minX:number; minY:number; maxX:number; maxY:number} | null>(null);
  const renderRef = useRef<() => void>(() => {});
  const CONTENT_MARGIN = 40;

  // --------- Controles de zoom ---------
  const handleZoomIn = () => setView(v => ({ ...v, scale: Math.min(3, v.scale * 1.2) }));
  const handleZoomOut = () => setView(v => ({ ...v, scale: Math.max(0.3, v.scale / 1.2) }));

  // === NUEVO: ajustar vista a contenido
  const fitToContent = () => {
    const bounds = graphBoundsRef.current;
    if (!bounds || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const w = (bounds.maxX - bounds.minX) + CONTENT_MARGIN * 2;
    const h = (bounds.maxY - bounds.minY) + CONTENT_MARGIN * 2;

    const scale = Math.max(0.3, Math.min(3, Math.min(width / w, height / h)));
    const tx = (width - w * scale) / 2 - (bounds.minX - CONTENT_MARGIN) * scale;
    const ty = (height - h * scale) / 2 - (bounds.minY - CONTENT_MARGIN) * scale;

    setView({ scale, tx, ty });
  };

  const handleReset = () => fitToContent();

  // Descargar “lo visible” (tu implementación original)
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${title.replace(/\s+/g, "_")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // === NUEVO: descarga completa PNG/PDF sin recortes
  const handleDownloadFull = async (format: "png" | "pdf" = "png") => {
    const canvas = canvasRef.current;
    const bounds = graphBoundsRef.current;
    if (!canvas || !bounds) return;

    const margin = CONTENT_MARGIN;
    const w = (bounds.maxX - bounds.minX) + margin * 2;
    const h = (bounds.maxY - bounds.minY) + margin * 2;

    const exportScale = 2; // 2x nitidez
    const dprBase = (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const dpr = dprBase * exportScale;

    // Offscreen donde copiaremos el render
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.floor(w * dpr));
    off.height = Math.max(1, Math.floor(h * dpr));
    const octx = off.getContext("2d");
    if (!octx) return;
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Guardar estado actual del canvas principal
    const prev = {
      w: canvas.width,
      h: canvas.height,
      view: { ...view },
    };

    // Redimensionar buffer del canvas principal para render a tamaño export
    canvas.width = off.width;
    canvas.height = off.height;

    // Vista especial: que (minX - margin, minY - margin) caiga en (0,0) y escala=1 (el dpr ya lo manejamos)
    setView({
      scale: 1,
      tx: -(bounds.minX - margin),
      ty: -(bounds.minY - margin),
    });

    // Renderizar una vez
    renderRef.current();

    // Copiar imagen al offscreen en coordenadas CSS
    const mainWcss = off.width / dpr;
    const mainHcss = off.height / dpr;
    const mainCtx = canvas.getContext("2d")!;
    octx.drawImage(canvas, 0, 0, mainWcss, mainHcss);

    // Restaurar tamaño/estado del canvas principal
    canvas.width = prev.w;
    canvas.height = prev.h;
    setView(prev.view);
    renderRef.current();

    // Guardar archivo
    if (format === "png") {
      const url = off.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/\s+/g, "_")}.png`;
      a.click();
    } else {
      try {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({
          orientation: w >= h ? "landscape" : "portrait",
          unit: "pt",
          format: [w, h],
        });
        pdf.addImage(off.toDataURL("image/png"), "PNG", 0, 0, w, h);
        pdf.save(`${title.replace(/\s+/g, "_")}.pdf`);
      } catch {
        // si no hay jspdf instalado, caemos a PNG
        const url = off.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title.replace(/\s+/g, "_")}.png`;
        a.click();
      }
    }
  };

  // Redimensionar el canvas cuando cambia el contenedor
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !automaton) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const FONT = "11px Inter, system-ui, sans-serif";
    const FONT_BOLD = "bold 11px Inter, system-ui, sans-serif";
    const LINE_H = 14;

    // -------- layout (BFS niveles) --------
    const names = Object.keys(automaton.states);
    const undirected: Record<string, Set<string>> = {};
    names.forEach(n => (undirected[n] = new Set<string>()));
    for (const [u, s] of Object.entries(automaton.states)) {
      for (const tos of Object.values(s.transitions)) tos.forEach(v => { undirected[u].add(v); undirected[v].add(u); });
    }
    const depth = new Map<string, number>();
    const q: string[] = [automaton.start_state];
    depth.set(automaton.start_state, 0);
    while (q.length) {
      const u = q.shift()!;
      for (const v of undirected[u] || []) if (!depth.has(v)) { depth.set(v, (depth.get(u) || 0) + 1); q.push(v); }
    }
    const maxDepth = Math.max(0, ...Array.from(depth.values())) || 0;
    names.forEach(n => { if (!depth.has(n)) depth.set(n, maxDepth + 1); });

    const levels: string[][] = [];
    for (const n of names) { const d = depth.get(n)!; (levels[d] ||= []).push(n); }

    // medir óvalos/rect según label
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = FONT;

    const info = new Map<string, { title: string; lines: string[]; rx: number; ry: number }>();
    names.forEach(n => {
      const st = automaton.states[n];
      const title = n;
      const labelText = st.label ? st.label.replace(/\\n/g, "\n") : "";
      const lines = labelText.split("\n").filter(Boolean);
      const maxChars = 25;
      const truncated = lines.map(l => l.length > maxChars ? l.slice(0, maxChars - 3) + "..." : l);
      const widths = [ctx.measureText(title).width, ...truncated.map(l => ctx.measureText(l).width)];
      const textW = Math.max(...widths, 20);
      const baseRx = st.shape === "rect" ? 55 : 32;
      const baseRy = st.shape === "rect" ? 35 : 22;
      const rx = Math.max(baseRx, textW / 2 + 14);
      const ry = Math.max(baseRy, ((1 + truncated.length) * LINE_H) / 2 + 10);
      info.set(n, { title, lines: truncated, rx, ry });
    });

    // Layout base
    const paddingX = 100;
    const paddingY = 80;
    const levelGap = Math.max(120, 160 - Math.min(40, levels.length * 3));
    const maxCols = Math.max(...levels.map(l => l.length));
    const widest = Math.max(...names.map(n => info.get(n)!.rx * 2));
    const baseColGap = Math.max(140, widest + 60);
    const colGapMin = maxCols > 8 ? Math.max(120, widest + 40) : baseColGap;
    const worldW = Math.max(1200, paddingX * 2 + (maxCols - 1) * colGapMin + widest);
    const worldH = Math.max(800, paddingY * 2 + (levels.length - 1) * levelGap + 200);

    const pos = new Map<string, { x: number; y: number }>();
    levels.forEach((lev, d) => {
      const y = paddingY + d * levelGap;
      const cols = lev.length;
      const usable = worldW - 2 * paddingX;
      const step = cols > 1 ? usable / (cols - 1) : 0;
      lev.forEach((n, i) => pos.set(n, { x: paddingX + (cols > 1 ? i * step : usable / 2), y }));
    });

    // === Ajuste vertical por altura real (rectángulos altos) ===
    const LEVEL_PAD_Y = 60;
    const levelMaxRy: number[] = levels.map(lev => Math.max(...lev.map(n => info.get(n)!.ry)) || 22);
    let accY = paddingY;
    levels.forEach((lev, d) => {
      const bandMid = accY + levelMaxRy[d];
      lev.forEach(n => { const p = pos.get(n)!; pos.set(n, { x: p.x, y: bandMid }); });
      accY += levelMaxRy[d] * 2 + LEVEL_PAD_Y;
    });

    // === Compactación horizontal anti-colisión ===
    levels.forEach((lev) => {
      if (lev.length <= 1) return;
      const nodes = lev.slice().sort((a,b) => pos.get(a)!.x - pos.get(b)!.x);
      for (let i = 1; i < nodes.length; i++) {
        const a = nodes[i-1], b = nodes[i];
        const ax = pos.get(a)!.x, bx = pos.get(b)!.x;
        const gapNeeded = info.get(a)!.rx + info.get(b)!.rx + 40;
        if (bx - ax < gapNeeded) {
          const delta = gapNeeded - (bx - ax);
          (pos.get(b) as any).x += delta;
          for (let j = i + 1; j < nodes.length; j++) (pos.get(nodes[j]) as any).x += delta;
        }
      }
      const minX = Math.min(...nodes.map(n => pos.get(n)!.x - info.get(n)!.rx));
      const maxX = Math.max(...nodes.map(n => pos.get(n)!.x + info.get(n)!.rx));
      const extra = (worldW - (maxX - minX)) / 2 - paddingX - minX;
      nodes.forEach(n => (pos.get(n) as any).x += extra);
    });

    // === APLICAR OVERRIDES DE POSICIÓN MANUAL (drag) ===
    for (const n of names) {
      const override = nodePositions[n];
      if (override) pos.set(n, { x: override.x, y: override.y });
    }

    // ---------- helpers ----------
    const endpointTowardsNode = (
      center: { x: number; y: number },
      other: { x: number; y: number },
      rx: number,
      ry: number,
      shape: "oval" | "rect"
    ) => {
      const dx = other.x - center.x, dy = other.y - center.y;
      if (dx === 0 && dy === 0) return { x: center.x, y: center.y };
      if (shape === "rect") {
        const ax = Math.abs(dx), ay = Math.abs(dy);
        const k = 1 / Math.max(ax / (rx - 4), ay / (ry - 4));
        return { x: center.x + dx * k, y: center.y + dy * k };
      }
      const ang = Math.atan2(dy, dx);
      return { x: center.x + (rx - 1) * Math.cos(ang), y: center.y + (ry - 1) * Math.sin(ang) };
    };

    const bezierCtrl = (start: { x: number; y: number }, end: { x: number; y: number }, sameLevel: boolean) => {
      const midx = (start.x + end.x) / 2, midy = (start.y + end.y) / 2;
      const dx = end.x - start.x, sign = dx >= 0 ? 1 : -1;
      const kx = 70, ky = sameLevel ? 35 : 60;
      return { cx: midx + sign * kx, cy: midy - ky };
    };

    const drawArrowHead = (tip: { x: number; y: number }, vx: number, vy: number) => {
      const len = Math.hypot(vx, vy) || 1;
      const ux = vx / len;
      const uy = vy / len;

      const tx = tip.x + ux * 0.5;
      const ty = tip.y + uy * 0.5;

      const leftX  = tx - ARROW_L * ux + ARROW_W * uy;
      const leftY  = ty - ARROW_L * uy - ARROW_W * ux;
      const rightX = tx - ARROW_L * ux - ARROW_W * uy;
      const rightY = ty - ARROW_L * uy + ARROW_W * ux;

      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(leftX, leftY);
      ctx.lineTo(rightX, rightY);
      ctx.closePath();
      ctx.fill();
    };

    type Ob = { n: string; x: number; y: number; rx: number; ry: number; shape: "oval" | "rect" };
    const obstacles: Ob[] = names.map(n => {
      const p = pos.get(n)!; const st = automaton.states[n]; const { rx, ry } = info.get(n)!;
      return { n, x: p.x, y: p.y, rx: rx + 8, ry: ry + 8, shape: st.shape === "rect" ? "rect" : "oval" };
    });

    // Bezier utils (para etiquetas)
    const qPoint = (t: number, p0: any, p1: any, p2: any) => ({
      x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
      y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y
    });
    const qTangent = (t: number, p0: any, p1: any, p2: any) => ({
      x: 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
      y: 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y)
    });
    function arcLenTo(t: number, p0: any, p1: any, p2: any) {
      const steps = Math.max(6, Math.ceil(t * 36));
      let len = 0; let prev = qPoint(0, p0, p1, p2);
      for (let i = 1; i <= steps; i++) {
        const ti = (t * i) / steps;
        const cur = qPoint(ti, p0, p1, p2);
        len += Math.hypot(cur.x - prev.x, cur.y - prev.y);
        prev = cur;
      }
      return len;
    }
    function tForArcFromStart(minLen: number, p0: any, p1: any, p2: any) {
      let lo = 0, hi = 1;
      for (let k = 0; k < 22; k++) { const mid = (lo + hi) / 2; (arcLenTo(mid, p0, p1, p2) < minLen) ? (lo = mid) : (hi = mid); }
      return Math.min(0.9, Math.max(0.1, hi));
    }
    function tForArcFromEnd(minLen: number, p0: any, p1: any, p2: any) {
      const rp0 = p2, rp1 = p1, rp2 = p0;
      const tFromEnd = tForArcFromStart(minLen, rp0, rp1, rp2);
      return 1 - tFromEnd;
    }

    type Rect = { x: number; y: number; w: number; h: number };
    const placedRects: Rect[] = [];
    const edgeLabels: Array<{ x: number; y: number; text: string; w: number; h: number }> = [];
    const intersects = (a: Rect, b: Rect) => Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;

    // =========== AGRUPAR ARISTAS ===========
    type EdgeKey = string; // `${from}|${to}`
    const arrowHeads: Array<{ tip:{x:number;y:number}; vx:number; vy:number }> = [];
    const grouped: Map<EdgeKey, { from: string; to: string; syms: string[] }> = new Map();
    for (const from of names) {
      const S = automaton.states[from];
      for (const [sym, tos] of Object.entries(S.transitions)) {
        for (const to of tos) {
          const k: EdgeKey = `${from}|${to}`;
          const g = grouped.get(k);
          if (g) g.syms.push(sym);
          else grouped.set(k, { from, to, syms: [sym] });
        }
      }
    }
    const pairCount = new Map<string, number>();
    const pairIndex  = new Map<EdgeKey, number>();
    for (const k of grouped.keys()) {
      const [a,b] = k.split("|");
      const und = a < b ? `${a}|${b}` : `${b}|${a}`;
      const c = (pairCount.get(und) || 0) + 1;
      pairCount.set(und, c);
      pairIndex.set(k, c - 1);
    }

    // ====== PUERTOS SOLO PARA DFA (rectángulos) ======
    type Side = "L" | "R" | "T" | "B";
    function pickSide(dx: number, dy: number): Side {
      return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "R" : "L") : (dy >= 0 ? "B" : "T");
    }
    function sideOutwardNormal(side: Side) {
      switch (side) {
        case "R": return { nx:  1, ny:  0 };
        case "L": return { nx: -1, ny:  0 };
        case "T": return { nx:  0, ny: -1 };
        case "B": return { nx:  0, ny:  1 };
      }
    }

    // 3 slots simétricos por lado (t en [-0.5,0.5]) + nudge controlado
    const SLOT_T = [0, -0.33, 0.33];
    const CLAMP_T = 0.48;         // evita que se salga del borde
    const NUDGE_STEP = 0.10;      // separaciones extra para overflow

    const usedSlots = new Map<string, Set<number>>();  // key = n|side
    const overflowCount = new Map<string, number>();   // para >3 en el mismo lado
    const portKey = (n: string, s: Side) => `${n}|${s}`;

    function takeSideSlot(n: string, side: Side) {
      const key = portKey(n, side);
      const set = usedSlots.get(key) || new Set<number>();

      for (const s of [0,1,2]) {
        if (!set.has(s)) {
          const ns = new Set(set); ns.add(s);
          usedSlots.set(key, ns);
          return { slot: s, nudge: 0 };
        }
      }

      // overflow
      const idx = (overflowCount.get(key) || 0);
      overflowCount.set(key, idx + 1);
      const baseSlot = idx % 3;                      // 0,1,2,0,1,2...
      const ring = Math.floor(idx / 3) + 1;          // 1,2,3,...
      const sign = (idx % 2 === 0) ? 1 : -1;         // alternar lados
      const nudge = sign * ring * NUDGE_STEP;
      return { slot: baseSlot, nudge };
    }

    function portPointFromSlot(n: string, side: Side, slot: number, nudge: number) {
      const p = pos.get(n)!; const r = info.get(n)!;
      const PAD = 6;
      const usableH = Math.max(0, (r.rx * 2) - PAD * 2);
      const usableV = Math.max(0, (r.ry * 2) - PAD * 2);

      let t = SLOT_T[slot] + nudge;
      if (t >  CLAMP_T) t =  CLAMP_T;
      if (t < -CLAMP_T) t = -CLAMP_T;

      switch (side) {
        case "R": return { x: p.x + r.rx, y: p.y + t * usableV };
        case "L": return { x: p.x - r.rx, y: p.y + t * usableV };
        case "T": return { x: p.x + t * usableH, y: p.y - r.ry };
        case "B": return { x: p.x + t * usableH, y: p.y + r.ry };
      }
    }

    // ====== RUTEO ORTOGONAL SUAVE (solo rect→rect / DFA) ======
    function drawOrthogonalRectEdge(
      ctx: CanvasRenderingContext2D,
      from: string,
      to: string,
      syms: string[],
    ) {
      const pA = pos.get(from)!; const pB = pos.get(to)!;

      const dx = pB.x - pA.x, dy = pB.y - pA.y;

      // lados según geometría relativa
      const sideOut: Side = pickSide(dx, dy);
      const sideIn:  Side = pickSide(-dx, -dy);

      // tomar slot del pool compartido SOLO para rectángulos
      const outPick = takeSideSlot(from, sideOut);
      const inPick  = takeSideSlot(to,   sideIn);

      // puertos en el borde (clamped)
      const A = portPointFromSlot(from, sideOut, outPick.slot, outPick.nudge)!;
      const B = portPointFromSlot(to,   sideIn,  inPick.slot,  inPick.nudge)!;

      // carriles entre pares
      const und = from < to ? `${from}|${to}` : `${to}|${from}`;
      const lanes = pairCount.get(und) || 1;
      const idxPair = pairIndex.get(`${from}|${to}`) || 0;
      const laneOff = (idxPair - (lanes - 1) / 2) * 16;

      // camino ortogonal: un codo
      let P1 = { x: A.x, y: A.y };
      let P2 = { x: B.x, y: B.y };

      if (sideOut === "L" || sideOut === "R") {
        P1 = { x: A.x + (dx >= 0 ? 40 : -40) + laneOff, y: A.y };
      } else {
        P1 = { x: A.x, y: A.y + (dy >= 0 ? 40 : -40) + laneOff };
      }

      if (sideIn === "L" || sideIn === "R") {
        P2 = { x: B.x - (dx >= 0 ? 40 : -40) - laneOff, y: B.y };
      } else {
        P2 = { x: B.x, y: B.y - (dy >= 0 ? 40 : -40) - laneOff };
      }

      const CR = 10;
      function drawRoundedOrthogonal(a: any, b: any, c: any, d: any) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        const abx = b.x - a.x, aby = b.y - a.y;
        const la = Math.hypot(abx, aby) || 1;
        const ax2 = a.x + (abx / la) * Math.max(0, la - CR);
        const ay2 = a.y + (aby / la) * Math.max(0, la - CR);
        ctx.lineTo(ax2, ay2);
        const cbx = c.x - b.x, cby = c.y - b.y;
        const lc = Math.hypot(cbx, cby) || 1;
        const bx2 = b.x + (cbx / lc) * CR;
        const by2 = b.y + (cby / lc) * CR;
        ctx.quadraticCurveTo(b.x, b.y, bx2, by2);
        const cx2 = c.x - (cbx / lc) * CR;
        const cy2 = c.y - (cby / lc) * CR;
        ctx.lineTo(cx2, cy2);
        const cdx = d.x - c.x, cdy = d.y - c.y;
        const ld = Math.hypot(cdx, cdy) || 1;
        const cx3 = c.x + (cdx / ld) * Math.max(0, ld - CR);
        const cy3 = c.y + (cdy / ld) * Math.max(0, ld - CR);
        ctx.lineTo(cx3, cy3);
        ctx.stroke();
      }

      // CABEZA ORTOGONAL
      const { nx: outNx, ny: outNy } = sideOutwardNormal(sideIn);
      const nodeBorder = (to === automaton.start_state) ? 2.5 : 1.8;
      const inset = ARROW_MARGIN + nodeBorder + 0.5;
      const B_tip = { x: B.x - outNx * inset, y: B.y - outNy * inset };
      drawRoundedOrthogonal(A, P1, P2, B_tip);

      const HEAD_LEN = 40;
      const tvx = -outNx * HEAD_LEN;
      const tvy = -outNy * HEAD_LEN;
      arrowHeads.push({ tip: B_tip, vx: tvx, vy: tvy });

      // etiqueta
      const text = syms.length <= 6 ? syms.join(",") : `${syms.slice(0,5).join(",")} …(+${syms.length-5})`;
      const tw = Math.max(18, ctx.measureText(text).width + 8);
      const th = 16;
      const midx = (P1.x + P2.x) / 2, midy = (P1.y + P2.y) / 2;
      const vx = P2.x - P1.x, vy = P2.y - P1.y; const L = Math.hypot(vx, vy) || 1;
      const nx = -vy / L, ny = vx / L;
      let lx = midx + nx * 10, ly = midy + ny * 10;

      for (const ob of obstacles) {
        if (Math.abs(lx - ob.x) < ob.rx + 12 && Math.abs(ly - ob.y) < ob.ry + 12) {
          const bump = (lx < ob.x ? -1 : 1) * 14;
          lx += bump;
        }
      }
      edgeLabels.push({ x: lx, y: ly, text, w: tw, h: th });
      placedRects.push({ x: lx, y: ly, w: tw, h: th });
    }

    // === BOUNDS del grafo (para centrar/exportar) ===
    {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of names) {
        const p = pos.get(n)!;
        const { rx, ry } = info.get(n)!;
        minX = Math.min(minX, p.x - rx);
        maxX = Math.max(maxX, p.x + rx);
        minY = Math.min(minY, p.y - ry);
        maxY = Math.max(maxY, p.y + ry);
      }
      graphBoundsRef.current = { minX, minY, maxX, maxY };
    }

    // ---------- render ----------
    const render = () => {
      ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.tx, dpr * view.ty);
      // limpiar
      ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cssW = canvas.width / dpr, cssH = canvas.height / dpr;
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.restore();

      ctx.lineJoin = "miter";
      ctx.lineCap = "butt";

      ctx.lineWidth = 1.5 / Math.max(0.75, view.scale);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = FONT;

      placedRects.length = 0;
      edgeLabels.length = 0;
      arrowHeads.length = 0;

      // Colores base para aristas
      ctx.strokeStyle = "#94a3b8";
      ctx.fillStyle = "#94a3b8";

      // ---- 1) ARISTAS (AGRUPADAS) ----
      for (const { from, to, syms } of grouped.values()) {
        const p = pos.get(from)!;
        const qpos = pos.get(to)!;
        const { rx: rxFrom, ry: ryFrom } = info.get(from)!;
        const { rx: rxTo,   ry: ryTo   } = info.get(to)!;

        if (from === to) {
          const cx = p.x, cy = p.y - (ryFrom + 22), r = 16;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.stroke();
          arrowHeads.push({ tip: { x: cx, y: cy + r - (ARROW_MARGIN + 1.2) }, vx: 0, vy: 1 });
          const txt = syms.join(",");
          const tw = Math.max(18, ctx.measureText(txt).width + 8);
          const x = cx, y = cy - r - 8;
          edgeLabels.push({ x, y, text: txt, w: tw, h: 16 });
          placedRects.push({ x, y, w: tw, h: 16 });
          continue;
        }

        const fromShape = automaton.states[from].shape === "rect" ? "rect" : "oval";
        const toShape   = automaton.states[to].shape   === "rect" ? "rect" : "oval";

        if (fromShape === "rect" && toShape === "rect") {
          drawOrthogonalRectEdge(ctx, from, to, syms);
          continue;
        }

        let start = endpointTowardsNode(p, qpos, rxFrom, ryFrom, fromShape);
        let end   = endpointTowardsNode(qpos, p, rxTo, ryTo, toShape);

        const sameLevel = Math.abs(p.y - qpos.y) < 2;
        const ctrl = bezierCtrl(start, end, sameLevel);

        const und = from < to ? `${from}|${to}` : `${to}|${from}`;
        const lanes = pairCount.get(und)!;
        {
          const idx   = pairIndex.get(`${from}|${to}`)!;
          const centerless = idx - (lanes - 1) / 2;
          const BEND = 28, DOCK = 6;
          const vx = end.x - start.x, vy = end.y - start.y;
          const vlen = Math.hypot(vx, vy) || 1;
          const nx = -vy / vlen, ny = vx / vlen;

          (ctrl as any).cx += nx * BEND * centerless;
          (ctrl as any).cy += ny * BEND * centerless;
          start = { x: start.x + nx * DOCK * centerless, y: start.y + ny * DOCK * centerless };
          end   = { x: end.x   + nx * DOCK * centerless, y: end.y   + ny * DOCK * centerless };
        }

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.quadraticCurveTo((ctrl as any).cx, (ctrl as any).cy, end.x, end.y);
        ctx.stroke();

        // punta (curva)
        {
          const tvx = end.x - (ctrl as any).cx, tvy = end.y - (ctrl as any).cy;
          const len = Math.hypot(tvx, tvy) || 1;
          const off = ARROW_MARGIN + 1.2;
          const tip = { x: end.x - (tvx/len)*off, y: end.y - (tvy/len)*off };
          arrowHeads.push({ tip, vx: tvx, vy: tvy });
        }

        // etiqueta
        const txtFull = syms.length <= 6 ? syms.join(",") : `${syms.slice(0,5).join(",")} …(+${syms.length-5})`;
        const p0 = start, p1 = { x: (ctrl as any).cx, y: (ctrl as any).cy }, p2 = end;
        const MIN_EDGE_T = 0.12, MIN_ARC = 70;
        const tMinArc = tForArcFromStart(MIN_ARC, p0, p1, p2);
        const tMaxArc = tForArcFromEnd(MIN_ARC, p0, p1, p2);
        const tMin = Math.max(MIN_EDGE_T, tMinArc);
        const tMax = Math.min(1 - MIN_EDGE_T, tMaxArc);

        const tw = Math.max(18, ctx.measureText(txtFull).width + 8), th = 16;
        const fits = (x: number, y: number) => {
          const badNode = obstacles.some(ob => {
            if (ob.shape === "rect") {
              const dx = Math.abs(x - ob.x), dy = Math.abs(y - ob.y);
              return dx < ob.rx + Math.max(tw, 8) / 2 && dy < ob.ry + Math.max(th, 8) / 2;
            }
            return Math.hypot(x - ob.x, y - ob.y) < Math.max(ob.rx, ob.ry) + Math.max(tw, th) / 2;
          });
          if (badNode) return false;
          const rect = { x, y, w: tw, h: th } as Rect;
          return placedRects.every(r => Math.abs(r.x - rect.x) * 2 >= r.w + rect.w ||
                                        Math.abs(r.y - rect.y) * 2 >= r.h + rect.h);
        };
        const placeAt = (t: number) => {
          const P = qPoint(t, p0, p1, p2); const T = qTangent(t, p0, p1, p2);
          const len = Math.hypot(T.x, T.y) || 1; const nx2 = -T.y / len, ny2 = T.x / len, offset = 10;
          return { x: P.x + nx2 * offset, y: P.y + ny2 * offset };
        };

        let chosen: Rect | null = null;
        const center = Math.max(tMin, Math.min((tMin + tMax) / 2, tMax));
        const ring: number[] = [center];
        for (let step = 0.03; step <= 0.25; step += 0.03) {
          const a = +(center - step).toFixed(3);
          const b = +(center + step).toFixed(3);
          if (a >= tMin) ring.push(a);
          if (b <= tMax) ring.push(b);
        }
        for (const t of ring) { const { x, y } = placeAt(t); if (fits(x, y)) { chosen = { x, y, w: tw, h: th }; break; } }
        if (!chosen) { for (let t = tMin; t <= tMax; t += 0.02) { const { x, y } = placeAt(+t.toFixed(3)); if (fits(x, y)) { chosen = { x, y, w: tw, h: th }; break; } } }
        if (!chosen) { const t = (tMin + tMax) / 2; const { x, y } = placeAt(t); chosen = { x, y, w: tw, h: th }; }

        edgeLabels.push({ x: chosen.x, y: chosen.y, text: txtFull, w: chosen.w, h: chosen.h });
        placedRects.push(chosen);
      }

      // ---- 2) NODOS ----
      for (const n of names) {
        const p = pos.get(n)!;
        const { title, lines, rx, ry } = info.get(n)!;
        const st = automaton.states[n];
        const isStart = n === automaton.start_state;
        const isFinal = st.is_final;
        const isRect = st.shape === "rect";

        (ctx as any).shadowColor = "rgba(0, 0, 0, 0.15)";
        (ctx as any).shadowBlur = 6;
        (ctx as any).shadowOffsetX = 0;
        (ctx as any).shadowOffsetY = 2;

        if (isRect) {
          const x = p.x - rx, y = p.y - ry, w = rx * 2, h = ry * 2, r = 6;
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = isStart ? "#f59e0b" : "#475569";
          ctx.lineWidth = isStart ? 2.5 : 1.8;
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h - r);
          ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          ctx.lineTo(x + r, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = isStart ? "#f59e0b" : isFinal ? "#10b981" : "#475569";
          ctx.lineWidth = isStart ? 2.5 : 1.8;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (isFinal) {
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, rx - 4, ry - 4, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        (ctx as any).shadowColor = "transparent";

        // Texto
        ctx.fillStyle = "#1e293b";
        ctx.font = FONT_BOLD;
        let ty = p.y - (lines.length * LINE_H) / 2 - LINE_H / 2;
        ctx.fillText(title, p.x, ty);
        ctx.font = FONT;
        ty += LINE_H;
        for (const line of lines) { ctx.fillText(line || " ", p.x, ty); ty += LINE_H; }
      }

      // ---- 3) ETIQUETAS DE TRANSICIONES ----
      ctx.font = FONT; (ctx as any).shadowColor = "rgba(0, 0, 0, 0.1)"; (ctx as any).shadowBlur = 3;
      for (const lab of edgeLabels) {
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(lab.x - lab.w / 2, lab.y - 8, lab.w, lab.h);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(lab.text, lab.x, lab.y);
      }
      (ctx as any).shadowColor = "transparent";

      // ---- 4) PUNTAS DE FLECHA ----
      ctx.fillStyle = "#94a3b8";
      for (const ah of arrowHeads) {
        drawArrowHead(ah.tip, ah.vx, ah.vy);
      }

      // ---- 5) FLECHA DE INICIO ----
      if (automaton.start_state && pos.has(automaton.start_state)) {
        const startPos = pos.get(automaton.start_state)!;
        const startInfo = info.get(automaton.start_state)!;
        ctx.strokeStyle = "#f59e0b"; ctx.fillStyle = "#f59e0b"; ctx.lineWidth = 2.5;
        const arrowStartX = startPos.x - startInfo.rx - 40;
        const arrowEndX = startPos.x - startInfo.rx - 5;
        ctx.beginPath(); ctx.moveTo(arrowStartX, startPos.y); ctx.lineTo(arrowEndX, startPos.y); ctx.stroke();
        drawArrowHead({ x: arrowEndX, y: startPos.y }, 1, 0);
      }
    };

    render();
    renderRef.current = render;

    // -------- zoom/pan + DRAG DE NODOS --------
    const worldFromClient = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * dpr;
      const my = (e.clientY - rect.top) * dpr;
      const wx = (mx / dpr - view.tx) / view.scale;
      const wy = (my / dpr - view.ty) / view.scale;
      return { wx, wy };
    };

    const hitNodeAt = (wx: number, wy: number): string | null => {
      for (const n of names.slice().reverse()) {
        const p = pos.get(n)!;
        const { rx, ry } = info.get(n)!;
        const isRect = automaton.states[n].shape === "rect";
        const dx = wx - p.x, dy = wy - p.y;
        if (isRect) {
          if (Math.abs(dx) <= rx && Math.abs(dy) <= ry) return n;
        } else {
          if ((dx*dx)/(rx*rx) + (dy*dy)/(ry*ry) <= 1) return n;
        }
      }
      return null;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * dpr;
      const my = (e.clientY - rect.top) * dpr;
      const scaleFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const wx = (mx / dpr - view.tx) / view.scale;
      const wy = (my / dpr - view.ty) / view.scale;
      const newScale = Math.min(3, Math.max(0.3, view.scale * scaleFactor));
      const newTx = mx / dpr - wx * newScale;
      const newTy = my / dpr - wy * newScale;
      setView(v => ({ ...v, scale: newScale, tx: newTx, ty: newTy }));
    };

    const onDown = (e: MouseEvent) => {
      const { wx, wy } = worldFromClient(e);
      const n = hitNodeAt(wx, wy);
      if (n) {
        draggingNode.current = n;
        const p = pos.get(n)!;
        dragOffset.current = { dx: wx - p.x, dy: wy - p.y };
        (canvas.style as any).cursor = "grabbing";
        isPanning.current = false;
        return;
      }
      isPanning.current = true;
      last.current = { x: e.clientX, y: e.clientY };
      (canvas.style as any).cursor = "grab";
    };

    const onMove = (e: MouseEvent) => {
      const dn = draggingNode.current;
      if (dn) {
        const { wx, wy } = worldFromClient(e);
        const { dx, dy } = dragOffset.current;
        const nx = wx - dx, ny = wy - dy;
        setNodePositions(prev => ({ ...prev, [dn]: { x: nx, y: ny } }));
        return;
      }
      if (!isPanning.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      setView(v => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
    };

    const onUp = () => {
      draggingNode.current = null;
      isPanning.current = false;
      (canvas.style as any).cursor = "default";
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    const id = requestAnimationFrame(render);
    // Auto-fit una sola vez tras el primer render
    if (!(window as any).__autoFitDone__) {
      (window as any).__autoFitDone__ = true;
      requestAnimationFrame(() => fitToContent());
    }

    return () => {
      cancelAnimationFrame(id);
      canvas.removeEventListener("wheel", onWheel as any);
      canvas.removeEventListener("mousedown", onDown as any);
      window.removeEventListener("mousemove", onMove as any);
      window.removeEventListener("mouseup", onUp as any);
    };
  }, [automaton, view, nodePositions]);

// Reemplaza solo el return de tu componente AutomatonVisualizer con esto:

if (!automaton) {
  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-lg">
      <CardContent className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
          <FileText className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-500 font-medium">No hay datos del autómata</p>
      </CardContent>
    </Card>
  );
}

const names = Object.keys(automaton.states);
let trans = 0; 
names.forEach(n => Object.values(automaton.states[n].transitions).forEach(ts => (trans += ts.length)));

return (
  <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300">
    <CardHeader className="border-b border-slate-100 bg-gradient-to-br from-white to-slate-50">
      <CardTitle className="flex items-center justify-between text-indigo-700">
        <span className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          {title}
        </span>
        <div className="flex gap-2">
          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 font-semibold">
            {names.length} estados
          </Badge>
          <Badge className="bg-purple-100 text-purple-700 border-purple-200 font-semibold">
            {trans} transiciones
          </Badge>
        </div>
      </CardTitle>
      <CardDescription className="text-slate-600">{description}</CardDescription>
    </CardHeader>

    <CardContent className="pt-6">
      <div className="flex flex-col gap-4">
        {/* Controles mejorados */}
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleReset}
            className="bg-white hover:bg-indigo-50 border-indigo-200 text-indigo-700 hover:text-indigo-800 hover:border-indigo-300 transition-all"
          >
            <Maximize2 className="w-4 h-4 mr-1.5" />
            Ajustar vista
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleDownloadFull("png")}
            className="bg-white hover:bg-green-50 border-green-200 text-green-700 hover:text-green-800 hover:border-green-300 transition-all"
          >
            <FileImage className="w-4 h-4 mr-1.5" />
            PNG completo
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleDownloadFull("pdf")}
            className="bg-white hover:bg-red-50 border-red-200 text-red-700 hover:text-red-800 hover:border-red-300 transition-all"
          >
            <FileText className="w-4 h-4 mr-1.5" />
            PDF completo
          </Button>

          <div className="h-8 w-px bg-slate-200 mx-1" />

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleZoomIn}
            className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 transition-all"
          >
            <ZoomIn className="w-4 h-4 mr-1.5" />
            Acercar
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleZoomOut}
            className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 transition-all"
          >
            <ZoomOut className="w-4 h-4 mr-1.5" />
            Alejar
          </Button>
        </div>

        {/* Info del autómata */}
        <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Alfabeto:</span>
            <div className="flex gap-1">
              {automaton.alphabet.map((sym, i) => (
                <Badge key={i} variant="secondary" className="text-xs bg-white border-slate-200">
                  {sym}
                </Badge>
              ))}
            </div>
          </div>
          <div className="h-5 w-px bg-slate-300" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Estado inicial:</span>
            <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-200">
              {automaton.start_state}
            </Badge>
          </div>
        </div>

        {/* Canvas con mejor diseño */}
        <div 
          ref={wrapperRef} 
          className="relative border-2 border-slate-200 rounded-xl bg-gradient-to-br from-slate-50 via-white to-blue-50 overflow-hidden shadow-inner"
          style={{ height: '32rem' }}
        >
          <canvas 
            ref={canvasRef} 
            className="w-full h-full block cursor-move" 
          />
          
          {/* Indicador de arrastre */}
          <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm border border-slate-200 shadow-lg">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Move className="w-3.5 h-3.5" />
              <span className="font-medium">Arrastra nodos • Rueda para zoom • Click y arrastra para mover</span>
            </div>
          </div>
        </div>

        {/* Leyenda mejorada */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full border-2 border-orange-500 bg-white shadow-sm" />
            <span className="text-sm font-medium text-slate-700">Estado inicial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full border-2 border-green-500 bg-white relative shadow-sm">
              <div className="absolute inset-0.5 rounded-full border border-green-500" />
            </div>
            <span className="text-sm font-medium text-slate-700">Estado final</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border-2 border-slate-500 bg-white shadow-sm" />
            <span className="text-sm font-medium text-slate-700">Estado DFA</span>
          </div>
        </div>

        {/* Información detallada */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-sm">
            <h4 className="font-semibold text-indigo-700 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              Estados ({names.length})
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {names.map(n => {
                const s = automaton.states[n];
                return (
                  <div 
                    key={n} 
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                  >
                    <span
                      className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${
                        n === automaton.start_state
                          ? "bg-orange-500 ring-2 ring-orange-200"
                          : s.is_final
                          ? "bg-green-500 ring-2 ring-green-200"
                          : "bg-slate-400"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800">
                        {n}
                        <span className="text-xs text-slate-500 ml-2">
                          ({s.shape === "rect" ? "DFA" : "AFN"})
                        </span>
                      </div>
                      {s.label && (
                        <pre className="text-xs text-slate-600 whitespace-pre-wrap break-words mt-1 font-mono">
                          {s.label.replace(/\\n/g, "\n")}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-sm">
            <h4 className="font-semibold text-purple-700 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              Transiciones ({trans})
            </h4>
            <div className="space-y-1 max-h-64 overflow-y-auto pr-2 font-mono text-xs">
              {names.flatMap(from =>
                Object.entries(automaton.states[from].transitions).flatMap(([sym, tos]) =>
                  tos.map((to, i) => (
                    <div 
                      key={`${from}-${sym}-${to}-${i}`} 
                      className="p-2 rounded hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                    >
                      <span className="text-slate-600">δ(</span>
                      <span className="text-slate-800 font-semibold">{from}</span>
                      <span className="text-slate-600">, </span>
                      <span className="text-indigo-600 font-bold">{sym}</span>
                      <span className="text-slate-600">) = </span>
                      <span className="text-slate-800 font-semibold">{to}</span>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);
}

export default AutomatonVisualizer;
