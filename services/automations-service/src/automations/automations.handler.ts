import { Request, Response } from 'express'
import { Pool } from 'pg'
import { 
  validate,
  asyncHandler
} from '@clickup/sdk'
import pkg from '@clickup/contracts'
const { CreateAutomationSchema, UpdateAutomationSchema } = pkg
import { createAutomationsService } from './automations.service.js'

export function createAutomationHandler(db: Pool) {
  const service = createAutomationsService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const input = validate(CreateAutomationSchema, req.body) as any
    const automation = await service.createAutomation(req.auth!.userId, input, req.headers['x-trace-id'] as string)
    res.status(201).json({ data: automation })
  })
}

export function listAutomationsHandler(db: Pool) {
  const service = createAutomationsService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { workspaceId } = req.params
    const automations = await service.listAutomations(req.auth!.userId, workspaceId!, req.headers['x-trace-id'] as string)
    res.json({ data: automations })
  })
}

export function getAutomationHandler(db: Pool) {
  const service = createAutomationsService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { automationId } = req.params
    const automation = await service.getAutomation(req.auth!.userId, automationId!, req.headers['x-trace-id'] as string)
    res.json({ data: automation })
  })
}

export function updateAutomationHandler(db: Pool) {
  const service = createAutomationsService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { automationId } = req.params
    const updates = validate(UpdateAutomationSchema, req.body) as any
    const automation = await service.updateAutomation(req.auth!.userId, automationId!, updates, req.headers['x-trace-id'] as string)
    res.json({ data: automation })
  })
}

export function deleteAutomationHandler(db: Pool) {
  const service = createAutomationsService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { automationId } = req.params
    await service.deleteAutomation(req.auth!.userId, automationId!, req.headers['x-trace-id'] as string)
    res.status(204).end()
  })
}

export function listRunsHandler(db: Pool) {
  const service = createAutomationsService(db)
  return asyncHandler(async (req: Request, res: Response) => {
    const { automationId } = req.params
    const page = Number(req.query['page'] || 1)
    const pageSize = Number(req.query['pageSize'] || 50)
    const result = await service.listRuns(req.auth!.userId, automationId!, page, pageSize, req.headers['x-trace-id'] as string)
    res.json(result)
  })
}
