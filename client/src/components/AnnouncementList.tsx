import { Info, AlertTriangle, Leaf } from "lucide-react";

export interface AnnouncementItem {
  id: number;
  title: string;
  body: string;
  type: string;
  createdAt: string | Date;
}

const ANNOUNCEMENT_STYLES = {
  info:     { bar: "bg-blue-500",   bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-800",   icon: Info },
  alert:    { bar: "bg-amber-500",  bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-800",  icon: AlertTriangle },
  advisory: { bar: "bg-paddy",  bg: "bg-shoot/40",  border: "border-shoot",  text: "text-paddy-deep",  icon: Leaf },
} as const;

/** Staff announcements, shown on the home page and the farmer overview. */
export default function AnnouncementList({ announcements }: { announcements: AnnouncementItem[] }) {
  return (
    <div className="space-y-3">
      {announcements.map((a) => {
        const style = ANNOUNCEMENT_STYLES[a.type as keyof typeof ANNOUNCEMENT_STYLES] ?? ANNOUNCEMENT_STYLES.info;
        const Icon = style.icon;
        return (
          <div key={a.id} className={`flex rounded-lg border ${style.border} ${style.bg} overflow-hidden`}>
            <div className={`w-1 shrink-0 ${style.bar}`} />
            <div className="py-3 px-4">
              <div className={`flex items-center gap-2 font-semibold text-sm ${style.text} mb-0.5`}>
                <Icon size={13} />
                {a.title}
              </div>
              <p className={`text-sm ${style.text} opacity-90 whitespace-pre-wrap`}>{a.body}</p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(a.createdAt).toLocaleDateString("en-PH", { dateStyle: "medium" })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
