'use client'

import { type ReactNode } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'

// ── Spring presets matching UX Pro Max recommendations ──
export const springs = {
  snappy: { type: 'spring' as const, stiffness: 500, damping: 30 },
  gentle: { type: 'spring' as const, stiffness: 300, damping: 25 },
  bouncy: { type: 'spring' as const, stiffness: 400, damping: 15 },
  smooth: { type: 'spring' as const, stiffness: 200, damping: 20 },
} as const

// ── Duration presets ──
export const durations = {
  instant: 0.05,
  fast: 0.1,
  normal: 0.2,
  slow: 0.3,
  slower: 0.4,
} as const

// ── Reusable variant sets ──

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: durations.normal } },
  exit: { opacity: 0, transition: { duration: durations.fast } },
}

export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: springs.gentle },
  exit: { opacity: 0, y: -4, transition: { duration: durations.fast } },
}

export const fadeSlideDown: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: springs.gentle },
  exit: { opacity: 0, y: -4, transition: { duration: durations.fast } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: springs.snappy },
  exit: { opacity: 0, scale: 0.97, transition: { duration: durations.fast } },
}

export const slideFromRight: Variants = {
  hidden: { x: '100%', opacity: 0 },
  visible: { x: 0, opacity: 1, transition: springs.smooth },
  exit: { x: '100%', opacity: 0, transition: { duration: durations.slow } },
}

export const slideFromLeft: Variants = {
  hidden: { x: -20, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: springs.gentle },
  exit: { x: -20, opacity: 0, transition: { duration: durations.fast } },
}

// ── Stagger container ──
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springs.gentle,
  },
}

// ── Component wrappers ──

interface MotionProps {
  children: ReactNode
  className?: string
  delay?: number
}

/** Fade + slide up on mount. Use for page content sections. */
export function FadeIn({ children, className, delay = 0 }: MotionProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeSlideUp}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Stagger children with fade + slide up. Use for lists. */
export function StaggerList({ children, className }: MotionProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Individual stagger item. Must be child of StaggerList. */
export function StaggerItem({ children, className }: MotionProps) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  )
}

/** Scale + fade for dropdowns and popovers. */
export function ScaleIn({ children, className }: MotionProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={scaleIn}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Slide from right for panels and modals. */
export function SlidePanel({ children, className }: MotionProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={slideFromRight}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Hover + tap micro-interaction for cards. Press scale 0.97, hover lift. */
export function InteractiveCard({
  children,
  className,
  onClick,
}: MotionProps & { onClick?: () => void }) {
  return (
    <motion.div
      className={className}
      onClick={onClick}
      whileHover={{
        y: -2,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        transition: { duration: durations.normal },
      }}
      whileTap={{
        scale: 0.98,
        transition: { duration: durations.instant },
      }}
    >
      {children}
    </motion.div>
  )
}

/** Row hover highlight with subtle left-border accent. */
export function InteractiveRow({
  children,
  className,
  onClick,
}: MotionProps & { onClick?: () => void }) {
  return (
    <motion.div
      className={className}
      onClick={onClick}
      whileHover={{
        backgroundColor: 'hsl(var(--accent) / 0.5)',
        transition: { duration: durations.fast },
      }}
      whileTap={{
        scale: 0.995,
        transition: { duration: durations.instant },
      }}
    >
      {children}
    </motion.div>
  )
}

/** Presence wrapper for AnimatePresence. */
export function Presence({
  children,
  show,
  mode = 'wait',
}: {
  children: ReactNode
  show: boolean
  mode?: 'wait' | 'sync' | 'popLayout'
}) {
  return (
    <AnimatePresence mode={mode}>
      {show && children}
    </AnimatePresence>
  )
}

/** Tab content transition. Crossfade between views. */
export function TabContent({
  children,
  activeKey,
  className,
}: {
  children: ReactNode
  activeKey: string
  className?: string
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeKey}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: durations.normal, ease: [0.2, 0, 0, 1] }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/** Skeleton shimmer for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-muted animate-pulse ${className ?? ''}`}
      style={{
        backgroundImage: 'linear-gradient(90deg, transparent 0%, hsl(var(--muted-foreground) / 0.05) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s ease-in-out infinite',
      }}
    />
  )
}

/** Online status indicator with pulse animation. */
export function StatusDot({
  status,
  size = 'sm',
}: {
  status: 'online' | 'away' | 'offline' | 'dnd'
  size?: 'sm' | 'md'
}) {
  const colors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    offline: 'bg-gray-400',
    dnd: 'bg-red-500',
  }
  const sizes = { sm: 'h-2.5 w-2.5', md: 'h-3 w-3' }

  return (
    <span className="relative flex">
      <span className={`${sizes[size]} rounded-full ${colors[status]}`} />
      {status === 'online' && (
        <span
          className={`absolute inline-flex ${sizes[size]} rounded-full ${colors[status]} opacity-75`}
          style={{ animation: 'pulse-ring 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }}
        />
      )}
    </span>
  )
}

// Re-export motion and AnimatePresence for direct use
export { motion, AnimatePresence }
