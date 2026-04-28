/**
 * WebSocket client for real-time updates.
 * Connects to the API gateway's WebSocket endpoint.
 *
 * Usage:
 *   import { wsClient } from '@/lib/websocket'
 *   wsClient.connect(token)
 *   wsClient.subscribe('workspace:abc123')
 *   wsClient.on('task.updated', (data) => { ... })
 */

type EventHandler = (data: unknown) => void

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080/ws'

class WebSocketClient {
  private ws: WebSocket | null = null
  private handlers = new Map<string, Set<EventHandler>>()
  private subscriptions = new Set<string>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private token: string | null = null

  connect(token: string) {
    this.token = token
    this.doConnect()
  }

  private doConnect() {
    if (!this.token) return
    try {
      this.ws = new WebSocket(`${WS_URL}?token=${this.token}`)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        // Re-subscribe to rooms
        for (const room of this.subscriptions) {
          this.send({ type: 'subscribe', room })
        }
      }

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.event) {
            this.emit(msg.event, msg.data)
          }
        } catch {}
      }

      this.ws.onclose = () => {
        this.scheduleReconnect()
      }

      this.ws.onerror = () => {
        this.ws?.close()
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay)
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
    this.subscriptions.clear()
    this.handlers.clear()
  }

  subscribe(room: string) {
    this.subscriptions.add(room)
    this.send({ type: 'subscribe', room })
  }

  unsubscribe(room: string) {
    this.subscriptions.delete(room)
    this.send({ type: 'unsubscribe', room })
  }

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
    return () => this.handlers.get(event)?.delete(handler)
  }

  private emit(event: string, data: unknown) {
    this.handlers.get(event)?.forEach(handler => handler(data))
    this.handlers.get('*')?.forEach(handler => handler({ event, data }))
  }

  private send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }
}

export const wsClient = new WebSocketClient()
