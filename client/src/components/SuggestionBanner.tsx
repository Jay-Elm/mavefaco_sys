import { Sparkles } from 'lucide-react'

// "Suggested: X [Apply] [✕]" chip shown above the category/unit fields on
// the farmer's add- and edit-product forms.
export default function SuggestionBanner({ label, onApply, onDismiss }: { label: string; onApply: () => void; onDismiss: () => void }) {
  return (
    <div className="mb-2 flex items-center gap-2 bg-tint border border-forest/20 rounded-lg px-3 py-2">
      <Sparkles size={13} className="text-forest-mid shrink-0" />
      <span className="text-xs text-forest flex-1">Suggested: <strong>{label}</strong></span>
      <button type="button" onClick={onApply} className="text-xs font-semibold text-forest hover:text-forest-mid border border-forest/30 rounded px-2 py-0.5 transition-colors">Apply</button>
      <button type="button" onClick={onDismiss} className="text-xs text-forest-mid/70 hover:text-forest transition-colors" aria-label="Dismiss">✕</button>
    </div>
  )
}
