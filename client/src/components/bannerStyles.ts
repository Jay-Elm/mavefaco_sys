// Home-page banner colours, shared by the home page and the admin preview so
// the preview shows exactly what visitors see. The keys are the stored
// values (validators/banner.ts). Each is a left-to-right gradient within one
// hue, like the announcement cards, toned to sit beside the paddy green and
// soil palette; both ends keep the text colour readable (white text stays
// above 4.5:1 contrast at the lighter end).
export const BANNER_STYLES: Record<string, { label: string; swatch: string; surface: string; muted: string; action: string }> = {
  green:  { label: "Green",  swatch: "bg-linear-to-r from-[#24552D] to-[#3F7F47]", surface: "bg-linear-to-r from-[#24552D] to-[#3F7F47] text-white", muted: "text-white/85", action: "bg-white/15 hover:bg-white/25 text-white" },
  orange: { label: "Orange", swatch: "bg-linear-to-r from-[#E8A03A] to-[#F3C77A]", surface: "bg-linear-to-r from-[#E8A03A] to-[#F3C77A] text-soil", muted: "text-soil/80", action: "bg-soil/10 hover:bg-soil/20 text-soil" },
  blue:   { label: "Blue",   swatch: "bg-linear-to-r from-[#1B3D5E] to-[#3A6E9E]", surface: "bg-linear-to-r from-[#1B3D5E] to-[#3A6E9E] text-white", muted: "text-white/85", action: "bg-white/15 hover:bg-white/25 text-white" },
  purple: { label: "Purple", swatch: "bg-linear-to-r from-[#3E3058] to-[#6A5690]", surface: "bg-linear-to-r from-[#3E3058] to-[#6A5690] text-white", muted: "text-white/85", action: "bg-white/15 hover:bg-white/25 text-white" },
  teal:   { label: "Teal",   swatch: "bg-linear-to-r from-[#164A45] to-[#2E7D75]", surface: "bg-linear-to-r from-[#164A45] to-[#2E7D75] text-white", muted: "text-white/85", action: "bg-white/15 hover:bg-white/25 text-white" },
};

export const bannerStyle = (color: string) => BANNER_STYLES[color] ?? BANNER_STYLES.green;
