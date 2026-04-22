import { Request, Response } from 'express'
import { asyncHandler, validate } from '@clickup/sdk'
import {
  CreateGoalSchema,
  UpdateGoalSchema,
  CreateGoalTargetSchema,
  UpdateGoalTargetSchema,
} from '@clickup/contracts'
import { goalsService } from './goals.service.js'

export const createGoalHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = validate(CreateGoalSchema, req.body) as any
  const traceId = (req.headers['x-trace-id'] as string) || ''

  const goal = await goalsService.createGoal(
    input.workspaceId,
    input.name,
    input.description,
    input.dueDate,
    input.color,
    (req as any).auth!.userId,
    traceId
  )

  res.status(201).json({ data: goal })
})

export const getGoalHandler = asyncHandler(async (req: Request, res: Response) => {
  const goalId = req.params['goalId']!
  const traceId = (req.headers['x-trace-id'] as string) || ''

  const goal = await goalsService.getGoal(goalId, (req as any).auth!.userId, traceId)

  res.status(200).json({ data: goal })
})

export const getGoalsForWorkspaceHandler = asyncHandler(async (req: Request, res: Response) => {
  const workspaceId = req.params['workspaceId']!
  const traceId = (req.headers['x-trace-id'] as string) || ''

  const goals = await goalsService.getGoalsForWorkspace(workspaceId, (req as any).auth!.userId, traceId)

  res.status(200).json({ data: goals })
})

export const updateGoalHandler = asyncHandler(async (req: Request, res: Response) => {
  const goalId = req.params['goalId']!
  const input = validate(UpdateGoalSchema, req.body) as any
  const traceId = (req.headers['x-trace-id'] as string) || ''

  const updatedGoal = await goalsService.updateGoal(
    goalId,
    input,
    (req as any).auth!.userId,
    traceId
  )

  res.status(200).json({ data: updatedGoal })
})

export const deleteGoalHandler = asyncHandler(async (req: Request, res: Response) => {
  const goalId = req.params['goalId']!
  const traceId = (req.headers['x-trace-id'] as string) || ''

  await goalsService.deleteGoal(goalId, (req as any).auth!.userId, traceId)

  res.status(204).send()
})

export const addTargetHandler = asyncHandler(async (req: Request, res: Response) => {
  const goalId = req.params['goalId']!
  const input = validate(CreateGoalTargetSchema, req.body) as any
  const traceId = (req.headers['x-trace-id'] as string) || ''

  const target = await goalsService.addTarget(
    goalId,
    { ...input, type: input.type as any },
    (req as any).auth!.userId,
    traceId
  )

  res.status(201).json({ data: target })
})

export const updateTargetHandler = asyncHandler(async (req: Request, res: Response) => {
  const goalId = req.params['goalId']!
  const targetId = req.params['targetId']!
  const input = validate(UpdateGoalTargetSchema, req.body) as any
  const traceId = (req.headers['x-trace-id'] as string) || ''

  const updatedTarget = await goalsService.updateTarget(
    goalId,
    targetId,
    input,
    (req as any).auth!.userId,
    traceId
  )

  res.status(200).json({ data: updatedTarget })
})
