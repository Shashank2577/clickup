'use client'

import { useState, useEffect } from 'react'
import { IconRail } from './icon-rail'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'
import { CommandPalette } from './command-palette'
import { motion, AnimatePresence, fadeSlideUp, springs } from '@/components/motion'
import { usePathname } from 'next/navigation'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Icon Rail - Fixed left edge */}
      <IconRail />

      {/* Main area with sidebar + content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar onSearchClick={() => setSearchOpen(true)} />

        {/* Content area with sidebar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Secondary Sidebar */}
          <Sidebar />

          {/* Main Content with page transition */}
          <main className="flex-1 overflow-y-auto bg-background">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={springs.gentle}
                className="h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Command Palette (⌘K) */}
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
