import type { ToothChartEntry, ToothCondition } from "@clinic/shared";

const Q1 = Array.from({ length: 8 }, (_, i) => `1${i + 1}`);
const Q2 = Array.from({ length: 8 }, (_, i) => `2${i + 1}`);
const Q3 = Array.from({ length: 8 }, (_, i) => `3${i + 1}`);
const Q4 = Array.from({ length: 8 }, (_, i) => `4${i + 1}`);

// FDI notation, dentist's-eye view: patient's right is on the left of the chart.
const UPPER_ROW = [...Q1].reverse().concat(Q2);
const LOWER_ROW = [...Q4].reverse().concat(Q3);

const CONDITION_STYLES: Record<ToothCondition, string> = {
  healthy: "bg-white border-slate-300 text-slate-500",
  decayed: "bg-red-100 border-red-400 text-red-800",
  filled: "bg-sky-100 border-sky-400 text-sky-800",
  crown: "bg-amber-100 border-amber-400 text-amber-800",
  root_canal_treated: "bg-purple-100 border-purple-400 text-purple-800",
  missing: "bg-slate-100 border-slate-300 text-slate-300 line-through",
  implant: "bg-brand-100 border-brand-500 text-brand-800",
  extraction_planned: "bg-orange-100 border-orange-400 text-orange-800",
  impacted: "bg-pink-100 border-pink-400 text-pink-800",
  fractured: "bg-rose-100 border-rose-400 text-rose-800",
};

const CONDITION_LABELS: Record<ToothCondition, string> = {
  healthy: "Healthy",
  decayed: "Decayed",
  filled: "Filled",
  crown: "Crown",
  root_canal_treated: "Root canal treated",
  missing: "Missing",
  implant: "Implant",
  extraction_planned: "Extraction planned",
  impacted: "Impacted",
  fractured: "Fractured",
};

function Tooth({ toothNumber, entry, onSelect }: { toothNumber: string; entry?: ToothChartEntry; onSelect?: (tooth: string) => void }) {
  const condition = entry?.condition ?? "healthy";
  return (
    <button
      type="button"
      onClick={() => onSelect?.(toothNumber)}
      title={`Tooth ${toothNumber}: ${CONDITION_LABELS[condition]}`}
      className={`flex h-11 w-9 flex-col items-center justify-center rounded-md border text-[11px] font-semibold transition hover:ring-2 hover:ring-brand-300 ${CONDITION_STYLES[condition]}`}
    >
      {toothNumber}
    </button>
  );
}

export function ToothChart({
  entries,
  onSelectTooth,
}: {
  entries: ToothChartEntry[];
  onSelectTooth?: (tooth: string) => void;
}) {
  const byTooth = new Map(entries.map((e) => [e.toothNumber, e]));

  return (
    <div>
      <div className="flex flex-col items-center gap-2 overflow-x-auto pb-2">
        <div className="flex gap-1">
          {UPPER_ROW.map((tooth) => (
            <Tooth key={tooth} toothNumber={tooth} entry={byTooth.get(tooth)} onSelect={onSelectTooth} />
          ))}
        </div>
        <div className="flex gap-1">
          {LOWER_ROW.map((tooth) => (
            <Tooth key={tooth} toothNumber={tooth} entry={byTooth.get(tooth)} onSelect={onSelectTooth} />
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {(Object.keys(CONDITION_LABELS) as ToothCondition[])
          .filter((c) => c !== "healthy")
          .map((condition) => (
            <span key={condition} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded-sm border ${CONDITION_STYLES[condition]}`} />
              {CONDITION_LABELS[condition]}
            </span>
          ))}
      </div>
    </div>
  );
}
