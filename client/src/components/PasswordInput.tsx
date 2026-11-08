'use client'

import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Props that stop browsers and password managers from filling a box on
 * their own. Browsers ignore autocomplete="off" on password boxes but never
 * fill a read-only box, so the box stays read-only until it's tapped,
 * clicked or tabbed into. (Unlocking on pointer-down, before focus, lets the
 * phone keyboard open on the first tap.)
 */
export function useNoAutofill() {
  const [locked, setLocked] = useState(true)
  const unlock = () => setLocked(false)
  return {
    readOnly: locked,
    onFocus: unlock,
    onPointerDown: unlock,
    autoComplete: 'off',
    'data-lpignore': 'true',
    'data-1p-ignore': 'true',
    'data-bwignore': 'true',
  } as const
}

/**
 * A password box with an eye button: press and hold it (mouse, finger, or
 * Space/Enter) to see what was typed; let go and it's hidden again.
 * Takes every prop an <input> does, including react-hook-form's register().
 * `noAutofill` keeps saved passwords out of it (see useNoAutofill).
 */
export default function PasswordInput({
  className = '',
  noAutofill = false,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { noAutofill?: boolean }) {
  const [shown, setShown] = useState(false)
  const guard = useNoAutofill()
  const show = () => setShown(true)
  const hide = () => setShown(false)

  return (
    <div className="relative">
      <input {...props} {...(noAutofill ? guard : {})} type={shown ? 'text' : 'password'} className={`${className} pr-10`} />
      <button
        type="button"
        aria-label={shown ? 'Hide password' : 'Hold to show password'}
        title="Hold to show password"
        onPointerDown={(e) => { e.preventDefault(); show() }}
        onPointerUp={hide}
        onPointerLeave={hide}
        onPointerCancel={hide}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); show() } }}
        onKeyUp={hide}
        onBlur={hide}
        onContextMenu={(e) => e.preventDefault()}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-soil select-none touch-none"
      >
        {shown ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
      </button>
    </div>
  )
}
