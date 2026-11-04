'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import type { AiReportContent } from '@/lib/aiReport'

export interface SavedAiReport {
  id: number
  content: AiReportContent
  model: string
  reportCount: number
  createdAt: string
  createdBy: string | null
  newer: number
}

/** sessionStorage key the Announcements page reads a draft from. */
export const ANNOUNCEMENT_DRAFT_KEY = 'announcementDraft'

const KIND: Record<string, string> = { pest_disease: 'Pest or disease', weather_impact: 'Weather impact', damage: 'Crop damage' }
const URGENCY: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-gray-100 text-gray-700',
}
const TREND: Record<string, string> = { new: 'New', rising: 'Rising', steady: 'Steady', easing: 'Easing', unclear: 'Trend unclear' }

/**
 * The AI's reading of members' crop reports: overview, each problem,
 * suggested actions and a draft advisory staff can open in Announcements.
 */
export default function AiReportPanel({
  enabled,
  report,
  onGenerate,
}: {
  enabled: boolean
  report: SavedAiReport | null
  /** Asks for a new report; resolves to an error message, or null on success. */
  onGenerate: () => Promise<string | null>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setBusy(true)
    setError('')
    setError((await onGenerate()) ?? '')
    setBusy(false)
  }

  function openDraft() {
    if (!report) return
    try {
      sessionStorage.setItem(ANNOUNCEMENT_DRAFT_KEY, JSON.stringify({ ...report.content.draft, type: 'advisory', audience: 'farmers' }))
    } catch {
      // Storage blocked: the page opens without the draft.
    }
    router.push('/dashboard/announcements')
  }

  const button = (
    <button
      type="button"
      onClick={generate}
      disabled={busy || !enabled}
      className="inline-flex items-center gap-1.5 bg-paddy hover:bg-paddy-deep disabled:opacity-50 text-white text-sm font-medium px-3.5 py-2 rounded-lg"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : report ? <RefreshCw size={14} /> : <Sparkles size={14} />}
      {busy ? 'Reading the reports…' : report ? 'Make a new report' : 'Make an AI report'}
    </button>
  )

  return (
    <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6" aria-labelledby="ai-report-heading">
      <div className="flex flex-wrap items-start gap-3">
        <Sparkles size={18} className="text-paddy mt-0.5" aria-hidden />
        <div className="flex-1 min-w-[220px]">
          <h2 id="ai-report-heading" className="text-sm font-semibold text-soil">AI crop report</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {enabled
              ? 'Google Gemini reads the reports below and writes a summary, suggested actions and a draft advisory. Farm names are never sent.'
              : 'Not set up yet: add a Gemini API key (GEMINI_API_KEY) to turn it on.'}
          </p>
        </div>
        {button}
      </div>

      {error && <p className="mt-3 text-sm text-red-600 flex items-center gap-1.5"><AlertCircle size={14} /> {error}</p>}

      {report && (
        <div className="mt-5 space-y-5">
          {report.newer > 0 && (
            <p className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2">
              {report.newer} new {report.newer === 1 ? 'report has' : 'reports have'} come in since this was written.
            </p>
          )}

          <p className="text-[15px] leading-relaxed text-soil">{report.content.overview}</p>

          {report.content.items.length > 0 && (
            <ul className="space-y-3">
              {report.content.items.map((it, i) => (
                <li key={i} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-soil">{KIND[it.kind] ?? it.kind} on {it.crop}</span>
                    <span className="text-xs text-gray-500">{it.farms} {it.farms === 1 ? 'farm' : 'farms'} · {TREND[it.trend]}</span>
                    <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${URGENCY[it.urgency]}`}>{it.urgency}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{it.assessment}</p>
                </li>
              ))}
            </ul>
          )}

          {report.content.actions.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Suggested actions</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-800">
                {report.content.actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-paddy/20 bg-field px-4 py-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Draft advisory for farmers</h3>
            <p className="font-medium text-soil mt-1">{report.content.draft.title}</p>
            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{report.content.draft.body}</p>
            <button type="button" onClick={openDraft} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-paddy hover:text-paddy-deep">
              Edit and post it in Announcements <ArrowRight size={14} />
            </button>
          </div>

          <p className="text-xs text-gray-500">
            Written by AI ({report.model}) from {report.reportCount} {report.reportCount === 1 ? 'report' : 'reports'} on{' '}
            {new Date(report.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })}
            {report.createdBy && <> at {report.createdBy}&apos;s request</>}. It can be wrong: check the reports below before acting.
          </p>
        </div>
      )}
    </section>
  )
}
