import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Box,
  Check,
  Code2,
  Eye,
  Grid,
  Layers,
  RotateCcw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  analyzeTailwindClasses,
  buildPreviewUtilityCss,
  cleanTailwindMarkup,
  computeCssSpecificity,
  extractDomSnapshot,
} from './core/analyzer.ts';
import { CSS_XRAY_PRESETS } from './core/presets.ts';
import type { LayoutNodeSnapshot } from './core/types.ts';

export function App() {
  const [presetId, setPresetId] = useState(CSS_XRAY_PRESETS[0].id);
  const [htmlCode, setHtmlCode] = useState(CSS_XRAY_PRESETS[0].html);
  const [cssCode, setCssCode] = useState(CSS_XRAY_PRESETS[0].css);
  const [nodes, setNodes] = useState<LayoutNodeSnapshot[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // 3D isometric orbit & explosion state
  const [orbit, setOrbit] = useState({ rx: 52, rz: -34, zoom: 0.92, explode: 26 });
  const [showGridOverlay, setShowGridOverlay] = useState(true);
  const [showStackingOnly, setShowStackingOnly] = useState(false);
  const [cleanupBanner, setCleanupBanner] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const orbitDragRef = useRef<{ sx: number; sy: number; rx: number; rz: number } | null>(null);

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

  const applyOneClickCleanup = () => {
    if (tailwindAudit.totalRemoved === 0) return;
    setHtmlCode(tailwindAudit.cleanedMarkup);
    setCleanupBanner(`Removed ${tailwindAudit.totalRemoved} conflicting/redundant Tailwind classes.`);
    setTimeout(() => setCleanupBanner(null), 2600);
  };

  const stackingCount = nodes.filter((n) => n.stacking.createsContext).length;
  const overflowCount = nodes.filter((n) => n.overflowBug).length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0B0F17] text-slate-100">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#111827] px-4 py-2.5">
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
      <div className="grid flex-1 overflow-hidden lg:grid-cols-[0.95fr_1.35fr_0.9fr]">
        {/* Left: Markup & CSS Editors + Live Preview */}
        <section className="flex flex-col overflow-hidden border-r border-slate-800 bg-[#0B0F17]">
          <div className="flex items-center justify-between border-b border-slate-800 bg-[#111827] px-3 py-2 text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5 text-cyan-400" /> HTML / Tailwind Markup
            </span>
            {tailwindAudit.totalRemoved > 0 && (
              <button
                type="button"
                onClick={applyOneClickCleanup}
                className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200 hover:bg-amber-500/25"
              >
                <Wand2 className="h-3 w-3" /> Clean {tailwindAudit.totalRemoved} Conflicts
              </button>
            )}
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
                      }}
                      className={`absolute border border-dashed ${
                        n.overflowBug
                          ? 'border-rose-500 bg-rose-500/10'
                          : sel
                            ? 'border-cyan-400 bg-cyan-400/10'
                            : 'border-violet-400/60'
                      }`}
                    >
                      <span className="inline-block bg-[#0B0F17]/90 px-1 font-mono text-[9px] text-cyan-300">
                        {n.tag} ({n.display})
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
              rx: Math.max(12, Math.min(82, d.rx - dy * 0.35)),
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
          <div className="z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#111827]/90 px-4 py-2 backdrop-blur">
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-2 text-slate-300">
                <Layers className="h-3.5 w-3.5 text-cyan-400" />
                <span>Explode</span>
                <input
                  type="range"
                  min={0}
                  max={64}
                  value={orbit.explode}
                  onChange={(e) => setOrbit((o) => ({ ...o, explode: Number(e.target.value) }))}
                  className="w-24 accent-cyan-400"
                />
                <span className="font-mono text-[11px] text-cyan-300">{orbit.explode}px</span>
              </label>

              <button
                type="button"
                onClick={() => setShowStackingOnly((v) => !v)}
                className={`rounded border px-2 py-0.5 text-[11px] ${
                  showStackingOnly
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                    : 'border-slate-700 text-slate-300'
                }`}
              >
                Stacking Contexts Only ({stackingCount})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setOrbit({ rx: 52, rz: -34, zoom: 0.92, explode: 26 })}
              className="inline-flex items-center gap-1 rounded border border-slate-700 bg-[#0B0F17] px-2 py-0.5 text-[11px] text-slate-300 hover:border-cyan-500"
            >
              <RotateCcw className="h-3 w-3" /> Reset 3D
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden [perspective:1400px]">
            <div className="pointer-events-none absolute left-4 top-3 text-[11px] text-slate-400">
              Drag to orbit 3D layers · Scroll to zoom · Click any plane to inspect
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
              {displayedNodes.map((n) => {
                const isSel = selectedNode?.id === n.id;
                const zOffset = n.depth * orbit.explode;
                const accent = n.overflowBug
                  ? 'border-rose-500 bg-rose-500/15'
                  : n.stacking.createsContext
                    ? 'border-amber-400/80 bg-amber-500/10'
                    : n.display.includes('grid') || n.display.includes('flex')
                      ? 'border-violet-400/80 bg-violet-500/10'
                      : 'border-cyan-500/50 bg-cyan-500/10';
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
                      width: Math.max(84, Math.min(380, n.rect.width * 0.72)),
                      height: Math.max(32, Math.min(280, n.rect.height * 0.72)),
                      transform: `translateZ(${zOffset}px)`,
                      transformStyle: 'preserve-3d',
                    }}
                    className={`absolute flex flex-col justify-between rounded-lg border p-1.5 text-left transition ${accent} ${
                      isSel ? 'ring-2 ring-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.45)]' : ''
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
                      <span>{n.display}</span>
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

        {/* Right: Diagnostics, Stacking Contexts, Specificity & Tailwind Cleanup */}
        <aside className="flex flex-col overflow-y-auto bg-[#111827] p-4 space-y-4">
          {cleanupBanner && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200">
              <Check className="h-4 w-4" />
              <span>{cleanupBanner}</span>
            </div>
          )}

          {/* Selected Element Box & Stacking Info */}
          {selectedNode && (
            <div className="rounded-xl border border-slate-800 bg-[#0B0F17] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-cyan-300">
                  &lt;{selectedNode.tag}&gt; {selectedNode.classes.slice(0, 3).map((c) => `.${c}`).join('')}
                </span>
                <span className="font-mono text-[11px] text-slate-400">depth {selectedNode.depth}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-slate-300">
                <div>display: <span className="text-slate-100">{selectedNode.display}</span></div>
                <div>position: <span className="text-slate-100">{selectedNode.position}</span></div>
                <div>z-index: <span className="text-amber-300">{selectedNode.zIndex}</span></div>
                <div>size: <span className="text-slate-100">{selectedNode.rect.width}×{selectedNode.rect.height}px</span></div>
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

          {/* Tailwind Utility Conflicts + 1-Click Fix */}
          <div className="rounded-xl border border-slate-800 bg-[#0B0F17] p-3.5 space-y-2.5">
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

          {/* CSS Selector Specificity Breakdown */}
          <div className="rounded-xl border border-slate-800 bg-[#0B0F17] p-3.5 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-200">
              CSS Rule Specificity
            </div>
            {parsedCssRules.length === 0 ? (
              <p className="text-xs text-slate-500">Add CSS rules to compute selector specificity.</p>
            ) : (
              <div className="space-y-1.5">
                {parsedCssRules.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-[#111827] px-2.5 py-1.5 font-mono text-[11px]">
                    <span className="truncate text-slate-200">{r.selector}</span>
                    <span className="shrink-0 rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-300">
                      {r.specificity.formatted}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
