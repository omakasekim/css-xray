import type {
  LayoutNodeSnapshot,
  SpecificityTuple,
  StackingContextInfo,
  TailwindConflict,
} from './types.ts';

function classifyBucket(cls: string): string | null {
  const base = cls.split(':').pop() ?? cls;
  if (/^(flex|inline-flex|grid|inline-grid|block|inline-block|inline|hidden)$/.test(base)) return 'display';
  if (/^(static|relative|absolute|fixed|sticky)$/.test(base)) return 'position';
  if (/^p-/.test(base)) return 'padding-all';
  if (/^px-/.test(base)) return 'padding-x';
  if (/^py-/.test(base)) return 'padding-y';
  if (/^pt-/.test(base)) return 'padding-t';
  if (/^pr-/.test(base)) return 'padding-r';
  if (/^pb-/.test(base)) return 'padding-b';
  if (/^pl-/.test(base)) return 'padding-l';
  if (/^m-/.test(base)) return 'margin-all';
  if (/^mx-/.test(base)) return 'margin-x';
  if (/^my-/.test(base)) return 'margin-y';
  if (/^gap-/.test(base)) return 'gap';
  if (/^grid-cols-/.test(base)) return 'grid-cols';
  if (/^col-span-/.test(base)) return 'col-span';
  if (/^justify-/.test(base)) return 'justify-content';
  if (/^items-/.test(base)) return 'align-items';
  if (/^w-/.test(base)) return 'width';
  if (/^min-w-/.test(base)) return 'min-width';
  if (/^h-/.test(base)) return 'height';
  if (/^z-/.test(base)) return 'z-index';
  if (/^bg-/.test(base)) return 'background';
  if (/^rounded(?:-[^-]+)?$/.test(base)) return 'border-radius';
  if (/^text-(xs|sm|base|lg|xl|2xl|3xl|4xl)$/.test(base)) return 'font-size';
  if (/^text-(left|center|right|justify)$/.test(base)) return 'text-align';
  if (/^text-/.test(base)) return 'text-color';
  if (/^font-(thin|light|normal|medium|semibold|bold|extrabold|mono|sans)$/.test(base)) {
    return /^font-(mono|sans)$/.test(base) ? 'font-family' : 'font-weight';
  }
  if (/^opacity-/.test(base)) return 'opacity';
  if (/^overflow-/.test(base)) return 'overflow';
  return null;
}

function getVariantPrefix(cls: string): string {
  const parts = cls.split(':');
  return parts.length > 1 ? parts.slice(0, -1).join(':') : '';
}

export function analyzeTailwindClasses(classListString: string): {
  conflicts: TailwindConflict[];
  cleaned: string;
} {
  const tokens = classListString
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const lastByKey = new Map<string, { idx: number; token: string }>();

  tokens.forEach((token, idx) => {
    const bucket = classifyBucket(token);
    const key = bucket ? `${getVariantPrefix(token)}|${bucket}` : `exact:${token}`;
    lastByKey.set(key, { idx, token });
  });

  // Also check shorthand overrides (e.g., p-* after px-*/py-*)
  const conflicts: TailwindConflict[] = [];
  const keepIndices = new Set<number>();

  tokens.forEach((token, idx) => {
    const bucket = classifyBucket(token);
    const prefix = getVariantPrefix(token);
    const key = bucket ? `${prefix}|${bucket}` : `exact:${token}`;
    const winner = lastByKey.get(key)!;

    if (winner.idx !== idx) {
      conflicts.push({
        className: token,
        bucket: bucket ?? 'duplicate',
        overriddenBy: winner.token,
        reason:
          winner.token === token
            ? `Duplicate class "${token}"`
            : `"${token}" is overridden later by "${winner.token}" in the same ${bucket} property`,
      });
      return;
    }

    // Check if later shorthand `p-*` / `m-*` overrides earlier axis class `px-*` / `py-*` / `mx-*` / `my-*`
    if (bucket && /^padding-(x|y|t|r|b|l)$/.test(bucket)) {
      const laterAll = lastByKey.get(`${prefix}|padding-all`);
      if (laterAll && laterAll.idx > idx) {
        conflicts.push({
          className: token,
          bucket,
          overriddenBy: laterAll.token,
          reason: `Axis padding "${token}" is superseded by later shorthand "${laterAll.token}"`,
        });
        return;
      }
    }
    if (bucket && /^margin-(x|y)$/.test(bucket)) {
      const laterAll = lastByKey.get(`${prefix}|margin-all`);
      if (laterAll && laterAll.idx > idx) {
        conflicts.push({
          className: token,
          bucket,
          overriddenBy: laterAll.token,
          reason: `Axis margin "${token}" is superseded by later shorthand "${laterAll.token}"`,
        });
        return;
      }
    }

    keepIndices.add(idx);
  });

  const cleaned = tokens.filter((_, idx) => keepIndices.has(idx)).join(' ');
  return { conflicts, cleaned };
}

export function cleanTailwindMarkup(markup: string): {
  cleanedMarkup: string;
  totalRemoved: number;
  allConflicts: TailwindConflict[];
} {
  const allConflicts: TailwindConflict[] = [];
  let totalRemoved = 0;

  const cleanedMarkup = markup.replace(/\b(class|className)=(["'])([^"']*)\2/g, (_full, attr, quote, clsStr) => {
    const { conflicts, cleaned } = analyzeTailwindClasses(clsStr);
    if (conflicts.length > 0) {
      allConflicts.push(...conflicts);
      totalRemoved += conflicts.length;
    }
    return `${attr}=${quote}${cleaned}${quote}`;
  });

  return { cleanedMarkup, totalRemoved, allConflicts };
}

export function computeCssSpecificity(selector: string): SpecificityTuple {
  const clean = selector
    .replace(/::[\w-]+/g, ' pe ')
    .replace(/\[[^\]]+\]/g, ' .attr ');
  const ids = (clean.match(/#[A-Za-z_-][\w-]*/g) ?? []).length;
  const classes =
    (clean.match(/\.[A-Za-z_-][\w-]*/g) ?? []).length +
    (clean.match(/:(?!not\()[A-Za-z_-][\w-]*/g) ?? []).length;
  const stripped = clean
    .replace(/#[A-Za-z_-][\w-]*/g, ' ')
    .replace(/\.[A-Za-z_-][\w-]*/g, ' ')
    .replace(/:[A-Za-z_-][\w-]*(?:\([^)]*\))?/g, ' ');
  const elements = (stripped.match(/\b[a-zA-Z][\w-]*\b/g) ?? []).length;
  return {
    ids,
    classes,
    elements,
    formatted: `(${ids}, ${classes}, ${elements})`,
  };
}

export function compareSpecificityDuel(selA: string, selB: string): {
  a: SpecificityTuple;
  b: SpecificityTuple;
  winner: 'A' | 'B' | 'tie';
  explanation: string;
} {
  const a = computeCssSpecificity(selA);
  const b = computeCssSpecificity(selB);
  const cmp =
    a.ids !== b.ids
      ? a.ids - b.ids
      : a.classes !== b.classes
        ? a.classes - b.classes
        : a.elements - b.elements;
  if (cmp > 0) {
    return {
      a,
      b,
      winner: 'A',
      explanation: `Selector A ${a.formatted} beats Selector B ${b.formatted} (${a.ids > b.ids ? 'more IDs' : a.classes > b.classes ? 'more classes/attributes/pseudo-classes' : 'more element/pseudo-element tags'}).`,
    };
  }
  if (cmp < 0) {
    return {
      a,
      b,
      winner: 'B',
      explanation: `Selector B ${b.formatted} beats Selector A ${a.formatted} (${b.ids > a.ids ? 'more IDs' : b.classes > a.classes ? 'more classes/attributes/pseudo-classes' : 'more element/pseudo-element tags'}).`,
    };
  }
  return {
    a,
    b,
    winner: 'tie',
    explanation: `Tie at ${a.formatted} — the rule appearing later in stylesheet source order wins.`,
  };
}

export function explainStackingContext(style: {
  tag: string;
  position: string;
  zIndex: string;
  opacity: string;
  transform: string;
  isolation?: string;
}): StackingContextInfo {
  if (style.tag.toLowerCase() === 'html' || style.tag.toLowerCase() === 'body') {
    return { createsContext: true, reason: 'Root document stacking context', zIndex: style.zIndex || 'auto' };
  }
  if (style.transform && style.transform !== 'none') {
    return {
      createsContext: true,
      reason: `transform (${style.transform}) traps descendant z-index layers`,
      zIndex: style.zIndex || 'auto',
    };
  }
  const op = Number(style.opacity);
  if (Number.isFinite(op) && op < 1) {
    return {
      createsContext: true,
      reason: `opacity: ${style.opacity} (< 1) isolates a new stacking context`,
      zIndex: style.zIndex || 'auto',
    };
  }
  if (style.isolation === 'isolate') {
    return { createsContext: true, reason: 'isolation: isolate', zIndex: style.zIndex || 'auto' };
  }
  if (style.position === 'fixed' || style.position === 'sticky') {
    return { createsContext: true, reason: `position: ${style.position}`, zIndex: style.zIndex || 'auto' };
  }
  if (
    (style.position === 'relative' || style.position === 'absolute') &&
    style.zIndex !== 'auto' &&
    style.zIndex !== ''
  ) {
    return {
      createsContext: true,
      reason: `position: ${style.position} + z-index: ${style.zIndex}`,
      zIndex: style.zIndex,
    };
  }
  return { createsContext: false, reason: 'Participates in parent stacking context', zIndex: style.zIndex || 'auto' };
}

/** Lightweight utility CSS compiler so preview renders offline cleanly without external Tailwind CDN. */
export function buildPreviewUtilityCss(markup: string): string {
  const rules: string[] = [
    '* { box-sizing: border-box; }',
    'body { margin: 0; padding: 14px; font-family: ui-sans-serif, system-ui, sans-serif; background: #0f172a; color: #f8fafc; font-size: 13px; }',
  ];
  const colorMap: Record<string, string> = {
    'slate-950': '#020617',
    'slate-900': '#0f172a',
    'slate-800': '#1e293b',
    'slate-700': '#334155',
    'slate-400': '#94a3b8',
    'slate-200': '#e2e8f0',
    'slate-100': '#f1f5f9',
    'sky-500': '#0ea5e9',
    'sky-900': '#0c4a6e',
    'emerald-500': '#10b981',
    'emerald-900': '#064e3b',
    'amber-500': '#f59e0b',
    'amber-900': '#78350f',
    'rose-500': '#f43f5e',
    'rose-900': '#881337',
    'violet-600': '#7c3aed',
  };

  const classes = new Set<string>();
  for (const m of markup.matchAll(/\b(?:class|className)=["']([^"']+)["']/g)) {
    for (const token of m[1].split(/\s+/)) {
      if (token) classes.add(token);
    }
  }

  for (const cls of classes) {
    const esc = cls.replace(/([:\[\]/#.])/g, '\\$1');
    if (cls === 'flex') rules.push(`.${esc} { display: flex; }`);
    else if (cls === 'grid') rules.push(`.${esc} { display: grid; }`);
    else if (cls === 'block') rules.push(`.${esc} { display: block; }`);
    else if (cls === 'flex-1') rules.push(`.${esc} { flex: 1 1 0%; }`);
    else if (cls === 'flex-col') rules.push(`.${esc} { flex-direction: column; }`);
    else if (cls === 'min-w-0') rules.push(`.${esc} { min-width: 0; }`);
    else if (cls === 'relative') rules.push(`.${esc} { position: relative; }`);
    else if (cls === 'absolute') rules.push(`.${esc} { position: absolute; }`);
    else if (cls === 'fixed') rules.push(`.${esc} { position: fixed; }`);
    else if (cls === 'inset-0') rules.push(`.${esc} { inset: 0; }`);
    else if (cls === 'truncate' || cls === 'overflow-hidden') rules.push(`.${esc} { overflow: hidden; }`);
    else if (cls === 'items-center') rules.push(`.${esc} { align-items: center; }`);
    else if (cls === 'justify-between') rules.push(`.${esc} { justify-content: space-between; }`);
    else if (cls === 'font-bold') rules.push(`.${esc} { font-weight: 700; }`);
    else if (cls === 'font-semibold') rules.push(`.${esc} { font-weight: 600; }`);
    else if (cls === 'font-mono') rules.push(`.${esc} { font-family: ui-monospace, monospace; }`);
    else if (cls === 'border') rules.push(`.${esc} { border: 1px solid #334155; }`);
    else if (cls === 'rounded-lg') rules.push(`.${esc} { border-radius: 0.5rem; }`);
    else if (cls === 'rounded-xl') rules.push(`.${esc} { border-radius: 0.75rem; }`);
    else if (cls === 'w-full') rules.push(`.${esc} { width: 100%; }`);
    else if (cls === 'w-40') rules.push(`.${esc} { width: 10rem; }`);
    else if (cls === 'shrink-0') rules.push(`.${esc} { flex-shrink: 0; }`);
    else if (/^grid-cols-(\d+)$/.test(cls)) {
      const n = cls.split('-').pop();
      rules.push(`.${esc} { grid-template-columns: repeat(${n}, minmax(0, 1fr)); }`);
    } else if (/^col-span-(\d+)$/.test(cls)) {
      const n = cls.split('-').pop();
      rules.push(`.${esc} { grid-column: span ${n} / span ${n}; }`);
    } else if (/^gap-(\d+)$/.test(cls)) {
      const rem = Number(cls.split('-').pop()) * 0.25;
      rules.push(`.${esc} { gap: ${rem}rem; }`);
    } else if (/^p-(\d+)$/.test(cls)) {
      const rem = Number(cls.split('-').pop()) * 0.25;
      rules.push(`.${esc} { padding: ${rem}rem; }`);
    } else if (/^px-(\d+)$/.test(cls)) {
      const rem = Number(cls.split('-').pop()) * 0.25;
      rules.push(`.${esc} { padding-left: ${rem}rem; padding-right: ${rem}rem; }`);
    } else if (/^py-(\d+)$/.test(cls)) {
      const rem = Number(cls.split('-').pop()) * 0.25;
      rules.push(`.${esc} { padding-top: ${rem}rem; padding-bottom: ${rem}rem; }`);
    } else if (/^mt-(\d+)$/.test(cls)) {
      const rem = Number(cls.split('-').pop()) * 0.25;
      rules.push(`.${esc} { margin-top: ${rem}rem; }`);
    } else if (/^z-(\d+|\[.+\])$/.test(cls)) {
      const raw = cls.slice(2).replace(/^\[|\]$/g, '');
      rules.push(`.${esc} { z-index: ${raw}; }`);
    } else if (cls.startsWith('bg-')) {
      const col = colorMap[cls.slice(3)];
      if (col) rules.push(`.${esc} { background-color: ${col}; }`);
    } else if (cls.startsWith('border-')) {
      const col = colorMap[cls.slice(7)];
      if (col) rules.push(`.${esc} { border-color: ${col}; }`);
    } else if (cls.startsWith('text-')) {
      const k = cls.slice(5);
      if (k === 'xs') rules.push(`.${esc} { font-size: 0.75rem; }`);
      else if (k === 'sm') rules.push(`.${esc} { font-size: 0.875rem; }`);
      else if (k === 'base') rules.push(`.${esc} { font-size: 1rem; }`);
      else if (k === 'lg') rules.push(`.${esc} { font-size: 1.125rem; }`);
      else if (colorMap[k]) rules.push(`.${esc} { color: ${colorMap[k]}; }`);
    }
  }
  return rules.join('\n');
}

export function extractDomSnapshot(doc: Document): LayoutNodeSnapshot[] {
  const root = doc.body;
  if (!root) return [];
  const results: LayoutNodeSnapshot[] = [];
  let seq = 0;

  const px = (v: string) => Math.round(parseFloat(v) || 0);

  const walk = (el: Element, depth: number, parentId: string | null, parentContextZ: string | null) => {
    const cs = doc.defaultView?.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (!cs || rect.width === 0 || rect.height === 0) return;

    const stacking = explainStackingContext({
      tag: el.tagName,
      position: cs.position,
      zIndex: cs.zIndex,
      opacity: cs.opacity,
      transform: cs.transform,
      isolation: (cs as CSSStyleDeclaration & { isolation?: string }).isolation,
    });

    const numZ = Number(cs.zIndex);
    if (parentContextZ !== null && Number.isFinite(numZ) && numZ >= 100 && parentContextZ !== 'auto') {
      stacking.parentTrapWarning = `High z-index (${cs.zIndex}) is trapped inside ancestor stacking context (z-index: ${parentContextZ}).`;
    }

    const overflowBug = el.scrollWidth > el.clientWidth + 2 && (cs.overflowX === 'visible' || cs.overflowX === '');
    const classes = Array.from(el.classList);
    const id = `n_${seq++}`;

    results.push({
      id,
      parentId,
      tag: el.tagName.toLowerCase(),
      idAttr: el.id || undefined,
      classes,
      depth,
      rect: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      boxModel: {
        margin: [px(cs.marginTop), px(cs.marginRight), px(cs.marginBottom), px(cs.marginLeft)],
        border: [px(cs.borderTopWidth), px(cs.borderRightWidth), px(cs.borderBottomWidth), px(cs.borderLeftWidth)],
        padding: [px(cs.paddingTop), px(cs.paddingRight), px(cs.paddingBottom), px(cs.paddingLeft)],
      },
      display: cs.display,
      position: cs.position,
      zIndex: cs.zIndex,
      opacity: cs.opacity,
      transform: cs.transform,
      gap: cs.gap || '0px',
      gridTemplateColumns: cs.gridTemplateColumns,
      overflowBug,
      stacking,
      textPreview: (el.textContent ?? '').trim().slice(0, 36),
    });

    const nextParentZ = stacking.createsContext && el.tagName !== 'BODY'
      ? cs.zIndex !== 'auto'
        ? cs.zIndex
        : '0'
      : parentContextZ;

    for (const child of Array.from(el.children)) {
      walk(child, depth + 1, id, nextParentZ);
    }
  };

  walk(root, 0, null, null);
  return results;
}
