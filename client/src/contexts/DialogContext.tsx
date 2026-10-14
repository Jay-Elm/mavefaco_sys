'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Info, X } from 'lucide-react'

export interface DialogOptions {
  title: string
  /** Body text; a blank line ("\n\n") starts a new paragraph. */
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** "danger" for destructive actions: red button, and Cancel takes focus. */
  tone?: 'danger' | 'default'
}

interface DialogApi {
  /** Resolves true if the user confirms, false if they cancel or dismiss. */
  confirm: (options: DialogOptions) => Promise<boolean>
  /** A message with a single OK button. */
  alert: (options: Omit<DialogOptions, 'cancelLabel'>) => Promise<void>
}

interface OpenDialog extends DialogOptions {
  kind: 'confirm' | 'alert'
  resolve: (ok: boolean) => void
}

const DialogContext = createContext<DialogApi | null>(null)

/**
 * In-page replacement for the browser's confirm()/alert(), which open at the
 * top of the window in the browser's own style. One dialog at a time.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<OpenDialog | null>(null)

  const confirm = useCallback(
    (options: DialogOptions) => new Promise<boolean>((resolve) => setDialog({ ...options, kind: 'confirm', resolve })),
    [],
  )
  const alert = useCallback(
    (options: Omit<DialogOptions, 'cancelLabel'>) =>
      new Promise<void>((resolve) => setDialog({ ...options, kind: 'alert', resolve: () => resolve() })),
    [],
  )

  const close = useCallback((ok: boolean) => {
    dialog?.resolve(ok)
    setDialog(null)
  }, [dialog])

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {dialog && <DialogBox dialog={dialog} onClose={close} />}
    </DialogContext.Provider>
  )
}

function DialogBox({ dialog, onClose }: { dialog: OpenDialog; onClose: (ok: boolean) => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const danger = dialog.tone === 'danger'
  const isAlert = dialog.kind === 'alert'

  useEffect(() => {
    // A destructive action shouldn't be one Enter press away.
    ;(danger && !isAlert ? cancelRef : confirmRef).current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [danger, isAlert, onClose])

  const paragraphs = (dialog.message ?? '').split('\n\n').filter(Boolean)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => onClose(false)} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h3 id="dialog-title" className="font-bold text-gray-900 flex items-center gap-2">
            {danger
              ? <AlertTriangle size={18} className="text-red-600 shrink-0" />
              : <Info size={18} className="text-forest shrink-0" />}
            {dialog.title}
          </h3>
          <button onClick={() => onClose(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {paragraphs.map((p, i) => (
          <p key={i} className="text-sm text-gray-600 whitespace-pre-line">{p}</p>
        ))}
        <div className="flex gap-2">
          <button
            ref={confirmRef}
            onClick={() => onClose(true)}
            className={`flex-1 inline-flex items-center justify-center font-semibold py-2.5 rounded-xl text-sm text-white transition-colors ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-forest hover:bg-forest-mid'
            }`}
          >
            {dialog.confirmLabel ?? 'OK'}
          </button>
          {!isAlert && (
            <button
              ref={cancelRef}
              onClick={() => onClose(false)}
              className="flex-1 border border-gray-300 text-gray-600 hover:border-gray-400 font-medium py-2.5 rounded-xl text-sm transition-colors"
            >
              {dialog.cancelLabel ?? 'Cancel'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog must be used inside DialogProvider')
  return ctx
}
