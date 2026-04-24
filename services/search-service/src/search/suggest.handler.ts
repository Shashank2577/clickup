import { Request, Response } from 'express'
import { asyncHandler, AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { Client } from '@elastic/elasticsearch'
import { INDEX } from './elastic.client.js'

export function suggestHandler(elastic: Client) {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const q = req.query['q'] as string
    const workspaceId = req.query['workspaceId'] as string

    if (!q || q.length < 2) throw new AppError(ErrorCode.SEARCH_INVALID_QUERY, 'q must be at least 2 characters')
    if (!workspaceId) throw new AppError(ErrorCode.SEARCH_INVALID_QUERY, 'workspaceId is required')

    // Use prefix match on title field for autocomplete
    const results = await elastic.search({
      index: INDEX,
      size: 10,
      body: {
        query: {
          bool: {
            must: {
              match_phrase_prefix: {
                title: {
                  query: q,
                  max_expansions: 20,
                },
              },
            },
            filter: [
              { term: { workspaceId } },
            ],
          },
        },
        _source: ['id', 'title', 'type', 'listId', 'workspaceId'],
      },
    } as any)

    const suggestions = (results.hits.hits as any[]).map((hit: any) => ({
      id: hit._source.id,
      title: hit._source.title,
      type: hit._source.type,
      listId: hit._source.listId ?? null,
    }))

    res.json({ data: suggestions })
  })
}
