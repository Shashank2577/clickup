'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useUser, useOrganization } from '@clerk/nextjs'
import { Skeleton } from '@/components/motion'
import { wsClient } from '@/lib/websocket'
import { useAuthStore, useWorkspaceStore, useNotificationStore } from '@/stores'

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const { isLoaded, isSignedIn, user } = useUser()
  const { organization } = useOrganization()
  const { loadWorkspaces } = useAuthStore()
  const { loadSpaces, loadFavorites } = useWorkspaceStore()
  const { loadNotifications } = useNotificationStore()

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn && pathname !== '/login' && pathname !== '/register') {
      router.replace('/login')
    }
  }, [isLoaded, isSignedIn, pathname, router])

  // Effect 1: Load workspaces when signed in (no org required)
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return
    loadWorkspaces()
  }, [isLoaded, isSignedIn, user, loadWorkspaces])

  // Effect 2: Load space data and set up WebSocket when org is available
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || !organization) return

    loadSpaces(organization.id)
    loadFavorites(organization.id)
    loadNotifications('primary')

    // TODO: pass a real Clerk session JWT once api-gateway WS validates Clerk tokens (Task 5)
    wsClient.connect('')
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
