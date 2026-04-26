'use client'

import { IconRail } from './icon-rail'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Icon Rail - Fixed left edge */}
      <IconRail />

      {/* Main area with sidebar + content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar />

        {/* Content area with sidebar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Secondary Sidebar */}
          <Sidebar />

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
