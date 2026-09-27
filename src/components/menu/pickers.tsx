"use client";

import type { Topping, WingFlavour } from "@/lib/menu-types";

/** Topping chips grouped Veg / Halal meat. Chips that would go over `remainingUnits` are disabled. */
export function ToppingPicker({
  toppings,
  selected,
  onChange,
  remainingUnits,
  name,
}: {
  toppings: Topping[];
  selected: string[];
  onChange: (next: string[]) => void;
  remainingUnits: number;
  name: string;
}) {
  const groups = [
    { key: "veg", label: "Vegetarian" },
    { key: "meat", label: "Halal meat (HMA certified)" },
  ] as const;
  const toggle = (slug: string) => onChange(selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug]);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <fieldset key={g.key}>
          <legend className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-soft">{g.label}</legend>
          <div className="flex flex-wrap gap-2">
            {toppings
              .filter((t) => t.group === g.key)
              .map((t) => {
                const checked = selected.includes(t.slug);
                const disabled = !t.available || (!checked && t.units > remainingUnits);
                return (
                  <label key={t.slug} className="chip cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="sr-only"
                      name={name}
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(t.slug)}
                    />
                    {t.name}
                    {t.units > 1 && <span className="rounded-full bg-gold-100 px-1.5 text-xs font-bold text-gold-700">×{t.units}</span>}
                    {!t.available && <span className="text-xs">(sold out)</span>}
                  </label>
                );
              })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

/** Flavour chips: behaves like radio buttons when only one flavour is allowed. */
export function FlavourPicker({
  flavours,
  selected,
  max,
  onChange,
  name,
}: {
  flavours: WingFlavour[];
  selected: string[];
  max: number;
  onChange: (next: string[]) => void;
  name: string;
}) {
  const single = max === 1;
  const toggle = (slug: string) => {
    if (single) return onChange([slug]);
    onChange(selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug]);
  };
  return (
    <div className="flex flex-wrap gap-2" role={single ? "radiogroup" : "group"}>
      {flavours.map((f) => {
        const checked = selected.includes(f.slug);
        const disabled = !f.available || (!single && !checked && selected.length >= max);
        return (
          <label key={f.slug} className="chip cursor-pointer select-none">
            <input
              type={single ? "radio" : "checkbox"}
              className="sr-only"
              name={name}
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(f.slug)}
            />
            {f.name}
            {!f.available && <span className="text-xs">(sold out)</span>}
          </label>
        );
      })}
    </div>
  );
}

/** "2 of 3 toppings" meter. */
export function UnitMeter({ used, limit, label = "toppings" }: { used: number; limit: number; label?: string }) {
  const pct = Math.min(100, (used / Math.max(limit, 1)) * 100);
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-crust">
        <div className={`h-full rounded-full ${used > limit ? "bg-tomato-500" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 text-sm font-semibold">
        {used} of {limit} {label}
      </span>
    </div>
  );
}
