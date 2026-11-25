import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Box,
  Check,
  Code2,
  Copy,
  Eye,
  Grid,
  Layers,
  Orbit,
  Palette,
  RotateCcw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  buildPreviewUtilityCss,
  cleanTailwindMarkup,
  compareSpecificityDuel,
  computeCssSpecificity,
  extractDomSnapshot,
} from './core/analyzer.ts';
import { CSS_XRAY_PRESETS } from './core/presets.ts';
import type { LayoutNodeSnapshot } from './core/types.ts';

type CameraPreset = 'iso' | 'side' | 'top' | 'steep';
type ColorMode = 'diagnostic' | 'depth';

const DEPTH_PALETTE = [
  'border-sky-500/70 bg-sky-500/10',
  'border-cyan-400/75 bg-cyan-500/12',
  'border-emerald-400/75 bg-emerald-500/12',
  'border-amber-400/75 bg-amber-500/12',
  'border-rose-400/80 bg-rose-500/15',
  'border-fuchsia-400/80 bg-fuchsia-500/15',
];

function BoxModelDiagram({ node }: { node: LayoutNodeSnapshot }) {
  const { margin, border, padding } = node.boxModel;
  return (
    <div className="rounded-lg border border-slate-800 bg-[#111827] p-2.5 text-center font-mono text-[10px]">
      <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-wider text-slate-400">
        <span>CSS Box Model</span>
        <span className="text-cyan-300">{node.rect.width}×{node.rect.height}px</span>
      </div>
      <div className="rounded border border-dashed border-amber-500/60 bg-amber-500/10 p-2">
        <div className="text-[9px] text-amber-300">margin {margin[0]}</div>
        <div className="my-1 flex items-center justify-between gap-1">
          <span className="text-[9px] text-amber-300">{margin[3]}</span>
          <div className="flex-1 rounded border border-violet-400/60 bg-violet-500/10 p-1.5">
            <div className="text-[9px] text-violet-300">border {border[0]}</div>
            <div className="my-1 flex items-center justify-between gap-1">
              <span className="text-[9px] text-violet-300">{border[3]}</span>
              <div className="flex-1 rounded border border-emerald-400/60 bg-emerald-500/10 p-1.5">
                <div className="text-[9px] text-emerald-300">pad {padding[0]}</div>
                <div className="my-1 flex items-center justify-between gap-1">
                  <span className="text-[9px] text-emerald-300">{padding[3]}</span>
                  <div className="flex-1 rounded border border-cyan-400/70 bg-cyan-500/20 px-2 py-1 text-[10px] font-bold text-cyan-100">
                    {Math.max(0, node.rect.width - padding[1] - padding[3] - border[1] - border[3])}×
                    {Math.max(0, node.rect.height - padding[0] - padding[2] - border[0] - border[2])}
                  </div>
                  <span className="text-[9px] text-emerald-300">{padding[1]}</span>
                </div>
                <div className="text-[9px] text-emerald-300">{padding[2]}</div>
              </div>
              <span className="text-[9px] text-violet-300">{border[1]}</span>
            </div>
            <div className="text-[9px] text-violet-300">{border[2]}</div>
          </div>
          <span className="text-[9px] text-amber-300">{margin[1]}</span>
        </div>
        <div className="text-[9px] text-amber-300">{margin[2]}</div>
      </div>
    </div>
  );
}

export function App() {
  const [presetId, setPresetId] = useState(CSS_XRAY_PRESETS[0].id);
  const [htmlCode, setHtmlCode] = useState(CSS_XRAY_PRESETS[0].html);
  const [cssCode, setCssCode] = useState(CSS_XRAY_PRESETS[0].css);
  const [nodes, setNodes] = useState<LayoutNodeSnapshot[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // 3D isometric orbit & visual controls
  const [orbit, setOrbit] = useState({ rx: 52, rz: -34, zoom: 0.92, explode: 28 });
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>('diagnostic');
  const [showGridOverlay, setShowGridOverlay] = useState(true);
  const [showStackingOnly, setShowStackingOnly] = useState(false);
  const [cleanupBanner, setCleanupBanner] = useState<string | null>(null);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [duelA, setDuelA] = useState('#app .nav > a:hover');
  const [duelB, setDuelB] = useState('.nav .link.active::before');
  const duelResult = useMemo(() => compareSpecificityDuel(duelA, duelB), [duelA, duelB]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const orbitDragRef = useRef<{ sx: number; sy: number; rx: number; rz: number } | null>(null);

  useEffect(() => {
    if (!autoOrbit) return;
    let raf = 0;
    const tick = () => {
      setOrbit((o) => ({ ...o, rz: (o.rz + 0.35) % 360 }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoOrbit]);

  const setCameraPreset = (preset: CameraPreset) => {
    setAutoOrbit(false);
    if (preset === 'iso') setOrbit({ rx: 52, rz: -34, zoom: 0.92, explode: 28 });
    else if (preset === 'side') setOrbit({ rx: 78, rz: 0, zoom: 0.95, explode: 42 });
    else if (preset === 'top') setOrbit({ rx: 14, rz: 0, zoom: 0.96, explode: 14 });
    else setOrbit({ rx: 64, rz: -48, zoom: 0.88, explode: 46 });
  };

  const loadPreset = (id: string) => {
    const p = CSS_XRAY_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPresetId(p.id);
    setHtmlCode(p.html);
    setCssCode(p.css);
    setCleanupBanner(null);
  };

  const tailwindAudit = useMemo(() => cleanTailwindMarkup(htmlCode), [htmlCode]);

  const parsedCssRules = useMemo(() => {
    const rules: Array<{ selector: string; specificity: ReturnType<typeof computeCssSpecificity> }> = [];
    for (const m of cssCode.matchAll(/([^{}]+)\{[^}]*\}/g)) {
      const sel = m[1].trim();
      if (sel) rules.push({ selector: sel, specificity: computeCssSpecificity(sel) });
    }
    return rules;
  }, [cssCode]);

  const srcDoc = useMemo(() => {
    const utilityCss = buildPreviewUtilityCss(htmlCode);
    return `<!doctype html>
<html>
<head><style>${utilityCss}\n${cssCode}</style></head>
<body>${htmlCode}</body>
</html>`;
  }, [htmlCode, cssCode]);

  const measureIframe = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const snap = extractDomSnapshot(doc);
    setNodes(snap);
    if (snap.length > 0 && (!selectedNodeId || !snap.some((n) => n.id === selectedNodeId))) {
      setSelectedNodeId(snap[Math.min(1, snap.length - 1)].id);
    }
  };

  useEffect(() => {
    const t = setTimeout(measureIframe, 80);
    return () => clearTimeout(t);
  }, [srcDoc]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? nodes[0] ?? null,
    [nodes, selectedNodeId],
  );

  const displayedNodes = useMemo(
    () => (showStackingOnly ? nodes.filter((n) => n.stacking.createsContext) : nodes),
    [nodes, showStackingOnly],
  );

  const stackingTree = useMemo(
    () => nodes.filter((n) => n.stacking.createsContext || n.stacking.parentTrapWarning),
    [nodes],
  );

  const applyOneClickCleanup = () => {
    if (tailwindAudit.totalRemoved === 0) return;
    setHtmlCode(tailwindAudit.cleanedMarkup);
    setCleanupBanner(`Removed ${tailwindAudit.totalRemoved} conflicting/redundant Tailwind classes.`);
    setTimeout(() => setCleanupBanner(null), 2600);
  };

  const copyCleanMarkup = async () => {
    try {
      await navigator.clipboard.writeText(tailwindAudit.cleanedMarkup);
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const stackingCount = nodes.filter((n) => n.stacking.createsContext).length;
  const overflowCount = nodes.filter((n) => n.overflowBug).length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0B0F17] text-slate-100">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 bg-[#111827] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/15 text-cyan-300">
            <Box className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-50">css-xray</h1>
              <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                3D ISOMETRIC DOM
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {nodes.length} layers · {stackingCount} stacking contexts ·{' '}
              <span className={tailwindAudit.totalRemoved ? 'text-amber-300' : 'text-emerald-400'}>
                {tailwindAudit.totalRemoved} Tailwind conflicts
              </span>
              {overflowCount > 0 && <span className="text-rose-400"> · {overflowCount} overflow trap(s)</span>}
            </p>
          </div>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          {CSS_XRAY_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => loadPreset(p.id)}
              className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                presetId === p.id
                  ? 'border-cyan-500/60 bg-cyan-500/15 font-semibold text-cyan-200'
                  : 'border-slate-700 bg-[#0B0F17] text-slate-300 hover:border-slate-500'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </header>

      {/* Main Split Workbench */}
      <div className="grid flex-1 overflow-hidden lg:grid-cols-[0.95fr_1.35fr_0.95fr]">
        {/* Left: Markup & CSS Editors + Live Preview */}
        <section className="flex flex-col overflow-hidden border-r border-slate-800 bg-[#0B0F17]">
          <div className="flex items-center justify-between border-b border-slate-800 bg-[#111827] px-3 py-2 text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5 text-cyan-400" /> HTML / Tailwind Markup
            </span>
            <div className="flex items-center gap-1.5">
              {tailwindAudit.totalRemoved > 0 && (
                <button
                  type="button"
                  onClick={applyOneClickCleanup}
                  className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200 hover:bg-amber-500/25"
                >
                  <Wand2 className="h-3 w-3" /> Clean {tailwindAudit.totalRemoved}
                </button>
              )}
              <button
                type="button"
                onClick={copyCleanMarkup}
                className="inline-flex items-center gap-1 rounded border border-slate-700 bg-[#0B0F17] px-2 py-0.5 text-[10px] text-slate-300 hover:border-cyan-500"
                title="Copy cleaned HTML markup"
              >
                {copiedHtml ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>Copy</span>
              </button>
            </div>
          </div>
          <textarea
            value={htmlCode}
            onChange={(e) => setHtmlCode(e.target.value)}
            spellCheck={false}
            className="h-44 w-full resize-none border-b border-slate-800 bg-[#0B0F17] p-3 font-mono text-[11.5px] leading-5 text-sky-100 focus:outline-none"
          />

          <div className="border-b border-slate-800 bg-[#111827] px-3 py-1.5 text-xs font-semibold text-slate-300">
            Custom CSS Rules
          </div>
          <textarea
            value={cssCode}
            onChange={(e) => setCssCode(e.target.value)}
            spellCheck={false}
            className="h-28 w-full resize-none border-b border-slate-800 bg-[#0B0F17] p-3 font-mono text-[11.5px] leading-5 text-violet-100 focus:outline-none"
          />

          <div className="flex items-center justify-between border-b border-slate-800 bg-[#111827] px-3 py-1.5 text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-emerald-400" /> Live Preview + Geometry Probe
            </span>
            <button
              type="button"
              onClick={() => setShowGridOverlay((v) => !v)}
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] ${
                showGridOverlay ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'
              }`}
            >
              <Grid className="h-3 w-3" /> Track Overlays
            </button>
          </div>
          <div className="relative flex-1 overflow-auto bg-[#0f172a]">
            <iframe
              ref={iframeRef}
              title="css-xray preview"
              srcDoc={srcDoc}
              onLoad={measureIframe}
              sandbox="allow-same-origin"
              className="h-full w-full border-0"
            />
            {showGridOverlay && (
              <div className="pointer-events-none absolute inset-0">
                {nodes.map((n) => {
                  const isFlexOrGrid = n.display.includes('flex') || n.display.includes('grid');
                  const sel = selectedNode?.id === n.id;
                  if (!isFlexOrGrid && !sel && !n.overflowBug) return null;
                  return (
                    <div
                      key={n.id}
                      style={{
                        left: n.rect.x,
                        top: n.rect.y,
                        width: n.rect.width,
                        height: n.rect.height,
                        backgroundImage:
                          isFlexOrGrid && n.gap !== '0px'
                            ? 'repeating-linear-gradient(45deg, rgba(168,85,247,0.08) 0px, rgba(168,85,247,0.08) 4px, transparent 4px, transparent 10px)'
                            : undefined,
                      }}
                      className={`absolute border border-dashed ${
                        n.overflowBug
                          ? 'border-rose-500 bg-rose-500/15'
                          : sel
                            ? 'border-cyan-400 bg-cyan-400/10'
                            : 'border-violet-400/65'
                      }`}
                    >
                      <span className="inline-block bg-[#0B0F17]/90 px-1 font-mono text-[9px] text-cyan-300">
                        {n.tag} ({n.display}{n.gap !== '0px' && n.gap !== 'normal' ? ` · gap ${n.gap}` : ''})
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Center: Interactive 3D Isometric DOM Stack */}
        <section
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('[data-xray-layer]')) return;
            setAutoOrbit(false);
            orbitDragRef.current = { sx: e.clientX, sy: e.clientY, rx: orbit.rx, rz: orbit.rz };
          }}
          onPointerMove={(e) => {
            const d = orbitDragRef.current;
            if (!d) return;
            const dx = e.clientX - d.sx;
            const dy = e.clientY - d.sy;
            setOrbit((o) => ({
              ...o,
              rz: d.rz + dx * 0.35,
              rx: Math.max(10, Math.min(84, d.rx - dy * 0.35)),
            }));
          }}
          onPointerUp={() => {
            orbitDragRef.current = null;
          }}
          onWheel={(e) => {
            setOrbit((o) => ({ ...o, zoom: Math.max(0.45, Math.min(1.6, o.zoom + (e.deltaY < 0 ? 0.06 : -0.06))) }));
          }}
          className="relative flex flex-col overflow-hidden border-r border-slate-800 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] select-none cursor-grab active:cursor-grabbing"
        >
          {/* 3D Controls Bar */}
          <div className="z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#111827]/90 px-3 py-2 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 text-slate-300">
                <Layers className="h-3.5 w-3.5 text-cyan-400" />
                <span>Explode</span>
                <input
                  type="range"
                  min={0}
                  max={68}
                  value={orbit.explode}
                  onChange={(e) => setOrbit((o) => ({ ...o, explode: Number(e.target.value) }))}
                  className="w-20 accent-cyan-400"
                />
                <span className="font-mono text-[10px] text-cyan-300">{orbit.explode}px</span>
              </label>

              <div className="flex rounded border border-slate-700 bg-[#0B0F17] p-0.5 text-[10px]">
                {(
                  [
                    { id: 'iso', label: 'Iso' },
                    { id: 'side', label: 'Slice' },
                    { id: 'top', label: 'Top' },
                    { id: 'steep', label: 'Deep' },
                  ] as const
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCameraPreset(c.id)}
                    className="rounded px-1.5 py-0.5 text-slate-300 hover:bg-slate-800 hover:text-cyan-200"
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setColorMode((m) => (m === 'diagnostic' ? 'depth' : 'diagnostic'))}
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] ${
                  colorMode === 'depth'
                    ? 'border-fuchsia-500/60 bg-fuchsia-500/15 text-fuchsia-200'
                    : 'border-slate-700 text-slate-300'
                }`}
              >
                <Palette className="h-3 w-3" /> {colorMode === 'depth' ? 'Depth Heatmap' : 'Diagnostics'}
              </button>

              <button
                type="button"
                onClick={() => setShowStackingOnly((v) => !v)}
                className={`rounded border px-2 py-0.5 text-[10px] ${
                  showStackingOnly
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                    : 'border-slate-700 text-slate-300'
                }`}
              >
                Stacking ({stackingCount})
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAutoOrbit((v) => !v)}
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] ${
                  autoOrbit
                    ? 'border-cyan-500/60 bg-cyan-500/20 text-cyan-200'
                    : 'border-slate-700 bg-[#0B0F17] text-slate-300 hover:border-cyan-500'
                }`}
              >
                <Orbit className="h-3 w-3" /> {autoOrbit ? 'Spinning' : 'Spin'}
              </button>
              <button
                type="button"
                onClick={() => setCameraPreset('iso')}
                className="inline-flex items-center gap-1 rounded border border-slate-700 bg-[#0B0F17] px-2 py-0.5 text-[10px] text-slate-300 hover:border-cyan-500"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden [perspective:1400px]">
            <div className="pointer-events-none absolute left-4 top-3 text-[11px] text-slate-400">
              Drag to orbit 3D DOM planes · Scroll to zoom · Click any layer to inspect
            </div>

            <div
              style={{
                width: 440,
                height: 360,
                transformStyle: 'preserve-3d',
                transform: `scale(${orbit.zoom}) rotateX(${orbit.rx}deg) rotateZ(${orbit.rz}deg)`,
              }}
              className="relative transition-transform duration-75"
            >
              {/* Base shadow plate */}
              <div
                style={{ transform: 'translateZ(-10px)' }}
                className="pointer-events-none absolute inset-0 rounded-2xl border border-slate-800/80 bg-slate-950/60 shadow-[0_30px_70px_rgba(0,0,0,0.8)]"
              />

              {displayedNodes.map((n) => {
                const isSel = selectedNode?.id === n.id;
                const zOffset = n.depth * orbit.explode;
                const accent =
                  colorMode === 'depth'
                    ? DEPTH_PALETTE[n.depth % DEPTH_PALETTE.length]
                    : n.overflowBug
                      ? 'border-rose-500 bg-rose-500/18'
                      : n.stacking.createsContext
                        ? 'border-amber-400/85 bg-amber-500/12'
                        : n.display.includes('grid') || n.display.includes('flex')
                          ? 'border-violet-400/80 bg-violet-500/12'
                          : 'border-cyan-500/55 bg-cyan-500/10';
                return (
                  <button
                    key={n.id}
                    type="button"
                    data-xray-layer
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNodeId(n.id);
                    }}
                    style={{
                      left: Math.min(340, n.rect.x * 0.72),
                      top: Math.min(280, n.rect.y * 0.72),
                      width: Math.max(88, Math.min(380, n.rect.width * 0.72)),
                      height: Math.max(34, Math.min(280, n.rect.height * 0.72)),
                      transform: `translateZ(${zOffset}px)`,
                      transformStyle: 'preserve-3d',
                    }}
                    className={`absolute flex flex-col justify-between rounded-lg border p-1.5 text-left backdrop-blur-[1px] transition ${accent} ${
                      isSel ? 'ring-2 ring-cyan-300 shadow-[0_0_28px_rgba(34,211,238,0.55)]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 font-mono text-[10px] font-bold text-slate-100">
                      <span className="truncate">&lt;{n.tag}&gt;{n.classes[0] ? `.${n.classes[0]}` : ''}</span>
                      {n.stacking.zIndex !== 'auto' && (
                        <span className="rounded bg-amber-500/25 px-1 text-[9px] text-amber-200">
                          z:{n.stacking.zIndex}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between font-mono text-[9px] text-slate-300">
                      <span>d{n.depth} · {n.display}</span>
                      <span>
                        {n.rect.width}×{n.rect.height}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right: Box Model, Stacking Context Tree, Specificity Bars & Tailwind Audit */}
        <aside className="flex flex-col space-y-3.5 overflow-y-auto bg-[#111827] p-4">
          {cleanupBanner && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200">
              <Check className="h-4 w-4" />
              <span>{cleanupBanner}</span>
            </div>
          )}

          {/* Selected Element Box Model & Stacking Info */}
          {selectedNode && (
            <div className="space-y-2.5 rounded-xl border border-slate-800 bg-[#0B0F17] p-3.5">
              <div className="flex items-center justify-between">
                <span className="truncate font-mono text-xs font-bold text-cyan-300">
                  &lt;{selectedNode.tag}&gt; {selectedNode.classes.slice(0, 3).map((c) => `.${c}`).join('')}
                </span>
                <span className="font-mono text-[11px] text-slate-400">depth {selectedNode.depth}</span>
              </div>

              <BoxModelDiagram node={selectedNode} />

              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-slate-300">
                <div>display: <span className="text-slate-100">{selectedNode.display}</span></div>
                <div>position: <span className="text-slate-100">{selectedNode.position}</span></div>
                <div>z-index: <span className="text-amber-300">{selectedNode.zIndex}</span></div>
                <div>opacity: <span className="text-slate-100">{selectedNode.opacity}</span></div>
                {selectedNode.gridTemplateColumns !== 'none' && (
                  <div className="col-span-2 truncate">grid-cols: <span className="text-violet-300">{selectedNode.gridTemplateColumns}</span></div>
                )}
              </div>

              <div className={`rounded-lg border px-2.5 py-2 text-xs ${
                selectedNode.stacking.createsContext
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                  : 'border-slate-800 bg-[#111827] text-slate-400'
              }`}>
                <div className="font-semibold">
                  {selectedNode.stacking.createsContext ? 'Creates Stacking Context' : 'No Stacking Context'}
                </div>
                <div className="text-[11px] opacity-90">{selectedNode.stacking.reason}</div>
                {selectedNode.stacking.parentTrapWarning && (
                  <div className="mt-1 font-semibold text-rose-300">{selectedNode.stacking.parentTrapWarning}</div>
                )}
              </div>

              {selectedNode.overflowBug && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-2 text-xs text-rose-200">
                  <strong>Overflow detected:</strong> scrollWidth exceeds clientWidth. Add <code className="font-mono">min-w-0</code> or <code className="font-mono">overflow-hidden</code>.
                </div>
              )}
            </div>
          )}

          {/* Stacking Context Hierarchy Tree */}
          {stackingTree.length > 0 && (
            <div className="space-y-2 rounded-xl border border-slate-800 bg-[#0B0F17] p-3.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Stacking Context Tree ({stackingTree.length})
              </div>
              <div className="space-y-1">
                {stackingTree.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelectedNodeId(n.id)}
                    style={{ paddingLeft: `${Math.min(4, n.depth) * 12 + 8}px` }}
                    className={`flex w-full items-center justify-between rounded border px-2 py-1 text-left font-mono text-[11px] transition ${
                      selectedNode?.id === n.id
                        ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-100'
                        : 'border-slate-800 bg-[#111827] text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span className="truncate">&lt;{n.tag}&gt;{n.classes[0] ? `.${n.classes[0]}` : ''}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] ${
                      n.stacking.parentTrapWarning ? 'bg-rose-500/25 text-rose-200' : 'bg-amber-500/20 text-amber-200'
                    }`}>
                      {n.stacking.parentTrapWarning ? `TRAPPED z:${n.zIndex}` : `z:${n.zIndex}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tailwind Utility Conflicts + 1-Click Fix */}
          <div className="space-y-2.5 rounded-xl border border-slate-800 bg-[#0B0F17] p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-200">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                <span>Tailwind Class Audit</span>
              </div>
              {tailwindAudit.totalRemoved > 0 && (
                <button
                  type="button"
                  onClick={applyOneClickCleanup}
                  className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/30"
                >
                  <Sparkles className="h-3 w-3" /> Fix All
                </button>
              )}
            </div>

            {tailwindAudit.allConflicts.length === 0 ? (
              <p className="text-xs text-emerald-400">Zero redundant or conflicting utility classes detected.</p>
            ) : (
              <div className="space-y-1.5">
                {tailwindAudit.allConflicts.map((c, idx) => (
                  <div key={idx} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[11px]">
                    <div className="font-mono text-amber-300">
                      <del>{c.className}</del> → <strong>{c.overriddenBy}</strong>
                    </div>
                    <div className="text-slate-400">{c.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CSS Selector Specificity Breakdown with Visual Weight Meters */}
          <div className="space-y-2 rounded-xl border border-slate-800 bg-[#0B0F17] p-3.5">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-200">
              <span>CSS Rule Specificity</span>
              <span className="font-mono text-[9px] font-normal text-slate-400">(ID, Class, Tag)</span>
            </div>
            {parsedCssRules.length === 0 ? (
              <p className="text-xs text-slate-500">Add CSS rules to compute selector specificity.</p>
            ) : (
              <div className="space-y-1.5">
                {parsedCssRules.map((r, i) => {
                  const total = Math.max(1, r.specificity.ids * 4 + r.specificity.classes * 2 + r.specificity.elements);
                  return (
                    <div key={i} className="rounded border border-slate-800 bg-[#111827] px-2.5 py-1.5 font-mono text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-slate-200">{r.selector}</span>
                        <span className="shrink-0 rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-300">
                          {r.specificity.formatted}
                        </span>
                      </div>
                      <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div className="bg-rose-400" style={{ width: `${(r.specificity.ids * 4 / total) * 100}%` }} />
                        <div className="bg-violet-400" style={{ width: `${(r.specificity.classes * 2 / total) * 100}%` }} />
                        <div className="bg-cyan-400" style={{ width: `${(r.specificity.elements / total) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Selector Specificity Duel Calculator */}
          <div className="space-y-2 rounded-xl border border-slate-800 bg-[#0B0F17] p-3.5">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-cyan-300">
              <span>Specificity Duel Calculator</span>
              <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px]">
                {duelResult.winner === 'tie' ? 'TIE (SOURCE ORDER)' : `WINNER: ${duelResult.winner}`}
              </span>
            </div>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-5 text-center font-bold text-sky-300">A</span>
                <input
                  value={duelA}
                  onChange={(e) => setDuelA(e.target.value)}
                  className="flex-1 rounded border border-slate-700 bg-[#111827] px-2 py-1 text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
                <span className={`rounded px-1.5 py-0.5 ${duelResult.winner === 'A' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                  {duelResult.a.formatted}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-5 text-center font-bold text-violet-300">B</span>
                <input
                  value={duelB}
                  onChange={(e) => setDuelB(e.target.value)}
                  className="flex-1 rounded border border-slate-700 bg-[#111827] px-2 py-1 text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
                <span className={`rounded px-1.5 py-0.5 ${duelResult.winner === 'B' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                  {duelResult.b.formatted}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">{duelResult.explanation}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
