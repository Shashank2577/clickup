'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Send, Sparkles, Brain, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FadeIn, StaggerList, StaggerItem, motion } from '@/components/motion'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const SUGGESTED_PROMPTS = [
  'Summarize my tasks',
  "What's overdue?",
  'Draft a project plan',
  'Show my productivity trends',
  'What should I work on next?',
]

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm ClickUp Brain. Ask me anything about your workspace, tasks, or projects. I can help you summarize, plan, and stay on top of your work.",
  timestamp: new Date(),
}

export function AIView() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function simulateResponse(userMessage: string) {
    setIsThinking(true)

    // Simulate AI thinking delay
    setTimeout(() => {
      const responses: Record<string, string> = {
        'Summarize my tasks':
          "Here's a summary of your current tasks:\n\n- **4 tasks total** across 2 projects\n- **2 in progress**: Mobile App MVP Development, API Integration\n- **1 overdue**: Beta Testing Program (due Jul 2)\n- **1 completed**: Market Research & Analysis\n\nYour most urgent item is the Mobile App MVP Development, which is due on June 16th.",
        "What's overdue?":
          "You have **1 overdue task**:\n\n- **Beta Testing Program** - Was due Jul 2, 2026\n  - Priority: High\n  - Status: To Do\n  - Subtasks: Draft Recruitment Email, Setup Feedback Form\n\nI'd recommend prioritizing this one today.",
        'Draft a project plan':
          "Here's a draft project plan based on your current workspace:\n\n**Phase 1: Foundation (Week 1-2)**\n- Complete database schema design\n- Finalize API integration\n\n**Phase 2: Development (Week 3-4)**\n- Build UI component library\n- Implement core features\n\n**Phase 3: Testing (Week 5)**\n- Run beta testing program\n- Collect and analyze feedback\n\n**Phase 4: Launch (Week 6)**\n- Execute product launch campaign\n- Monitor and iterate\n\nWant me to create these as tasks?",
      }

      const response =
        responses[userMessage] ??
        `I've analyzed your workspace regarding "${userMessage}". Based on your current tasks and projects, here are some insights:\n\n- You have active work in multiple projects\n- Consider breaking down larger tasks into subtasks for better tracking\n- Your team's velocity looks healthy based on recent completions\n\nWould you like me to dive deeper into any specific area?`

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        },
      ])
      setIsThinking(false)
    }, 1200)
  }

  function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || isThinking) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    simulateResponse(trimmed)
  }

  function handlePromptClick(prompt: string) {
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    simulateResponse(prompt)
  }

  const showEmptyState = messages.length <= 1

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <FadeIn>
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">ClickUp Brain</h1>
          </div>
          <Button variant="outline" size="sm">
            New Chat
          </Button>
        </div>
      </FadeIn>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-3xl px-6 py-6">
          {showEmptyState && (
            <FadeIn className="flex flex-col items-center py-12">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
                <Brain className="h-10 w-10 text-primary" />
              </div>
              <h2 className="mb-2 text-xl font-semibold">ClickUp Brain</h2>
              <p className="mb-8 max-w-md text-center text-sm text-muted-foreground">
                Your AI-powered workspace assistant. Ask about tasks, get summaries,
                draft plans, and more.
              </p>
            </FadeIn>
          )}

          {/* Message list */}
          <div className="space-y-6">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'flex gap-3',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <Avatar className="mt-0.5 h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      <Sparkles className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-xl px-4 py-2.5 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
                {msg.role === 'user' && (
                  <Avatar className="mt-0.5 h-7 w-7 shrink-0">
                    <AvatarFallback className="text-xs">SS</AvatarFallback>
                  </Avatar>
                )}
              </motion.div>
            ))}

            {/* Thinking indicator */}
            {isThinking && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3"
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    <Sparkles className="h-3.5 w-3.5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested prompts */}
          {showEmptyState && (
            <StaggerList className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <StaggerItem key={prompt}>
                  <button
                    onClick={() => handlePromptClick(prompt)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    {prompt}
                  </button>
                </StaggerItem>
              ))}
            </StaggerList>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border p-4">
        <div className="mx-auto max-w-3xl">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 focus-within:ring-1 focus-within:ring-ring transition-shadow"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask ClickUp Brain anything..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              disabled={isThinking}
            />
            <Button
              type="submit"
              size="icon-sm"
              variant={input.trim() ? 'default' : 'ghost'}
              disabled={!input.trim() || isThinking}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
          <p className="mt-2 text-center text-2xs text-muted-foreground">
            ClickUp Brain can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  )
}
