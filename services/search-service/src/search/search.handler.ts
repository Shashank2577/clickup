import { Request, Response } from 'express'
import { z } from 'zod'
import { asyncHandler, AppError } from '@clickup/sdk'
import { ErrorCode } from '@clickup/contracts'
import { Client } from '@elastic/elasticsearch'
import { INDEX } from './elastic.client.js'

const SearchQuerySchema = z.object({
  q:           z.string().min(1).max(200),
  workspaceId: z.string().uuid(),
  types:       z.array(z.enum(['task', 'comment'])).optional(),
  listId:      z.string().uuid().optional(),
  page:        z.number().int().min(1).default(1),
  pageSize:    z.number().int().min(1).max(50).default(20),
})

export interface SearchResult {
  id:          string
  type:        string
  title:       string
  snippet:     string
  workspaceId: string
  listId:      string | null
  createdAt:   string
}

export function searchHandler(elastic: Client) {
  return async (req: Request, res: Response): Promise<void> => {
    const parseResult = SearchQuerySchema.safeParse({
      q:           req.query['q'],
      workspaceId: req.query['workspaceId'],
      types:       req.query['types']
        ? String(req.query['types']).split(',')
        : undefined,
      listId:      req.query['listId'],
      page:        req.query['page']     ? Number(req.query['page'])     : 1,
      pageSize:    req.query['pageSize'] ? Number(req.query['pageSize']) : 20,
    })

    if (!parseResult.success) {
      throw new AppError(ErrorCode.SEARCH_INVALID_QUERY)
    }

    const { q, workspaceId, types, listId, page, pageSize } = parseResult.data

    const filters: any[] = [
      { term: { workspaceId } },
    ]
    if (types && types.length > 0) {
      filters.push({ terms: { type: types } })
    }
    if (listId) {
      filters.push({ term: { listId } })
    }

    const esQuery = {
      bool: {
        must: {
          multi_match: {
            query:  q,
            fields: ['title^2', 'description'],
            type:   'best_fields',
            fuzziness: 'AUTO',
          },
        },
        filter: filters,
      },
    }

    let esResponse: any
    try {
      esResponse = await elastic.search({
        index: INDEX,
        from:  (page - 1) * pageSize,
        size:  pageSize,
        body: {
          query: esQuery,
          highlight: {
            fields: {
              title:       { number_of_fragments: 1, fragment_size: 200 },
              description: { number_of_fragments: 1, fragment_size: 200 },
            },
            pre_tags:  [''],
            post_tags: [''],
          },
        },
      } as any)
    } catch (err) {
      throw new AppError(ErrorCode.SEARCH_UNAVAILABLE)
    }

    const hits = esResponse.hits.hits
    const total = typeof esResponse.hits.total === 'number'
      ? esResponse.hits.total
      : (esResponse.hits.total as any).value

    const data: SearchResult[] = hits.map((hit: any) => {
      const src = hit._source as Record<string, unknown>
      const highlights = (hit.highlight ?? {}) as Record<string, string[]>

      const snippet: string =
        highlights['description']?.[0] ||
        highlights['title']?.[0] ||
        (typeof src['description'] === 'string'
          ? (src['description'] as string).slice(0, 200)
          : '')

      return {
        id:          String(src['id'] || hit._id),
        type:        String(src['type'] || 'task'),
        title:       String(src['title'] || ''),
        snippet,
        workspaceId: String(src['workspaceId'] || ''),
        listId:      src['listId'] != null ? String(src['listId']) : null,
        createdAt:   String(src['createdAt'] || ''),
      }
    })

    res.json({ data, total, page, pageSize })
  }
}
