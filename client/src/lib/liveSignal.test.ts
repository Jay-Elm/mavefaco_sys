import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Outside a request, as in a script: after() isn't available.
vi.mock('next/server', () => ({ after: () => { throw new Error('outside a request') } }))

import { realtimeClientConfig, signalChange } from './liveSignal'

const ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'] as const

describe('liveSignal', () => {
  const fetchMock = vi.fn(async () => new Response('{}', { status: 202 }))

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    for (const k of ENV) delete process.env[k]
  })

  it('sends nothing when Supabase is not configured', async () => {
    signalChange()
    await vi.advanceTimersByTimeAsync(100)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(realtimeClientConfig()).toBeNull()
  })

  it('sends one empty change message for writes close together', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    signalChange()
    signalChange()
    signalChange()
    await vi.advanceTimersByTimeAsync(100)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://example.supabase.co/realtime/v1/api/broadcast')
    expect(JSON.parse(init.body as string)).toEqual({ messages: [{ topic: 'live', event: 'change', payload: {} }] })

    // A later write gets its own message.
    signalChange()
    await vi.advanceTimersByTimeAsync(100)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives browsers the public key only, never the service key', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    expect(realtimeClientConfig()).toBeNull()
    process.env.SUPABASE_ANON_KEY = 'public'
    expect(realtimeClientConfig()).toEqual({ url: 'https://example.supabase.co', key: 'public', topic: 'live' })
  })
})
