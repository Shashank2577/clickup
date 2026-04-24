import express from 'express'
import { Pool } from 'pg'
import { httpLogger, correlationId, errorHandler, logger, createHealthHandler } from '@clickup/sdk'
import { createMinioClient } from './files/minio.client.js'
import { CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import { createRouter } from './routes.js'

const SERVICE_NAME = process.env['SERVICE_NAME'] || 'file-service'
const PORT = parseInt(process.env['PORT'] || '3005', 10)

const db = new Pool({
  host: process.env['POSTGRES_HOST'] || 'localhost',
  port: parseInt(process.env['POSTGRES_PORT'] || '5432', 10),
  database: process.env['POSTGRES_DB'] || 'clickup',
  user: process.env['POSTGRES_USER'] || 'clickup',
  password: process.env['POSTGRES_PASSWORD'] || 'clickup_dev',
})

async function ensureMinioBucket(): Promise<void> {
  const minio = createMinioClient()
  const bucket = process.env['MINIO_BUCKET'] || 'clickup-files'
  try {
    await minio.send(new HeadBucketCommand({ Bucket: bucket }))
    logger.info({ bucket }, 'MinIO bucket exists')
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      await minio.send(new CreateBucketCommand({ Bucket: bucket }))
      logger.info({ bucket }, 'MinIO bucket created')
    } else {
      throw err
    }
  }
}

async function bootstrap(): Promise<void> {
  await db.query('SELECT 1')
  logger.info('Connected to PostgreSQL')

  await ensureMinioBucket()

  const app = express()
  app.use(httpLogger)
  app.use(correlationId)
  app.use(express.json({ limit: '1mb' }))

  app.get('/health', createHealthHandler(db))
  app.use('/', createRouter(db))
  app.use(errorHandler)

  app.listen(PORT, () => {
    logger.info({ service: SERVICE_NAME, port: PORT }, 'Service started')
  })
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal bootstrap error')
  process.exit(1)
})
