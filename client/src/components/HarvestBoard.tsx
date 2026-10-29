import type { HarvestBoardRow } from "@/lib/planting";

const ROWS_SHOWN = 5;

/**
 * Colours per part. "glass" is for laying the board over the hero photo from
 * xl up: translucent and blurred so the photo shows through, with white text.
 * Below xl it falls back to the solid board, since the photo sits above it.
 */
const LOOK = {
  solid: {
    card: "bg-field text-soil shadow-card",
    rule: "border-soil/20",
    muted: "text-soil/70",
    strong: "text-soil",
    foot: "border-soil/10",
  },
  glass: {
    card: "bg-field text-soil shadow-card xl:bg-soil/40 xl:text-white xl:backdrop-blur-md xl:border xl:border-white/20 xl:shadow-none",
    rule: "border-soil/20 xl:border-white/25",
    muted: "text-soil/70 xl:text-white/80",
    strong: "text-soil xl:text-white",
    foot: "border-soil/10 xl:border-white/15",
  },
} as const;

const fmtDay = (date: string, withMonth = true) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", withMonth ? { month: "short", day: "numeric" } : { day: "numeric" });

/** "Oct 26 – Nov 1", or "Nov 2 – 8" when the week stays in one month. */
function weekLabel(start: string, end: string) {
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${fmtDay(start)} – ${fmtDay(end, !sameMonth)}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The home page's market board: what member farms expect to harvest this
 * week, from their crop records. Totals only; no farm is named.
 */
export default function HarvestBoard({
  thisWeek,
  nextWeek,
  weekStart,
  weekEnd,
  look = "solid",
  rows = ROWS_SHOWN,
}: {
  thisWeek: HarvestBoardRow[];
  nextWeek: string[];
  weekStart: string;
  weekEnd: string;
  look?: keyof typeof LOOK;
  /** Crops listed before "and N more crops". */
  rows?: number;
}) {
  const c = LOOK[look];
  const compact = look === "glass";
  const shown = thisWeek.slice(0, rows);
  const more = thisWeek.length - shown.length;

  return (
    <section aria-labelledby="harvest-board-title" className={`${c.card} rounded-card overflow-hidden`}>
      <div className="bg-calamansi px-6 py-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="harvest-board-title" className="font-stencil text-3xl leading-none">This week&apos;s harvest</h2>
        <p className="text-sm font-medium tabular whitespace-nowrap">{weekLabel(weekStart, weekEnd)}</p>
      </div>

      {shown.length === 0 ? (
        <p className={`px-6 py-10 text-[0.95rem] leading-relaxed max-w-sm ${c.muted}`}>
          No harvests are expected this week. Crops show up here as member farmers record their plantings.
        </p>
      ) : (
        <ul className="px-6 pt-2">
          {shown.map((row, i) => (
            <li
              key={row.crop}
              className={`board-row flex items-baseline gap-3 border-b border-dashed last:border-b-0 ${c.rule} ${compact ? "py-3" : "py-4"}`}
              style={{ "--i": i } as React.CSSProperties}
            >
              <span className={`font-display font-bold leading-none ${compact ? "text-3xl" : "text-4xl"}`}>{row.crop}</span>
              <span className="flex-1" aria-hidden="true" />
              <span className={`text-sm tabular whitespace-nowrap ${c.muted}`}>{plural(row.farms, "farm", "farms")}</span>
              {/* Kept even when empty, so the farm counts stay in one column. */}
              <span className="w-20 text-right text-sm font-semibold tabular whitespace-nowrap">
                {row.kg > 0 && `~${row.kg >= 10 ? Math.round(row.kg / 10) * 10 : Math.max(1, Math.round(row.kg))} kg`}
              </span>
            </li>
          ))}
          {more > 0 && <li className={`py-3 text-sm ${c.muted}`}>and {plural(more, "more crop", "more crops")}</li>}
        </ul>
      )}

      <div className={`px-6 py-4 border-t text-sm space-y-1 ${c.foot} ${c.muted}`}>
        {nextWeek.length > 0 && (
          <p>
            <span className={`font-semibold ${c.strong}`}>Next week:</span> {nextWeek.join(", ")}
          </p>
        )}
        <p>Estimated from member farmers&apos; crop records.</p>
      </div>
    </section>
  );
}
