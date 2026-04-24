import * as http from 'http'
import * as ws from 'ws'
import * as Y from 'yjs'
import { verifyWsJwt } from './ws.auth.js'
import { createDocsRepository } from '../docs/docs.repository.js'
import { logger } from '@clickup/sdk'
import type { Pool } from 'pg'

const SNAPSHOT_INTERVAL_MS = 30_000  // 30 seconds

// Map of docId → { ydoc, snapshotTimer }
const activeDocs = new Map<string, { ydoc: Y.Doc; timer: NodeJS.Timeout }>()

export function attachWebSocketServer(httpServer: http.Server, db: Pool): void {
  const wss = new ws.WebSocketServer({ noServer: true })
  const repository = createDocsRepository(db)

  httpServer.on('upgrade', async (req, socket, head) => {
    const match = req.url?.match(/^\/ws\/docs\/([0-9a-f-]+)(\?.*)?$/)
    if (!match) { socket.destroy(); return }

    const docId = match[1]!

    const url = new URL(req.url!, 'http://localhost')
    const token = url.searchParams.get('token')
    if (!token) { socket.destroy(); return }

    let userId: string
    try {
      const payload = verifyWsJwt(token)
      userId = payload.userId
    } catch {
      socket.destroy()
      return
    }

    const doc = await repository.getDoc(docId)
    if (!doc) { socket.destroy(); return }

    const isMember = await repository.isWorkspaceMember(doc.workspace_id, userId)
    if (!isMember) { socket.destroy(); return }

    wss.handleUpgrade(req, socket, head, (wsConn) => {
      wss.emit('connection', wsConn, req, docId, userId)
    })
  })

  wss.on('connection', async (wsConn: ws.WebSocket, req: http.IncomingMessage, docId: string, userId: string) => {
    logger.info({ docId, userId }, 'WebSocket client connected to doc')

    if (!activeDocs.has(docId)) {
      const ydoc = new Y.Doc()

      const snapshot = await repository.getLatestSnapshot(docId)
      if (snapshot) {
        Y.applyUpdate(ydoc, snapshot.updateData)
      }

      const timer = setInterval(async () => {
        try {
          const stateVector = Y.encodeStateVector(ydoc)
          const updateData  = Y.encodeStateAsUpdate(ydoc)
          await repository.saveSnapshot(docId, stateVector, updateData)
          logger.info({ docId }, 'Y.js snapshot persisted')
        } catch (err) {
          logger.error({ err, docId }, 'Failed to persist Y.js snapshot')
        }
      }, SNAPSHOT_INTERVAL_MS)

      activeDocs.set(docId, { ydoc, timer })
    }

    const { ydoc } = activeDocs.get(docId)!

    // Basic Y.js sync: when client sends update, apply to ydoc
    wsConn.on('message', (message: ws.Data) => {
      try {
        const update = new Uint8Array(message as any)
        Y.applyUpdate(ydoc, update, wsConn)
      } catch (err) {
        logger.error({ err, docId }, 'Failed to apply Y.js update from client')
      }
    })

    // When ydoc updates, broadcast to all other clients for this doc
    const updateHandler = (update: Uint8Array, origin: any) => {
      if (origin !== wsConn && wsConn.readyState === 1) { // 1 = ws.OPEN
        wsConn.send(update)
      }
    }
    ydoc.on('update', updateHandler)

    // Initial sync: send current state to client
    wsConn.send(Y.encodeStateAsUpdate(ydoc))

    wsConn.on('close', () => {
      ydoc.off('update', updateHandler)
      const entry = activeDocs.get(docId)
      // In a real server we'd track client count per doc
      // For now, if no more connections in WSS, we can clean up (simplistic)
      if (entry && wss.clients.size === 0) {
        clearInterval(entry.timer)
        activeDocs.delete(docId)
      }
    })
  })
}
