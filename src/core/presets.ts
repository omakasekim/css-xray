import type { CssXrayPreset } from './types.ts';

export const CSS_XRAY_PRESETS: CssXrayPreset[] = [
  {
    id: 'complex-grid',
    name: 'Complex Grid Layout',
    tag: 'GRID TRACKS',
    description: 'Multi-span bento CSS Grid with nested flex header and gap inspection.',
    html: `<div class="dashboard-grid grid grid-cols-3 gap-4 p-4 bg-slate-900 rounded-xl border">
  <header class="col-span-3 flex items-center justify-between p-4 bg-slate-800 rounded-lg border">
    <span class="font-bold text-slate-100">Telemetry Hub</span>
    <span class="badge px-4 py-2 bg-sky-900 rounded-lg">LIVE</span>
  </header>
  <aside class="p-4 bg-slate-800 rounded-lg border">
    <div class="font-semibold text-slate-100">Clusters</div>
    <div class="text-xs text-slate-400 mt-2">us-east-1 · 12 nodes</div>
  </aside>
  <main class="col-span-2 p-4 bg-slate-800 rounded-lg border flex flex-col gap-2">
    <div class="font-semibold text-slate-100">Throughput Panel</div>
    <div class="p-4 bg-slate-900 rounded-lg border text-xs">14,200 req/s · p99 4.2ms</div>
  </main>
</div>`,
    css: `.dashboard-grid {
  border-color: #334155;
}
.badge {
  color: #7dd3fc;
  font-size: 11px;
  font-weight: 700;
}`,
  },
  {
    id: 'zindex-trap',
    name: 'Z-Index Stacking Trap',
    tag: 'STACKING CONTEXT',
    description: 'Modal with z-index: 9999 gets trapped underneath a sibling banner because its parent has transform/opacity.',
    html: `<div class="stage p-4 bg-slate-900 rounded-xl border">
  <div class="trapped-card p-4 bg-slate-800 rounded-lg border">
    <div class="font-semibold">Card A (transform creates Stacking Context)</div>
    <div class="modal-popover p-4 bg-rose-900 rounded-lg border">
      Modal (z-index: 9999 — trapped inside Card A!)
    </div>
  </div>
  <div class="sibling-banner p-4 bg-sky-900 rounded-lg border mt-4">
    Sibling Header (z-index: 10 — paints ON TOP of z-9999 modal!)
  </div>
</div>`,
    css: `.trapped-card {
  position: relative;
  z-index: 1;
  transform: translateY(0px);
}
.modal-popover {
  position: relative;
  z-index: 9999;
  margin-top: 8px;
}
.sibling-banner {
  position: relative;
  z-index: 10;
}`,
  },
  {
    id: 'flex-overflow',
    name: 'Flexbox Overflow Bug',
    tag: 'MIN-W-0 TRAP',
    description: 'Unbreakable monospace token inside a flex child without min-w-0 blows out container width.',
    html: `<div class="flex gap-4 p-4 bg-slate-900 rounded-xl border">
  <nav class="w-40 shrink-0 p-4 bg-slate-800 rounded-lg border">
    Sidebar (160px)
  </nav>
  <div class="flex-1 p-4 bg-slate-800 rounded-lg border">
    <div class="font-semibold">Missing min-w-0 on flex-1 child:</div>
    <pre class="overflow-box mt-2 p-2 bg-slate-950 rounded-lg font-mono text-xs">super_long_unbreakable_hash_0x99887766554433221100ffeeddccbbaa_overflowing_viewport</pre>
  </div>
</div>`,
    css: `.overflow-box {
  white-space: nowrap;
  color: #fda4af;
  border: 1px solid #f43f5e;
}`,
  },
  {
    id: 'tailwind-soup',
    name: 'Dense Tailwind Utility Soup',
    tag: 'UTILITY AUDIT',
    description: 'Redundant and conflicting utility classes ready for 1-click deduplication & cleanup.',
    html: `<section class="flex block p-4 px-6 p-2 bg-slate-800 bg-slate-900 rounded-lg rounded-xl border">
  <div class="w-40 w-full text-sm text-base text-slate-400 text-slate-100 p-4 p-4">
    Conflicting classes detected in markup — click "Clean Tailwind Classes" in Diagnostics!
  </div>
</section>`,
    css: `section {
  border-color: #475569;
}`,
  },
  {
    id: 'opacity-isolation',
    name: 'Opacity & Isolation Layers',
    tag: 'PAINT ISOLATION',
    description: 'Nested opacity < 1 and CSS isolation: isolate cards creating independent z-index planes.',
    html: `<div class="canvas-shell grid grid-cols-2 gap-4 p-4 bg-slate-900 rounded-xl border">
  <article class="fade-card p-4 bg-slate-800 rounded-lg border">
    <div class="font-semibold">Opacity 0.92 Card</div>
    <div class="tooltip-pop mt-2 p-2 bg-amber-900 rounded-lg border">Tooltip z:500</div>
  </article>
  <article class="isolated-card p-4 bg-slate-800 rounded-lg border">
    <div class="font-semibold">isolation: isolate Card</div>
    <div class="mt-2 p-2 bg-emerald-900 rounded-lg border">Independent Paint Plane</div>
  </article>
</div>`,
    css: `.fade-card {
  opacity: 0.92;
  position: relative;
}
.tooltip-pop {
  position: relative;
  z-index: 500;
}
.isolated-card {
  isolation: isolate;
  position: relative;
  z-index: 2;
}`,
  },
];
