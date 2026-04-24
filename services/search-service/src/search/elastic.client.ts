import { Client } from '@elastic/elasticsearch'
import { logger } from '@clickup/sdk'

export const INDEX = 'clickup_tasks'

export function createElasticClient(): Client {
  return new Client({
    node: process.env['ELASTICSEARCH_URL'] || 'http://localhost:9200',
  })
}

export async function ensureIndex(client: Client): Promise<void> {
  const exists = await client.indices.exists({ index: INDEX })
  if (exists) {
    logger.info({ index: INDEX }, 'ES index already exists — skipping creation')
    return
  }

  await client.indices.create({
    index: INDEX,
    body: {
      mappings: {
        properties: {
          id:          { type: 'keyword' },
          type:        { type: 'keyword' },
          workspaceId: { type: 'keyword' },
          listId:      { type: 'keyword' },
          title:       { type: 'text', analyzer: 'standard' },
          description: { type: 'text', analyzer: 'standard' },
          status:      { type: 'keyword' },
          priority:    { type: 'keyword' },
          assigneeId:  { type: 'keyword' },
          createdBy:   { type: 'keyword' },
          createdAt:   { type: 'date' },
          updatedAt:   { type: 'date' },
          tags:        { type: 'keyword' },
        },
      },
    },
  })

  logger.info({ index: INDEX }, 'ES index created')
}
