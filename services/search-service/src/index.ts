import express from 'express'
import { httpLogger, correlationId, errorHandler, logger } from '@clickup/sdk'
import { createElasticClient, ensureIndex } from './search/elastic.client.js'
import { startSearchIndexers } from './search/search.indexer.js'
import { createRouter } from './routes.js'

const SERVICE_NAME = process.env['SERVICE_NAME'] || 'search-service'
const PORT = parseInt(process.env['PORT'] || '3008', 10)

async function bootstrap(): Promise<void> {
  const elastic = createElasticClient()
  await ensureIndex(elastic)
  await startSearchIndexers(elastic)

  const app = express()
  app.use(httpLogger)
  app.use(correlationId)
  app.use(express.json({ limit: '1mb' }))

  app.get('/health', async (req, res) => {
    let esStatus: 'ok' | 'error' = 'ok'
    try {
      await elastic.ping()
    } catch {
      esStatus = 'error'
    }
    res.json({
      status: esStatus === 'ok' ? 'ok' : 'degraded',
      checks: { elasticsearch: esStatus }
    })
  })

  app.use('/', createRouter(elastic))
  app.use(errorHandler)

  app.listen(PORT, () => {
    logger.info({ service: SERVICE_NAME, port: PORT }, 'Service started')
  })
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal bootstrap error')
  process.exit(1)
})
