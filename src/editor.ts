import { DRINKS, defaultServing, fmtTime, isDrinkId, mgOf } from './model.ts';
import { changed, onChange, removeCup, selectedCup, setServing } from './state.ts';
import { byId } from './dom.ts';

/* The drink and size picker under the axis, shown while a cup is selected. */

export function bindEditor() {
  const editor = byId('cupEd');
  const chips = byId('drinkChips');
  const amount = byId<HTMLInputElement>('qty');
  const out = byId<HTMLOutputElement>('qtyOut');

  for (const [id, d] of Object.entries(DRINKS)) {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.dataset.drink = id;
    chip.textContent = d.name;
    chips.append(chip);
  }

  chips.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('.chip')?.dataset.drink;
    const cup = selectedCup();
    if (!cup || !id || !isDrinkId(id)) return;
    setServing(cup, cup.drink === id ? cup : defaultServing(id));
    changed();
  });
  amount.addEventListener('input', () => {
    const cup = selectedCup();
    if (!cup) return;
    setServing(cup, { drink: cup.drink, amount: Number.parseFloat(amount.value) });
    changed();
  });
  byId('rmCup').addEventListener('click', () => {
    const cup = selectedCup();
    if (!cup) return;
    removeCup(cup.id);
    changed();
  });

  onChange(() => {
    const cup = selectedCup();
    editor.hidden = !cup;
    if (!cup) return;
    const d = DRINKS[cup.drink];
    chips.querySelectorAll<HTMLElement>('.chip').forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.drink === cup.drink)));
    Object.assign(amount, { min: d.amount.min, max: d.amount.max, step: d.amount.step });
    if (document.activeElement !== amount) amount.value = String(cup.amount);
    amount.setAttribute('aria-label', d.unit === 'mg' ? 'Milligrams of caffeine' : 'Millilitres');
    out.textContent = d.unit === 'mg' ? `${cup.amount} MG` : `${cup.amount} ML · ${Math.round(mgOf(cup))} MG`;
    editor.setAttribute('aria-label', `Cup at ${fmtTime(cup.t)}`);
  });
}
