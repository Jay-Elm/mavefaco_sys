'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, Loader2, X, Leaf } from 'lucide-react'

interface Props {
  value: string
  onChange: (url: string) => void
  token: string | null
}

export default function ImageUploader({ value, onChange, token }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      })
      const data = await res.json()
      if (!res.ok) { setUploadError(data.error ?? 'Upload failed'); return }
      onChange(data.url)
    } catch {
      setUploadError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <div
        className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border-2 border-dashed border-gray-200 bg-gray-50 cursor-pointer hover:border-green-400 transition-colors flex items-center justify-center"
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {value ? (
          <Image src={value} alt="Product photo" fill unoptimized className="object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-300 select-none">
            <Leaf size={40} strokeWidth={1.5} />
            <span className="text-sm text-gray-400">Click to upload a photo</span>
            <span className="text-xs text-gray-300">JPG, PNG, WEBP — max 4 MB</span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-green-600" />
          </div>
        )}

        {!uploading && (
          <div className="absolute bottom-2 right-2 bg-white/90 rounded-full p-1.5 shadow-sm">
            <Camera size={15} className="text-gray-500" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-sm text-green-700 hover:text-green-900 font-medium disabled:opacity-40 transition-colors"
        >
          {uploading ? 'Uploading…' : value ? 'Change photo' : 'Upload photo'}
        </button>
        {value && !uploading && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
          >
            <X size={13} /> Remove
          </button>
        )}
      </div>

      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
    </div>
  )
}
