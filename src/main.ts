import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './style.css';
import { mgOf } from './model.ts';
import { decode, encode } from './hash.ts';
import { HINT, answer, header } from './copy.ts';
import { V, render, type CupView, type Scene } from './chart.ts';
import { changed, currentDay, load, onChange, selectedCup, settings, state } from './state.ts';
import { bindInput } from './input.ts';
import { bindPanel } from './panel.ts';
import { bindEditor } from './editor.ts';
import { byId } from './dom.ts';

const canvas = byId<HTMLCanvasElement>('cv');
const ctx = canvas.getContext('2d')!;
const hint = matchMedia('(pointer: coarse)').matches ? HINT.touch : HINT.mouse;

let size = 0;
let dpr = 1;
let scale = 1; // virtual units per mg, eased toward the target so the chart rescales smoothly
let bedGlow = 0;
let dirty = true;
const unitPx = () => size / V;

function resize() {
  size = Math.max(280, Math.floor(Math.min(innerWidth, innerHeight)));
  dpr = Math.min(devicePixelRatio || 1, 3);
  const root = document.documentElement;
  root.style.setProperty('--size', `${size}px`);
  root.style.setProperty('--u', `${unitPx()}px`);
  root.classList.toggle('below', innerHeight - size >= 130); // tall screens: cup editor goes under the chart
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  dirty = true;
}

/** Moves `value` a step toward `target`, snapping once close. */
const ease = (value: number, target: number, rate: number, epsilon: number) =>
  Math.abs(target - value) > epsilon ? value + (target - value) * rate : target;

const targetScale = () => 314 / Math.max(currentDay().peak.mg, state.threshold * 1.6, 60);

function isLit(id: number, now: number) {
  const drag = state.drag;
  return (
    (drag?.kind === 'cup' && drag.id === id) ||
    id === state.hoverId ||
    id === state.selectedId ||
    (id === state.keyboardId && now < state.keyboardUntil)
  );
}

function scene(): Scene {
  const day = currentDay();
  const cups: CupView[] = state.cups.map((c) => ({
    id: c.id,
    t: c.t,
    drink: c.drink,
    mg: mgOf(c),
    glow: c.glow,
    ghostY: c.ghost ? (state.drag?.y ?? null) : null,
    labeled: c.id === state.selectedId,
  }));
  const drag = state.drag;
  const preferred = (drag?.kind === 'cup' ? drag.id : null) ?? state.hoverId ?? state.selectedId;
  const lit = cups.filter((c) => c.ghostY === null && c.glow > 0.02);
  return {
    size,
    dpr,
    scale,
    day,
    cups,
    active: lit.find((c) => c.id === preferred) ?? lit.sort((a, b) => b.glow - a.glow)[0] ?? null,
    bed: state.bed,
    bedGlow,
    threshold: state.threshold,
    header: header(day.doses.length, day.total, state.halfLife),
    answer: answer(day.verdict, state.next, day.doses.length > 0),
    hint: selectedCup() ? null : hint,
  };
}

function frame(now: number) {
  let moving = false;
  for (const c of state.cups) {
    const glow = ease(c.glow, isLit(c.id, now) ? 1 : 0, 0.2, 0.01);
    moving ||= glow !== c.glow;
    c.glow = glow;
  }
  const glow = ease(bedGlow, state.drag?.kind === 'bed' || state.hoverBed ? 1 : 0, 0.2, 0.01);
  moving ||= glow !== bedGlow;
  bedGlow = glow;
  const target = targetScale();
  const next = ease(scale, target, 0.16, target * 0.002);
  moving ||= next !== scale;
  scale = next;
  if (moving || dirty) {
    render(ctx, scene());
    dirty = false;
  }
  requestAnimationFrame(frame);
}

const panel = bindPanel();
bindEditor();
bindInput(canvas, { unitPx, redraw: () => (dirty = true), toggleHelp: () => panel.toggle() });
onChange(() => (dirty = true));

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  panel.toggle(false);
  if (state.selectedId === null) return;
  state.selectedId = null;
  changed();
});
addEventListener('resize', resize);

load(decode(location.hash));
resize();
changed();
scale = targetScale();

// Keep the share link in sync, without touching the URL on first load.
let saveTimer = 0;
onChange(() => {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => history.replaceState(null, '', encode(settings())), 300);
});

Promise.all(['400', '500'].map((w) => document.fonts.load(`${w} 17px "JetBrains Mono"`)))
  .catch(() => undefined)
  .then(() => (dirty = true));
requestAnimationFrame(frame);
