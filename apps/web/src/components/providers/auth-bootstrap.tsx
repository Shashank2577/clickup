'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useUser, useOrganization } from '@clerk/nextjs'
import { Skeleton } from '@/components/motion'
import { wsClient } from '@/lib/websocket'
import { useWorkspaceStore, useNotificationStore } from '@/stores'

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const { isLoaded, isSignedIn, user } = useUser()
  const { organization } = useOrganization()
  const { loadSpaces, loadFavorites } = useWorkspaceStore()
  const { loadNotifications } = useNotificationStore()

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn && pathname !== '/login' && pathname !== '/register') {
      router.replace('/login')
    }
  }, [isLoaded, isSignedIn, pathname, router])

  // Bootstrap workspace data once signed in
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || !organization) return

    loadSpaces(organization.id)
    loadFavorites(organization.id)
    loadNotifications('primary')

    // Pass user.id as the connection identifier (placeholder; WS auth will be
    // updated separately once Clerk session tokens are plumbed through the gateway)
    wsClient.connect(user.id)
    wsClient.subscribe(`workspace:${organization.id}`)
    wsClient.subscribe(`user:${user.id}`)

    return () => {
      wsClient.unsubscribe(`workspace:${organization.id}`)
      wsClient.unsubscribe(`user:${user.id}`)
    }
  }, [isLoaded, isSignedIn, user, organization, loadSpaces, loadFavorites, loadNotifications])

  if (!isLoaded && pathname !== '/login' && pathname !== '/register') {
    return <Skeleton className="h-screen w-screen" />
  }

  return <>{children}</>
}
