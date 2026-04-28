import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { AuthBootstrap } from '@/components/providers/auth-bootstrap'
import '@/styles/globals.css'

// Using CSS variable from globals.css — no network call at build time
const plusJakarta = { variable: '--font-sans' }

export const metadata: Metadata = {
  title: 'ClickUp',
  description: 'Project management, reimagined.',
}

const clerkLocalization = {
  signIn: {
    start: {
      title: 'Sign in to ClickUp',
      subtitle: 'Welcome back! Continue to your workspace.',
      actionText: "Don't have an account?",
      actionLink: 'Sign up',
    },
  },
  signUp: {
    start: {
      title: 'Create your ClickUp account',
      subtitle: 'Get started with project management.',
      actionText: 'Already have an account?',
      actionLink: 'Sign in',
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      localization={clerkLocalization}
      appearance={{
        variables: {
          colorPrimary: '#7B68EE',
          colorText: '#1a1a2e',
          fontFamily: 'var(--font-sans)',
          borderRadius: '0.5rem',
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className={`${plusJakarta.variable} font-sans`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AuthBootstrap>{children}</AuthBootstrap>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
