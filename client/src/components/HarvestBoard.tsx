import type { HarvestBoardRow } from "@/lib/planting";

const ROWS_SHOWN = 5;

/**
 * Classes per part. "glass" is for laying the board over the hero photo from
 * xl up: a 33% tint, blurred so the photo shows through, white text, and
 * tighter spacing so it ends well above the farmer in the photo. Below xl it
 * is the solid board, since the photo sits above it there.
 */
const SOLID = {
  card: "bg-field text-soil shadow-card",
  header: "px-6 py-4 flex-wrap",
  title: "text-3xl",
  date: "text-sm",
  empty: "px-6 py-10 text-[0.95rem]",
  list: "px-6 pt-2",
  row: "py-4",
  crop: "text-4xl",
  more: "py-3",
  foot: "px-6 py-4 text-sm border-soil/10",
  rule: "border-soil/20",
  muted: "text-soil/70",
  strong: "text-soil",
};
const LOOK = {
  solid: SOLID,
  glass: {
    card: `${SOLID.card} xl:bg-soil/[.33] xl:text-white xl:backdrop-blur-md xl:border xl:border-white/20 xl:shadow-none`,
    header: `${SOLID.header} xl:px-5 xl:py-3 xl:flex-nowrap`,
    title: `${SOLID.title} xl:text-2xl`,
    date: `${SOLID.date} xl:text-xs`,
    empty: `${SOLID.empty} xl:px-5 xl:py-4 xl:text-sm`,
    list: `${SOLID.list} xl:px-5 xl:pt-1`,
    row: `${SOLID.row} xl:py-2`,
    crop: `${SOLID.crop} xl:text-2xl`,
    more: `${SOLID.more} xl:py-2`,
    foot: `${SOLID.foot} xl:px-5 xl:py-2.5 xl:text-xs xl:border-white/15`,
    rule: `${SOLID.rule} xl:border-white/25`,
    muted: `${SOLID.muted} xl:text-white/85`,
    strong: `${SOLID.strong} xl:text-white`,
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
  const shown = thisWeek.slice(0, rows);
  const more = thisWeek.length - shown.length;

  return (
    <section aria-labelledby="harvest-board-title" className={`${c.card} rounded-card overflow-hidden`}>
      <div className={`bg-calamansi text-soil flex items-baseline justify-between gap-x-4 gap-y-1 ${c.header}`}>
        <h2 id="harvest-board-title" className={`font-stencil leading-none ${c.title}`}>This week&apos;s harvest</h2>
        <p className={`font-medium tabular whitespace-nowrap ${c.date}`}>{weekLabel(weekStart, weekEnd)}</p>
      </div>

      {shown.length === 0 ? (
        <p className={`leading-relaxed max-w-sm ${c.empty} ${c.muted}`}>
          No harvests are expected this week. Crops show up here as member farmers record their plantings.
        </p>
      ) : (
        <ul className={c.list}>
          {shown.map((row, i) => (
            <li
              key={row.crop}
              className={`board-row flex items-baseline gap-3 border-b border-dashed last:border-b-0 ${c.rule} ${c.row}`}
              style={{ "--i": i } as React.CSSProperties}
            >
              <span className={`font-display font-bold leading-none ${c.crop}`}>{row.crop}</span>
              <span className="flex-1" aria-hidden="true" />
              <span className={`text-sm tabular whitespace-nowrap ${c.muted}`}>{plural(row.farms, "farm", "farms")}</span>
              {/* Kept even when empty, so the farm counts stay in one column. */}
              <span className="w-20 text-right text-sm font-semibold tabular whitespace-nowrap">
                {row.kg > 0 && `~${row.kg >= 10 ? Math.round(row.kg / 10) * 10 : Math.max(1, Math.round(row.kg))} kg`}
              </span>
            </li>
          ))}
          {more > 0 && <li className={`text-sm ${c.more} ${c.muted}`}>and {plural(more, "more crop", "more crops")}</li>}
        </ul>
      )}

      <div className={`border-t space-y-1 ${c.foot} ${c.muted}`}>
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
