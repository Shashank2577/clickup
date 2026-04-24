import { Router } from 'express'
import { asyncHandler, requireAuth } from '@clickup/sdk'
import { Client } from '@elastic/elasticsearch'
import { searchHandler } from './search/search.handler.js'
import { suggestHandler } from './search/suggest.handler.js'

export function createRouter(elastic: Client): Router {
  const router = Router()

  router.get(
    '/',
    requireAuth,
    asyncHandler(searchHandler(elastic)),
  )

  router.get('/suggest', requireAuth, suggestHandler(elastic))

  return router
}
