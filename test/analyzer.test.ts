import { describe, expect, it } from 'vitest';
import {
  analyzeTailwindClasses,
  cleanTailwindMarkup,
  computeCssSpecificity,
  explainStackingContext,
} from '../src/core/analyzer.ts';
import { CSS_XRAY_PRESETS } from '../src/core/presets.ts';

describe('css-xray layout, specificity & Tailwind diagnostics', () => {
  it('detects overridden and duplicate Tailwind utilities and cleans markup in 1 click', () => {
    const res = analyzeTailwindClasses('flex block p-4 px-6 p-2 bg-slate-800 bg-slate-900 p-2');
    expect(res.conflicts.length).toBeGreaterThanOrEqual(4);
    expect(res.cleaned).toBe('block bg-slate-900 p-2');

    const markup = cleanTailwindMarkup('<div class="w-40 w-full text-sm text-base mx-4 m-2">Hi</div>');
    expect(markup.totalRemoved).toBe(3);
    expect(markup.cleanedMarkup).toBe('<div class="w-full text-base m-2">Hi</div>');
  });

  it('preserves distinct responsive/state variant buckets without false conflicts', () => {
    const res = analyzeTailwindClasses('p-2 md:p-4 hover:bg-slate-800 bg-slate-900');
    expect(res.conflicts).toHaveLength(0);
    expect(res.cleaned).toBe('p-2 md:p-4 hover:bg-slate-800 bg-slate-900');
  });

  it('computes accurate CSS selector specificity tuples (id, class, element)', () => {
    expect(computeCssSpecificity('#app .card:hover > h2::before').formatted).toBe('(1, 2, 2)');
    expect(computeCssSpecificity('.dashboard-grid').formatted).toBe('(0, 1, 0)');
    expect(computeCssSpecificity('input[type="text"].active').formatted).toBe('(0, 2, 1)');
  });

  it('identifies stacking context triggers including transform, opacity, isolation, and sticky', () => {
    expect(
      explainStackingContext({ tag: 'div', position: 'static', zIndex: 'auto', opacity: '1', transform: 'translateY(0px)' }).createsContext,
    ).toBe(true);
    expect(
      explainStackingContext({ tag: 'div', position: 'static', zIndex: 'auto', opacity: '0.8', transform: 'none' }).createsContext,
    ).toBe(true);
    expect(
      explainStackingContext({ tag: 'div', position: 'sticky', zIndex: 'auto', opacity: '1', transform: 'none' }).createsContext,
    ).toBe(true);
    expect(
      explainStackingContext({ tag: 'div', position: 'static', zIndex: 'auto', opacity: '1', transform: 'none', isolation: 'isolate' }).createsContext,
    ).toBe(true);
    expect(CSS_XRAY_PRESETS.length).toBeGreaterThanOrEqual(5);
  });
});
