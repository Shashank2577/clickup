import { Router } from 'express'
import { createBreakdownRouter }        from './capabilities/breakdown.handler.js'
import { createSummarizeRouter }        from './capabilities/summarize.handler.js'
import { createPrioritizeRouter }       from './capabilities/prioritize.handler.js'
import { createDailyPlanRouter }        from './capabilities/daily-plan.handler.js'
import { createWritingAssistantRouter } from './capabilities/writing-assistant.handler.js'
import { createDocGenerationRouter }    from './capabilities/doc-generation.handler.js'
import { createMeetingNotesRouter }     from './capabilities/meeting-notes.handler.js'
import { createSmartTasksRouter }       from './capabilities/smart-tasks.handler.js'

export function routes(): Router {
  const router = Router()

  router.use(createBreakdownRouter())
  router.use(createSummarizeRouter())
  router.use(createPrioritizeRouter())
  router.use(createDailyPlanRouter())
  router.use(createWritingAssistantRouter())
  router.use(createDocGenerationRouter())
  router.use(createMeetingNotesRouter())
  router.use(createSmartTasksRouter())

  return router
}
