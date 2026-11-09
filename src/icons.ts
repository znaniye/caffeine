import type { DrinkId } from './model.ts';

/* Cup icons, drawn in a box of about 16 units around (0, 0).
 * `top` and `bottom` are how far each one reaches, for the guide line and the label. */

interface Icon {
  top: number;
  bottom: number;
  draw(ctx: CanvasRenderingContext2D, background: string): void;
}

const H = Math.PI / 2;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function handle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, width: number) {
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, -H, H);
  ctx.stroke();
}

export const ICONS: Record<DrinkId, Icon> = {
  coffee: {
    top: 6,
    bottom: 7.5,
    draw(ctx) {
      ctx.translate(2, 0); // centre the mug body, not the handle, on the time line
      ctx.beginPath();
      ctx.moveTo(-8, -6);
      ctx.lineTo(4, -6);
      ctx.lineTo(3, 5.5);
      ctx.quadraticCurveTo(2.8, 7.5, 1, 7.5);
      ctx.lineTo(-5, 7.5);
      ctx.quadraticCurveTo(-6.8, 7.5, -7, 5.5);
      ctx.closePath();
      ctx.fill();
      handle(ctx, 4, 0.2, 3.4, 2);
    },
  },
  espresso: {
    top: 4.5,
    bottom: 5.4,
    draw(ctx) {
      ctx.translate(1.2, 0);
      ctx.beginPath();
      ctx.moveTo(-6, -4.5);
      ctx.lineTo(3.5, -4.5);
      ctx.lineTo(2.6, 0.8);
      ctx.quadraticCurveTo(2.2, 2.5, 0.5, 2.5);
      ctx.lineTo(-3.5, 2.5);
      ctx.quadraticCurveTo(-5.2, 2.5, -5.4, 0.8);
      ctx.closePath();
      ctx.fill();
      handle(ctx, 3.3, -1.3, 2.2, 1.6);
      roundRect(ctx, -8.5, 3.6, 14.5, 1.8, 0.9); // saucer
      ctx.fill();
    },
  },
  tea: {
    top: 4,
    bottom: 7,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(-7, -3);
      ctx.lineTo(6, -3);
      ctx.quadraticCurveTo(6, 4.2, -0.5, 4.2);
      ctx.quadraticCurveTo(-7, 4.2, -7, -3);
      ctx.closePath();
      ctx.fill();
      handle(ctx, 5.6, -0.4, 2.2, 1.6);
      roundRect(ctx, -9, 5, 17, 2, 1); // saucer
      ctx.fill();
      ctx.lineWidth = 0.9; // tea bag string and tag
      ctx.beginPath();
      ctx.moveTo(-2, -3);
      ctx.lineTo(-3.5, -4);
      ctx.lineTo(-10, -0.5);
      ctx.stroke();
      roundRect(ctx, -12.2, -0.5, 3.6, 3.6, 0.6);
      ctx.fill();
    },
  },
  cola: {
    top: 10,
    bottom: 8,
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(-5, -5);
      ctx.lineTo(5, -5);
      ctx.lineTo(4, 8);
      ctx.lineTo(-4, 8);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 1.5; // straw
      ctx.beginPath();
      ctx.moveTo(1, -5);
      ctx.lineTo(2.2, -10);
      ctx.lineTo(5, -10);
      ctx.stroke();
    },
  },
  energy: {
    top: 7,
    bottom: 8,
    draw(ctx, background) {
      roundRect(ctx, -4.8, -7, 9.6, 15, 2);
      ctx.fill();
      ctx.fillStyle = background; // lid seam
      ctx.fillRect(-4.8, -4.6, 9.6, 1.1);
    },
  },
  pill: {
    top: 7,
    bottom: 7,
    draw(ctx) {
      ctx.rotate(-0.6);
      ctx.beginPath();
      ctx.moveTo(0, -3.2);
      ctx.lineTo(-4.8, -3.2);
      ctx.arc(-4.8, 0, 3.2, -H, H, true);
      ctx.lineTo(0, 3.2);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(0, -3.2);
      ctx.lineTo(4.8, -3.2);
      ctx.arc(4.8, 0, 3.2, -H, H);
      ctx.lineTo(0, 3.2);
      ctx.closePath();
      ctx.stroke();
    },
  },
};

export function drawIcon(ctx: CanvasRenderingContext2D, drink: DrinkId, x: number, y: number, scale: number, color: string, background: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ICONS[drink].draw(ctx, background);
  ctx.restore();
}
