import { DAY_END, DAY_START, RANGE } from './model.ts';
import { hitTest, isRemoveDrag, tFromX, tx, V, type Hit, type Pos } from './chart.ts';
import { addCup, changed, findCup, removeCup, state } from './state.ts';

const snap = (t: number, perHour: number) => Math.round(t * perHour) / perHour;
const clampTime = (t: number) => Math.min(DAY_END - 1 / 12, Math.max(DAY_START, t));
const clampBed = (t: number) => Math.min(RANGE.bed.max, Math.max(RANGE.bed.min, t));
const CURSOR: Record<NonNullable<Hit>['kind'], string> = { bed: 'ew-resize', cup: 'grab', axis: 'copy' };

interface Options {
  unitPx: () => number;
  redraw: () => void;
  toggleHelp: () => void;
}

export function bindInput(canvas: HTMLCanvasElement, { unitPx, redraw, toggleHelp }: Options) {
  let created = { id: -1, at: 0 };

  const toVirtual = (e: MouseEvent): Pos => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * V, y: ((e.clientY - r.top) / r.height) * V };
  };
  const hit = (p: Pos) => hitTest(p, state.cups, state.bed, unitPx());

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const p = toVirtual(e);
    canvas.focus({ preventScroll: true });
    const h = hit(p);
    const cup = h?.kind === 'cup' ? findCup(h.id) : h?.kind === 'axis' ? addCup(clampTime(snap(tFromX(p.x), 12))) : null;
    if (h?.kind === 'bed') {
      state.drag = { kind: 'bed', off: tx(state.bed) - p.x, y: p.y };
    } else if (cup) {
      state.drag = { kind: 'cup', id: cup.id, off: tx(cup.t) - p.x, y: p.y };
      state.selectedId = cup.id;
      if (h?.kind === 'axis') created = { id: cup.id, at: performance.now() };
    } else {
      if (state.selectedId !== null) {
        state.selectedId = null;
        changed();
      }
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    changed();
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = toVirtual(e);
    const drag = state.drag;
    if (drag) {
      drag.y = p.y;
      if (drag.kind === 'bed') {
        state.bed = clampBed(snap(tFromX(p.x + drag.off), 1 / RANGE.bed.step));
      } else {
        const c = findCup(drag.id);
        if (c) {
          c.t = clampTime(snap(tFromX(p.x + drag.off), 12));
          c.ghost = isRemoveDrag(p);
        }
      }
      changed();
      return;
    }
    if (e.pointerType === 'touch') return;
    const h = hit(p);
    const hoverId = h?.kind === 'cup' ? h.id : null;
    const hoverBed = h?.kind === 'bed';
    if (hoverId !== state.hoverId || hoverBed !== state.hoverBed) {
      state.hoverId = hoverId;
      state.hoverBed = hoverBed;
      redraw();
    }
    canvas.style.cursor = h ? CURSOR[h.kind] : 'default';
  });

  const endDrag = (e: PointerEvent) => {
    const drag = state.drag;
    if (!drag) return;
    if (drag.kind === 'cup' && findCup(drag.id)?.ghost) removeCup(drag.id);
    state.drag = null;
    if (e.pointerType === 'touch') {
      state.hoverId = null;
      state.hoverBed = false;
    }
    changed();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => {
    if (state.drag) return;
    state.hoverId = null;
    state.hoverBed = false;
    redraw();
  });

  canvas.addEventListener('dblclick', (e) => {
    const h = hit(toVirtual(e));
    if (h?.kind !== 'cup') return;
    if (h.id === created.id && performance.now() - created.at < 600) return; // the double click that just added it
    removeCup(h.id);
    changed();
  });

  canvas.addEventListener('keydown', (e) => {
    if (e.key === '?') return toggleHelp();
    const sorted = [...state.cups].sort((a, b) => a.t - b.t);
    let c = findCup(state.selectedId) ?? null;
    if (e.key === 'n' || e.key === '+') {
      c = addCup(clampTime(snap((sorted.at(-1)?.t ?? 7) + 2, 12)));
      if (!c) return;
      state.selectedId = c.id;
    } else {
      if (!/^(Arrow|Delete|Backspace)/.test(e.key)) return;
      c ??= sorted[0] ?? null;
      if (!c) return;
      state.selectedId = c.id;
      const step = e.shiftKey ? 1 : 1 / 12;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        c.t = clampTime(snap(c.t + (e.key === 'ArrowRight' ? step : -step), 12));
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const i = sorted.indexOf(c) + (e.key === 'ArrowDown' ? 1 : -1);
        c = sorted[(i + sorted.length) % sorted.length];
        state.selectedId = c.id;
      } else {
        removeCup(c.id);
        c = null;
      }
    }
    e.preventDefault();
    if (c) {
      state.keyboardId = c.id;
      state.keyboardUntil = performance.now() + 1500;
    }
    changed();
  });
}
