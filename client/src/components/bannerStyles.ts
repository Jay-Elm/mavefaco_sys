// Home-page banner colours, shared by the home page and the admin preview so
// the preview shows exactly what visitors see. The keys are the stored
// values (validators/banner.ts); solid fills, toned to sit beside the
// paddy green and soil palette, each with a text colour that stays readable.
export const BANNER_STYLES: Record<string, { label: string; swatch: string; surface: string; muted: string; action: string }> = {
  green:  { label: "Green",  swatch: "bg-paddy",      surface: "bg-paddy text-white",      muted: "text-white/80", action: "bg-white/15 hover:bg-white/25 text-white" },
  orange: { label: "Orange", swatch: "bg-[#E8A03A]",  surface: "bg-[#E8A03A] text-soil",   muted: "text-soil/80",  action: "bg-soil/10 hover:bg-soil/20 text-soil" },
  blue:   { label: "Blue",   swatch: "bg-[#24507A]",  surface: "bg-[#24507A] text-white",  muted: "text-white/80", action: "bg-white/15 hover:bg-white/25 text-white" },
  purple: { label: "Purple", swatch: "bg-[#4E3D6E]",  surface: "bg-[#4E3D6E] text-white",  muted: "text-white/80", action: "bg-white/15 hover:bg-white/25 text-white" },
  teal:   { label: "Teal",   swatch: "bg-[#1E5E58]",  surface: "bg-[#1E5E58] text-white",  muted: "text-white/80", action: "bg-white/15 hover:bg-white/25 text-white" },
};

export const bannerStyle = (color: string) => BANNER_STYLES[color] ?? BANNER_STYLES.green;
