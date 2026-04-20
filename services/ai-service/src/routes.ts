import { Router } from 'express'
import { createBreakdownRouter }  from './capabilities/breakdown.handler.js'
import { createSummarizeRouter }  from './capabilities/summarize.handler.js'
import { createPrioritizeRouter } from './capabilities/prioritize.handler.js'
import { createDailyPlanRouter }  from './capabilities/daily-plan.handler.js'

export function routes(): Router {
  const router = Router()

  router.use(createBreakdownRouter())
  router.use(createSummarizeRouter())
  router.use(createPrioritizeRouter())
  router.use(createDailyPlanRouter())

  return router
}
