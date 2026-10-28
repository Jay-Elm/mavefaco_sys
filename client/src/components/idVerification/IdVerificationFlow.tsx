'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, ImageUp, Loader2, RotateCcw } from 'lucide-react'
import { FRAME_ASPECT, ID_TYPES, findIdType, idNumberError } from '@/lib/idVerification'
import { PROBLEM_MESSAGES } from '@/lib/photoQuality'
import IdCamera, { type CameraUnavailable } from './IdCamera'
import { prepareUpload, type CapturedPhoto } from './imageTools'

type PhotoKey = 'front' | 'back' | 'selfie'
type Step = 'type' | PhotoKey | 'number'

const PHOTO_STEPS: Record<PhotoKey, { title: string; prompt: string }> = {
  front: { title: 'Front of your ID', prompt: 'Fit the front of the ID inside the frame' },
  back: { title: 'Back of your ID', prompt: 'Now the back: fit it inside the frame' },
  selfie: { title: 'Selfie holding your ID', prompt: 'Face in the oval, ID held up beside it' },
}

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

/**
 * Step by step: ID type, front, back (unless a passport), a selfie holding
 * the ID, then the ID number and a final review. Photos are taken with the
 * in-app camera; only when no camera can be used does it offer uploading a
 * photo instead, and staff see that it was uploaded.
 */
export default function IdVerificationFlow({ token, onSubmitted, onCancel }: {
  token: string
  onSubmitted: () => void
  onCancel: () => void
}) {
  const [idType, setIdType] = useState('')
  const [step, setStep] = useState<Step>('type')
  const [photos, setPhotos] = useState<Partial<Record<PhotoKey, CapturedPhoto>>>({})
  const [camera, setCamera] = useState<'ok' | CameraUnavailable>('ok')
  const [idNumber, setIdNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [loadingUpload, setLoadingUpload] = useState(false)

  const type = findIdType(idType)
  const photoSteps: PhotoKey[] = type?.needsBack === false ? ['front', 'selfie'] : ['front', 'back', 'selfie']
  const steps: Step[] = ['type', ...photoSteps, 'number']
  const stepIndex = steps.indexOf(step)

  // Preview URLs are released when a photo is replaced, and when the flow closes.
  const photosRef = useRef(photos)
  useEffect(() => { photosRef.current = photos }, [photos])
  useEffect(() => () => Object.values(photosRef.current).forEach((p) => p && URL.revokeObjectURL(p.url)), [])

  const setPhoto = (key: PhotoKey, photo: CapturedPhoto | undefined) =>
    setPhotos((prev) => {
      const old = prev[key]
      if (old && old !== photo) URL.revokeObjectURL(old.url)
      return { ...prev, [key]: photo }
    })

  const next = () => setStep(steps[stepIndex + 1])
  const back = () => (stepIndex === 0 ? onCancel() : setStep(steps[stepIndex - 1]))

  async function upload(key: PhotoKey, file: File | undefined) {
    if (!file) return
    setLoadingUpload(true); setError('')
    try {
      setPhoto(key, await prepareUpload(file))
    } catch {
      setError("That file couldn't be read as a photo. Try another one.")
    } finally {
      setLoadingUpload(false)
    }
  }

  async function submit() {
    const numberError = idNumberError(idType, idNumber)
    if (numberError) { setError(numberError); return }
    setSubmitting(true); setError('')
    const form = new FormData()
    form.append('idType', idType)
    form.append('idNumber', idNumber)
    form.append('captureMethod', photoSteps.every((k) => photos[k]?.source === 'camera') ? 'camera' : 'upload')
    for (const k of photoSteps) form.append(k, new File([photos[k]!.blob], `${k}.jpg`, { type: 'image/jpeg' }))
    try {
      const res = await fetch('/api/users/me/id-submission', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Submission failed, please try again'); return }
      onSubmitted()
    } catch {
      setError('Submission failed, please check your connection and try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 sm:p-5 bg-white">
      {/* Progress */}
      <ol className="flex items-center gap-1.5 mb-5" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s} className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? 'bg-paddy' : 'bg-gray-200'}`} aria-current={i === stepIndex ? 'step' : undefined} />
        ))}
      </ol>

      {step === 'type' && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-1">Which ID will you use?</h3>
          <p className="text-sm text-gray-500 mb-4">You&apos;ll take photos of it and a selfie holding it. Staff check them before you can sell.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ID_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => { if (t.key !== idType) { (['front', 'back', 'selfie'] as PhotoKey[]).forEach((k) => setPhoto(k, undefined)) } setIdType(t.key); setStep('front') }}
                className={`text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${idType === t.key ? 'border-paddy bg-field' : 'border-gray-200 hover:border-gray-400'}`}
              >
                <span className="font-medium text-gray-900">{t.label}</span>
                {t.hint && <span className="block text-xs text-paddy-deep">{t.hint}</span>}
                {!t.needsBack && <span className="block text-xs text-gray-500">Photo page only</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {type && (step === 'front' || step === 'back' || step === 'selfie') && (() => {
        const key = step
        const photo = photos[key]
        const info = PHOTO_STEPS[key]
        return (
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">{info.title}</h3>
            <p className="text-sm text-gray-500 mb-4">
              {key === 'selfie'
                ? 'Hold your ID next to your face so both are clear. This shows the ID is yours.'
                : `${type.label}${key === 'front' ? ', the side with your photo' : ''}. Lay it flat in good light, without glare.`}
            </p>

            {photo ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview */}
                <img src={photo.url} alt={`${info.title} preview`} className="w-full max-w-xl mx-auto rounded-xl border border-gray-200" />
                {photo.problems.length > 0 && (
                  <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900 flex gap-2">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      {photo.problems.map((p) => <p key={p}>{PROBLEM_MESSAGES[p]}</p>)}
                      <p className="text-xs text-amber-800 mt-1">A clear photo gets approved faster.</p>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-3 mt-4">
                  <button type="button" onClick={() => setPhoto(key, undefined)} className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50">
                    <RotateCcw size={14} /> Retake
                  </button>
                  <button type="button" onClick={next} className="inline-flex items-center gap-1.5 bg-paddy hover:bg-paddy-deep text-white text-sm font-medium px-4 py-2 rounded-lg">
                    <Check size={14} /> {photo.problems.length > 0 ? 'Use anyway' : 'Use this photo'}
                  </button>
                </div>
              </div>
            ) : camera === 'ok' ? (
              <IdCamera
                key={key}
                facing={key === 'selfie' ? 'user' : 'environment'}
                frameAspect={key === 'selfie' ? undefined : FRAME_ASPECT[type.frame]}
                prompt={info.prompt}
                onCapture={(p) => setPhoto(key, p)}
                onUnavailable={setCamera}
              />
            ) : (
              <div className="rounded-xl border-2 border-dashed border-gray-300 p-6 text-center">
                <p className="text-sm text-gray-700 mb-1">
                  {camera === 'denied'
                    ? "Camera access was blocked. Allow the camera in your browser's settings and reload, or upload a photo instead."
                    : "No camera is available on this device, so upload a photo instead."}
                </p>
                <p className="text-xs text-gray-500 mb-4">Staff will see that the photo was uploaded rather than taken with the camera.</p>
                <label className="inline-flex items-center gap-1.5 bg-paddy hover:bg-paddy-deep text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer">
                  {loadingUpload ? <Loader2 size={14} className="animate-spin" /> : <ImageUp size={14} />} Choose photo
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => upload(key, e.target.files?.[0])} />
                </label>
              </div>
            )}
          </div>
        )
      })()}

      {type && step === 'number' && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-1">ID number and review</h3>
          <p className="text-sm text-gray-500 mb-4">
            Type the number exactly as printed on your {type.label}. We keep only its last 4 characters, to stop the same ID being used on two accounts.
          </p>
          <label htmlFor="idNumber" className="block text-xs font-medium text-gray-600 mb-1">{type.label} number</label>
          <input
            id="idNumber"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder={type.numberExample}
            autoComplete="off"
            className={`${INPUT} max-w-sm`}
          />
          <div className="grid grid-cols-3 gap-2 mt-5 max-w-xl">
            {photoSteps.map((k) => (
              <button key={k} type="button" onClick={() => setStep(k)} className="text-left group flex flex-col self-start">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview */}
                <img src={photos[k]!.url} alt={PHOTO_STEPS[k].title} className="block w-full aspect-[4/3] object-cover rounded-lg border border-gray-200 group-hover:border-paddy" />
                <span className="text-xs text-gray-600">{PHOTO_STEPS[k].title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-red-600 text-sm mt-4">{error}</p>}

      <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
        <button type="button" onClick={back} disabled={submitting} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft size={14} /> {stepIndex === 0 ? 'Cancel' : 'Back'}
        </button>
        {step === 'number' && (
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !idNumber.trim()}
            className="ml-auto inline-flex items-center gap-2 bg-paddy hover:bg-paddy-deep disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />} Submit for review
          </button>
        )}
      </div>
    </div>
  )
}
