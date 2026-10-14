'use client'

import RoleRedirect from '@/components/RoleRedirect'

// The storefront home is for customers and guests; everyone else has a portal.
const AWAY = ['admin', 'manager', 'farmer']

export default function HomeRedirect() {
  return <RoleRedirect roles={AWAY} />
}
