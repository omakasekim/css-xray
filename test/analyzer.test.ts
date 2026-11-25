import { describe, expect, it } from 'vitest';
import {
  analyzeTailwindClasses,
  cleanTailwindMarkup,
  computeCssSpecificity,
  explainStackingContext,
} from '../src/core/analyzer.ts';

describe('css-xray layout, specificity & Tailwind diagnostics', () => {
  it('detects overridden and duplicate Tailwind utilities and cleans markup in 1 click', () => {
    const audit = analyzeTailwindClasses('flex block p-4 px-6 p-2 bg-slate-800 bg-slate-900 p-2');
    expect(audit.conflicts.length).toBeGreaterThanOrEqual(4);
    expect(audit.cleaned).toBe('block bg-slate-900 p-2');

    const markupRes = cleanTailwindMarkup('<div class="p-4 p-2 text-sm text-base">hi</div>');
    expect(markupRes.totalRemoved).toBe(2);
    expect(markupRes.cleanedMarkup).toBe('<div class="p-2 text-base">hi</div>');
  });

  it('computes accurate CSS selector specificity tuples (id, class, element)', () => {
    expect(computeCssSpecificity('#modal .card > div.active:hover').formatted).toBe('(1, 3, 1)');
    expect(computeCssSpecificity('.btn').formatted).toBe('(0, 1, 0)');
    expect(computeCssSpecificity('section header span').formatted).toBe('(0, 0, 3)');
  });

  it('identifies stacking context triggers such as transform, opacity < 1, and positioned z-index', () => {
    expect(
      explainStackingContext({
        tag: 'div',
        position: 'static',
        zIndex: 'auto',
        opacity: '1',
        transform: 'translateY(0px)',
      }).createsContext,
    ).toBe(true);

    expect(
      explainStackingContext({
        tag: 'div',
        position: 'static',
        zIndex: 'auto',
        opacity: '0.98',
        transform: 'none',
      }).createsContext,
    ).toBe(true);

    expect(
      explainStackingContext({
        tag: 'div',
        position: 'static',
        zIndex: 'auto',
        opacity: '1',
        transform: 'none',
      }).createsContext,
    ).toBe(false);
  });
});
