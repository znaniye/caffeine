import { DAY_SPAN, DAY_START, fmtTime, type DrinkId, type Point } from './model.ts';
import { COLUMNS, columnTime, type Day } from './series.ts';
import { ICONS, drawIcon } from './icons.ts';

/* Canvas renderer and hit testing. Everything is laid out in a 1000 x 1000 square. */

type RGB = [number, number, number];
export interface Pos {
  x: number;
  y: number;
}

export const V = 1000;
const X0 = 121;
const X1 = 879;
const TOP = 340; // highest dot row
const BASE = 724; // lowest dot row
const AXIS = 742;
const CUP_Y = 771;
const AXIS_BAND = { top: AXIS - 10, bottom: 845 }; // where clicks add cups
const REMOVE_BELOW = 870; // drag a cup below this to remove it
const LINE_TOP = 332;
const LABEL_Y = 320;
const DX = (X1 - X0) / (COLUMNS - 1);
const DY = 6.3;
const HOUR_COLOR = '#525252';
const HINT_COLOR = '#3d3d3d';

export const tx = (t: number) => X0 + ((t - DAY_START) / DAY_SPAN) * (X1 - X0);
export const tFromX = (x: number) => DAY_START + ((x - X0) / (X1 - X0)) * DAY_SPAN;
export const isRemoveDrag = (p: Pos) => p.y > REMOVE_BELOW;

/* ---------- theme, read from the CSS custom properties ---------- */

interface Theme {
  bg: string;
  fg: string;
  mute: string;
  blue: RGB;
  font: string;
  minFont: number; // smallest on-screen font size, CSS px
}
let themeCache: Theme | null = null;

function readTheme(): Theme {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const hex = v('--blue').replace('#', '');
  return {
    bg: v('--bg'),
    fg: v('--fg'),
    mute: v('--mute'),
    blue: [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as RGB,
    font: v('--font'),
    minFont: Number.parseFloat(v('--min-font')),
  };
}

/* ---------- hit testing ---------- */

export type Hit = { kind: 'bed' } | { kind: 'cup'; id: number } | { kind: 'axis' } | null;

export function hitTest(p: Pos, cups: readonly { id: number; t: number }[], bed: number, unitPx: number): Hit {
  let cup: { id: number; d: number } | null = null;
  if (p.y >= TOP - 20 && p.y <= AXIS_BAND.bottom) {
    for (const c of cups) {
      const d = Math.abs(tx(c.t) - p.x);
      if (d < Math.max(15, 20 / unitPx) && (!cup || d < cup.d)) cup = { id: c.id, d };
    }
  }
  const bedDist = p.y >= 270 && p.y <= AXIS ? Math.abs(tx(bed) - p.x) : Infinity;
  if (bedDist < Math.max(10, 16 / unitPx) && (!cup || bedDist < cup.d)) return { kind: 'bed' };
  if (cup) return { kind: 'cup', id: cup.id };
  const onAxis = p.y > AXIS_BAND.top && p.y < AXIS_BAND.bottom && p.x > X0 - 12 && p.x < X1 + 12;
  return onAxis ? { kind: 'axis' } : null;
}

/* ---------- scene ---------- */

export interface CupView {
  id: number;
  t: number;
  drink: DrinkId;
  mg: number;
  glow: number;
  ghostY: number | null; // set while being dragged off to be removed
  labeled: boolean;
}

export interface Scene {
  size: number;
  dpr: number;
  scale: number; // virtual units per mg
  day: Day;
  cups: CupView[];
  active: CupView | null; // the cup whose share is painted blue
  bed: number;
  bedGlow: number;
  threshold: number;
  header: string;
  answer: string[];
  hint: string[] | null;
}

let ctx: CanvasRenderingContext2D;
let theme: Theme;
let upx = 1; // CSS px per virtual unit
let scale = 1;

const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
const valueY = (mg: number) => BASE + DY / 2 - mg * scale;
const fs = (n: number) => Math.max(n, theme.minFont / upx);
const lh = () => Math.max(24, fs(17) * 1.3);
const width = (s: string) => ctx.measureText(s).width;

function font(n: number, weight = 400) {
  ctx.font = `${weight} ${fs(n).toFixed(2)}px ${theme.font}`;
}
function text(s: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
}
/** One line when it fits in `max`, otherwise one part per line. */
function fit(parts: string[], sep: string, max: number): string[] {
  const one = parts.join(sep);
  return width(one) <= max ? [one] : parts;
}
function vline(x: number, y0: number, y1: number, color: string, w: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
}

/** Cup icon size: grows with the dose, never too small on phones. */
function iconScale(mg: number, glow: number): number {
  const dose = Math.min(1.4, Math.max(0.8, Math.sqrt(mg / 95)));
  const minPx = Math.max(1, 14 / (16 * 1.3 * upx));
  return dose * 1.3 * minPx * (1 + 0.15 * glow);
}

function drawDots(sc: Scene) {
  const { level, halo, rise, share, timeToPeak } = sc.day;
  const active = sc.active;
  const activeShare = active ? share.get(active.id) : undefined;
  for (let i = 0; i < COLUMNS; i++) {
    const x = X0 + i * DX;
    const a = level[i];
    const r = rise[i];
    let blue = 0;
    let blueFrom = Infinity;
    if (active && activeShare && activeShare[i] > 0.05) {
      const since = columnTime(i) - active.t;
      const fade = since <= timeToPeak ? 1 : Math.max(0, 1 - (since - timeToPeak) / 1.3);
      blue = active.glow * fade;
      blueFrom = a - activeShare[i];
    }
    for (let j = 0; BASE - j * DY >= TOP; j++) {
      const y = BASE - j * DY;
      const v = ((j + 0.5) * DY) / scale;
      let radius = 0.9;
      let alpha = 0.035;
      let color: RGB = [205, 205, 205];
      if (v <= a) {
        const f = Math.min(1, v / a);
        alpha = 0.14 + 0.52 * f ** 1.6;
        radius = 1.2 + f;
        alpha += (0.5 + 0.48 * f - alpha) * r; // rising columns are brighter and bigger
        radius += (1.75 + f - radius) * r;
        const g = 190 + 60 * r;
        color = [g, g, g];
        if (blue > 0 && v > blueFrom) {
          color = mix(color, theme.blue, Math.min(1, blue * 1.3));
          alpha += (0.95 - alpha) * blue;
          radius += (2.3 - radius) * blue;
        }
      } else if (v <= halo[i]) {
        alpha = 0.085;
        radius = 1.1;
      }
      ctx.fillStyle = rgba(color, alpha);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawThreshold(sc: Scene) {
  const y = valueY(sc.threshold);
  ctx.save();
  ctx.setLineDash([2.5, 5]);
  ctx.strokeStyle = 'rgba(255,255,255,.28)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(X0 - 6, y);
  ctx.lineTo(X1 + 4, y);
  ctx.stroke();
  ctx.restore();
  font(17);
  ctx.textBaseline = 'middle';
  text(String(Math.round(sc.threshold)), X1 + 14, y, theme.mute);
  ctx.textBaseline = 'alphabetic';
}

function drawAxis() {
  ctx.strokeStyle = 'rgba(255,255,255,.2)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(X0, AXIS);
  ctx.lineTo(X1, AXIS);
  for (let h = 0; h <= DAY_SPAN; h += 3) {
    ctx.moveTo(tx(DAY_START + h), AXIS);
    ctx.lineTo(tx(DAY_START + h), AXIS + 7);
  }
  ctx.stroke();
  font(17);
  const y = Math.max(828, CUP_Y + 29 + lh());
  for (let h = 0; h <= DAY_SPAN; h += 6) text(String((DAY_START + h) % 24).padStart(2, '0'), tx(DAY_START + h), y, HOUR_COLOR, 'center');
}

function drawCups(sc: Scene) {
  for (const c of [...sc.cups].sort((a, b) => a.glow - b.glow || a.t - b.t)) {
    const x = tx(c.t);
    const color = mix([215, 215, 215], theme.blue, c.glow);
    const s = iconScale(c.mg, c.glow);
    const icon = ICONS[c.drink];
    if (c.ghostY === null) {
      const top = valueY(sc.day.guide.get(c.id) ?? 0);
      ctx.fillStyle = rgba(color, 0.26 + 0.6 * c.glow);
      for (let y = CUP_Y - icon.top * s - 5; y > top; y -= 5) ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
    }
    const y = c.ghostY === null ? CUP_Y : Math.min(940, c.ghostY);
    drawIcon(ctx, c.drink, x, y, s, rgba(color, c.ghostY === null ? 1 : 0.35), theme.bg);
    if (c.glow > 0.02 || c.labeled) {
      font(17);
      const label = c.ghostY === null ? fmtTime(c.t) : 'REMOVE';
      const labelColor = c.ghostY === null ? rgba(mix([236, 236, 236], theme.blue, c.glow), 1) : theme.mute;
      text(label, Math.min(V - 40, Math.max(40, x)), y + Math.max(29, icon.bottom * s + 19), labelColor, 'center');
    }
  }
}

/** Two-line label beside a vertical line, on whichever side is free. */
function labelBox(x: number, lines: [string, string], blocked: [number, number] | null): { left: number; right: number; align: CanvasTextAlign } | null {
  const w = Math.max(width(lines[0]), width(lines[1]));
  const sides = [
    { left: x + 11, right: x + 11 + w, align: 'left' as const },
    { left: x - 11 - w, right: x - 11, align: 'right' as const },
  ];
  return (
    sides.find((s) => s.left >= 16 && s.right <= V - 16 && (!blocked || s.right + 18 < blocked[0] || s.left - 18 > blocked[1])) ?? null
  );
}

function drawLabels(sc: Scene) {
  font(17);
  const y1 = LABEL_Y - lh();
  const bx = tx(sc.bed);
  vline(bx, LINE_TOP, AXIS - 6, `rgba(255,255,255,${(0.45 + 0.4 * sc.bedGlow).toFixed(3)})`, 1.3 + sc.bedGlow);
  const bedLines: [string, string] = [`BED ${fmtTime(sc.bed)}`, `${Math.round(sc.day.atBed)} MG STILL IN YOU`];
  const bed = labelBox(bx, bedLines, null) ?? { left: bx - 11, right: bx - 11, align: 'right' as const };
  const bx2 = bed.align === 'left' ? bed.left : bed.right;
  text(bedLines[0], bx2, y1, theme.fg, bed.align);
  text(bedLines[1], bx2, LABEL_Y, theme.fg, bed.align);

  const pk: Point = sc.day.peak;
  const px = tx(pk.t);
  if (pk.mg < 1 || Math.abs(px - bx) < 14) return;
  const peakLines: [string, string] = [`PEAK ${Math.round(pk.mg)} MG`, fmtTime(pk.t)];
  const box = labelBox(px, peakLines, [bed.left, bed.right]);
  if (!box) return;
  vline(px, LINE_TOP, Math.max(LINE_TOP, valueY(pk.mg) - 9), 'rgba(255,255,255,.4)', 1.3);
  const lx = box.align === 'left' ? box.left : box.right;
  text(peakLines[0], lx, y1, theme.fg, box.align);
  text(peakLines[1], lx, LABEL_Y, theme.mute, box.align);
}

function drawFooter(sc: Scene) {
  font(17);
  const answer = fit(sc.answer, ' ', V - 220);
  answer.forEach((line, i) => text(line, 30, 968 - (answer.length - 1 - i) * lh(), theme.fg));
  if (!sc.hint) return;
  font(13);
  const hint = fit(sc.hint, ' · ', V - 60);
  hint.forEach((line, i) => text(line, V / 2, (hint.length > 1 ? 880 : 890) + i * fs(13) * 1.35, HINT_COLOR, 'center'));
}

export function render(context: CanvasRenderingContext2D, sc: Scene) {
  ctx = context;
  theme = themeCache ??= readTheme();
  upx = sc.size / V;
  scale = sc.scale;
  const k = (sc.size * sc.dpr) / V;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, V, V);
  ctx.textBaseline = 'alphabetic';

  font(21, 500);
  text('CAFFEINE', 30, 44, theme.fg);
  font(17);
  text(sc.header, 30, 44 + Math.max(28, lh()), theme.mute);

  drawDots(sc);
  drawThreshold(sc);
  drawAxis();
  drawLabels(sc);
  drawCups(sc);
  drawFooter(sc);
}
