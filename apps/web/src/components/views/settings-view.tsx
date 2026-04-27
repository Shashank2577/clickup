'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Settings,
  Users,
  UsersRound,
  Gem,
  Sparkles,
  Shield,
  FileSearch,
  Trash2,
  Columns3,
  LayoutTemplate,
  Zap,
  Mic,
  Box,
  ListChecks,
  CalendarClock,
  AppWindow,
  Import,
  Code2,
  Mail,
  Bell,
  Building2,
  MessageSquare,
  LogOut,
  Check,
  Monitor,
  Moon,
  SunMoon,
  ChevronRight,
  Eye,
  EyeOff,
  Smartphone,
  KeyRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores'
import { motion, InteractiveRow, InteractiveCard, TabContent, springs } from '@/components/motion'

// --- Types ---

interface SidebarNavItem {
  icon: React.ReactNode
  label: string
  id: string
}

interface SidebarSection {
  title: string
  items: SidebarNavItem[]
}

// --- Data ---

const sidebarSections: SidebarSection[] = [
  {
    title: 'Admin',
    items: [
      { icon: <Settings className="h-4 w-4" />, label: 'General', id: 'general' },
      { icon: <Users className="h-4 w-4" />, label: 'People', id: 'people' },
      { icon: <UsersRound className="h-4 w-4" />, label: 'Teams', id: 'teams' },
      { icon: <Gem className="h-4 w-4" />, label: 'Upgrade', id: 'upgrade' },
      { icon: <Sparkles className="h-4 w-4" />, label: 'AI Usage', id: 'ai-usage' },
      { icon: <Shield className="h-4 w-4" />, label: 'Security & Permissions', id: 'security' },
      { icon: <FileSearch className="h-4 w-4" />, label: 'Audit Logs', id: 'audit-logs' },
      { icon: <Trash2 className="h-4 w-4" />, label: 'Trash', id: 'trash' },
    ],
  },
  {
    title: 'Features',
    items: [
      { icon: <Columns3 className="h-4 w-4" />, label: 'Custom Field Manager', id: 'custom-fields' },
      { icon: <LayoutTemplate className="h-4 w-4" />, label: 'Template Center', id: 'templates' },
      { icon: <Zap className="h-4 w-4" />, label: 'Automations Manager', id: 'automations' },
      { icon: <Mic className="h-4 w-4" />, label: 'AI Notetaker', id: 'ai-notetaker' },
      { icon: <Box className="h-4 w-4" />, label: 'Spaces', id: 'spaces' },
      { icon: <ListChecks className="h-4 w-4" />, label: 'Task Types', id: 'task-types' },
      { icon: <CalendarClock className="h-4 w-4" />, label: 'Work Schedule', id: 'work-schedule' },
    ],
  },
  {
    title: 'Integrations & ClickApps',
    items: [
      { icon: <AppWindow className="h-4 w-4" />, label: 'App Center', id: 'app-center' },
      { icon: <Import className="h-4 w-4" />, label: 'Imports/Exports', id: 'imports-exports' },
      { icon: <Code2 className="h-4 w-4" />, label: 'ClickUp API', id: 'api' },
      { icon: <Mail className="h-4 w-4" />, label: 'Email Integration', id: 'email-integration' },
    ],
  },
  {
    title: 'My Settings',
    items: [
      { icon: <Settings className="h-4 w-4" />, label: 'Preferences', id: 'preferences' },
      { icon: <Bell className="h-4 w-4" />, label: 'Notifications', id: 'notifications' },
      { icon: <Building2 className="h-4 w-4" />, label: 'Workspaces', id: 'workspaces' },
      { icon: <MessageSquare className="h-4 w-4" />, label: 'Chat', id: 'chat' },
      { icon: <LogOut className="h-4 w-4" />, label: 'Log out', id: 'logout' },
    ],
  },
]

const themeColors = [
  { id: 'purple', color: '#7B68EE', label: 'Purple' },
  { id: 'blue', color: '#3B82F6', label: 'Blue' },
  { id: 'cyan', color: '#06B6D4', label: 'Cyan' },
  { id: 'teal', color: '#14B8A6', label: 'Teal' },
  { id: 'green', color: '#22C55E', label: 'Green' },
  { id: 'yellow', color: '#EAB308', label: 'Yellow' },
  { id: 'orange', color: '#F97316', label: 'Orange' },
  { id: 'red', color: '#EF4444', label: 'Red' },
  { id: 'pink', color: '#EC4899', label: 'Pink' },
  { id: 'slate', color: '#64748B', label: 'Slate' },
]

const appearanceOptions = [
  { id: 'light', label: 'Light', icon: Monitor, description: 'Classic light theme' },
  { id: 'dark', label: 'Dark', icon: Moon, description: 'Easy on the eyes' },
  { id: 'auto', label: 'Auto', icon: SunMoon, description: 'Sync with system' },
]

// --- Sub-components ---

function SettingsSidebar({
  activeItem,
  onItemChange,
}: {
  activeItem: string
  onItemChange: (id: string) => void
}) {
  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-border bg-sidebar overflow-y-auto scrollbar-thin">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold">Settings</h2>
      </div>
      {sidebarSections.map((section) => (
        <div key={section.title} className="py-1.5">
          <div className="px-4 py-1">
            <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </span>
          </div>
          <div className="space-y-0.5 px-2">
            {section.items.map((item) => (
              <InteractiveRow
                key={item.id}
                onClick={() => onItemChange(item.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm cursor-pointer',
                  activeItem === item.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground/70'
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center shrink-0 text-current">
                  {item.icon}
                </span>
                <span className="flex-1 truncate text-left">{item.label}</span>
                {item.id === activeItem && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
              </InteractiveRow>
            ))}
          </div>
        </div>
      ))}
    </aside>
  )
}

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        enabled ? 'bg-primary' : 'bg-muted-foreground/30'
      )}
    >
      <motion.span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm"
        animate={{ x: enabled ? 18 : 3 }}
        transition={springs.snappy}
      />
    </button>
  )
}

function PreferencesContent() {
  const user = useAuthStore((s) => s.user)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [smsEnabled, setSmsEnabled] = useState(false)
  const [authAppEnabled, setAuthAppEnabled] = useState(false)
  const [selectedThemeColor, setSelectedThemeColor] = useState('purple')
  const [selectedAppearance, setSelectedAppearance] = useState('light')
  const [highContrast, setHighContrast] = useState(false)


  useEffect(() => {
    async function loadProfile() {
      try {
        const me = await api.get<any>('/users/me')
        setFullName(me.fullName ?? '')
        setEmail(me.email ?? '')
      } catch {
        setFullName(user?.fullName ?? '')
        setEmail(user?.email ?? '')
      }
    }
    loadProfile()
  }, [user?.fullName, user?.email])

  async function saveChanges() {
    await api.patch('/users/me', { body: { fullName, email } })
    await api.patch('/users/me/preferences', { body: { accentColor: selectedThemeColor, appearanceMode: selectedAppearance, highContrast } })
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-2xl px-8 py-6 space-y-8">
        {/* Profile Section */}
        <section>
          <h3 className="text-base font-semibold mb-4">Profile</h3>
          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg font-bold">SS</AvatarFallback>
              </Avatar>
              <div>
                <Button variant="outline" size="sm" className="text-xs">
                  Change avatar
                </Button>
                <p className="text-2xs text-muted-foreground mt-1">
                  JPG, GIF or PNG. Max size 2MB
                </p>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value="password123"
                  readOnly
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 pr-8 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <button className="mt-1 text-xs text-primary hover:underline">
                Change password
              </button>
            </div>
          </div>
        </section>

        {/* 2FA Section */}
        <section>
          <h3 className="text-base font-semibold mb-1">Two-factor authentication (2FA)</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Add an extra layer of security to your account
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">SMS</p>
                  <p className="text-2xs text-muted-foreground">
                    Receive codes via text message
                  </p>
                </div>
              </div>
              <ToggleSwitch enabled={smsEnabled} onToggle={async () => { const next=!smsEnabled; setSmsEnabled(next); await api.post(`/auth/2fa/${next ? 'enable':'disable'}`, { body: { method: 'sms' } }) }} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Authenticator App</p>
                  <p className="text-2xs text-muted-foreground">
                    Use Google Authenticator or similar
                  </p>
                </div>
              </div>
              <ToggleSwitch enabled={authAppEnabled} onToggle={async () => { const next=!authAppEnabled; setAuthAppEnabled(next); await api.post(`/auth/2fa/${next ? 'enable':'disable'}`, { body: { method: 'app' } }) }} />
            </div>
          </div>
        </section>

        {/* Theme Color */}
        <section>
          <h3 className="text-base font-semibold mb-1">Theme color</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Choose the accent color for your workspace
          </p>
          <div className="flex items-center gap-2">
            {themeColors.map((tc) => (
              <motion.button
                key={tc.id}
                onClick={() => setSelectedThemeColor(tc.id)}
                className={cn(
                  'relative h-8 w-8 rounded-full',
                  selectedThemeColor === tc.id && 'ring-2 ring-offset-2 ring-offset-background'
                )}
                style={{
                  backgroundColor: tc.color,
                  ...(selectedThemeColor === tc.id ? { ringColor: tc.color } : {}),
                }}
                title={tc.label}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                transition={springs.bouncy}
              >
                {selectedThemeColor === tc.id && (
                  <Check className="h-4 w-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                )}
              </motion.button>
            ))}
          </div>
        </section>

        {/* Appearance */}
        <section>
          <h3 className="text-base font-semibold mb-1">Appearance</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Choose how the app looks for you
          </p>
          <div className="grid grid-cols-3 gap-3">
            {appearanceOptions.map((opt) => {
              const Icon = opt.icon
              return (
                <InteractiveCard
                  key={opt.id}
                  onClick={() => setSelectedAppearance(opt.id)}
                  className={cn(
                    'flex flex-col items-center rounded-lg border-2 p-4 cursor-pointer',
                    selectedAppearance === opt.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  )}
                >
                  <div
                    className={cn(
                      'mb-3 flex h-12 w-16 items-center justify-center rounded-md',
                      opt.id === 'light' && 'bg-white border border-border',
                      opt.id === 'dark' && 'bg-gray-900 border border-gray-700',
                      opt.id === 'auto' && 'bg-gradient-to-r from-white to-gray-900 border border-border'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5',
                        opt.id === 'light' && 'text-gray-700',
                        opt.id === 'dark' && 'text-gray-300',
                        opt.id === 'auto' && 'text-gray-500'
                      )}
                    />
                  </div>
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="text-2xs text-muted-foreground mt-0.5">
                    {opt.description}
                  </span>
                </InteractiveCard>
              )
            })}
          </div>
        </section>

        {/* Contrast */}
        <section>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">High Contrast</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Increase contrast for better readability
              </p>
            </div>
            <ToggleSwitch enabled={highContrast} onToggle={() => setHighContrast(!highContrast)} />
          </div>
        </section>

        {/* Save */}
        <div className="pt-2 pb-8">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} transition={springs.snappy}>
            <Button className="px-6" onClick={saveChanges}>
              Save changes
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// --- Main Component ---

export function SettingsView() {
  const [activeItem, setActiveItem] = useState('preferences')

  return (
    <div className="flex h-full">
      <SettingsSidebar activeItem={activeItem} onItemChange={setActiveItem} />
      <TabContent activeKey={activeItem} className="flex-1">
        {activeItem === 'preferences' ? (
          <PreferencesContent />
        ) : (
          <div className="flex flex-1 items-center justify-center h-full">
            <div className="text-center">
              <Settings className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm font-medium capitalize">
                {sidebarSections
                  .flatMap((s) => s.items)
                  .find((i) => i.id === activeItem)?.label || activeItem}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This settings page is coming soon
              </p>
            </div>
          </div>
        )}
      </TabContent>
    </div>
  )
}
