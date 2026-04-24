import { Request, Response } from 'express'
import { asyncHandler, validate, AppError } from '@clickup/sdk'
import {
  CreateSprintSchema,
  UpdateSprintSchema,
  AddSprintTasksSchema,
} from '@clickup/contracts'
import { ErrorCode } from '@clickup/contracts'
import { sprintsRepository } from './sprints.repository.js'

// ─── helpers ────────────────────────────────────────────────

function requireSprint(sprint: unknown, id: string) {
  if (!sprint) throw new AppError(ErrorCode.SPRINT_NOT_FOUND, `Sprint ${id} not found`)
  return sprint as Record<string, unknown>
}

// ─── create sprint ──────────────────────────────────────────

export const createSprintHandler = asyncHandler(async (req: Request, res: Response) => {
  const listId = req.params['listId']!
  const userId = (req as any).auth!.userId
  const input = validate(CreateSprintSchema, req.body)

  const sprint = await sprintsRepository.createSprint(
    listId,
    input.name,
    input.goal,
    input.startDate,
    input.endDate,
    userId,
  )

  res.status(201).json({ data: sprint })
})

// ─── list sprints for a list ─────────────────────────────────

export const listSprintsHandler = asyncHandler(async (req: Request, res: Response) => {
  const listId = req.params['listId']!
  const sprints = await sprintsRepository.getSprintsForList(listId)
  res.status(200).json({ data: sprints })
})

// ─── get sprint details ──────────────────────────────────────

export const getSprintHandler = asyncHandler(async (req: Request, res: Response) => {
  const sprintId = req.params['sprintId']!
  const sprint = requireSprint(await sprintsRepository.getSprint(sprintId), sprintId)
  res.status(200).json({ data: sprint })
})

// ─── update sprint ───────────────────────────────────────────

export const updateSprintHandler = asyncHandler(async (req: Request, res: Response) => {
  const sprintId = req.params['sprintId']!
  // Verify sprint exists
  requireSprint(await sprintsRepository.getSprint(sprintId), sprintId)

  const input = validate(UpdateSprintSchema, req.body)
  const updated = await sprintsRepository.updateSprint(
    sprintId,
    input.name,
    input.goal,
    input.startDate,
    input.endDate,
  )

  res.status(200).json({ data: updated })
})

// ─── delete sprint ───────────────────────────────────────────

export const deleteSprintHandler = asyncHandler(async (req: Request, res: Response) => {
  const sprintId = req.params['sprintId']!
  requireSprint(await sprintsRepository.getSprint(sprintId), sprintId)
  await sprintsRepository.deleteSprint(sprintId)
  res.status(204).send()
})

// ─── start sprint (planning → active) ───────────────────────

export const startSprintHandler = asyncHandler(async (req: Request, res: Response) => {
  const sprintId = req.params['sprintId']!
  const sprint = requireSprint(await sprintsRepository.getSprint(sprintId), sprintId) as any

  if (sprint.status === 'active') {
    throw new AppError(ErrorCode.SPRINT_ALREADY_ACTIVE, 'Sprint is already active')
  }
  if (sprint.status === 'completed') {
    throw new AppError(ErrorCode.SPRINT_NOT_ACTIVE, 'Cannot start a completed sprint')
  }

  const updated = await sprintsRepository.setSprintStatus(sprintId, 'active')
  res.status(200).json({ data: updated })
})

// ─── complete sprint (active → completed) ───────────────────

export const completeSprintHandler = asyncHandler(async (req: Request, res: Response) => {
  const sprintId = req.params['sprintId']!
  const sprint = requireSprint(await sprintsRepository.getSprint(sprintId), sprintId) as any

  if (sprint.status !== 'active') {
    throw new AppError(ErrorCode.SPRINT_NOT_ACTIVE, 'Only active sprints can be completed')
  }

  // Compute velocity: completed sprint_points
  const stats = await sprintsRepository.getSprintStats(sprintId)
  const updated = await sprintsRepository.setSprintStatus(sprintId, 'completed', stats.completedPoints)
  res.status(200).json({ data: updated })
})

// ─── add tasks to sprint ─────────────────────────────────────

export const addSprintTasksHandler = asyncHandler(async (req: Request, res: Response) => {
  const sprintId = req.params['sprintId']!
  requireSprint(await sprintsRepository.getSprint(sprintId), sprintId)

  const input = validate(AddSprintTasksSchema, req.body)
  await sprintsRepository.addTasksToSprint(sprintId, input.taskIds)

  const updated = await sprintsRepository.getSprint(sprintId)
  res.status(200).json({ data: updated })
})

// ─── remove task from sprint ─────────────────────────────────

export const removeSprintTaskHandler = asyncHandler(async (req: Request, res: Response) => {
  const sprintId = req.params['sprintId']!
  const taskId = req.params['taskId']!
  requireSprint(await sprintsRepository.getSprint(sprintId), sprintId)
  await sprintsRepository.removeTaskFromSprint(sprintId, taskId)
  res.status(204).send()
})

// ─── sprint stats ─────────────────────────────────────────────

export const getSprintStatsHandler = asyncHandler(async (req: Request, res: Response) => {
  const sprintId = req.params['sprintId']!
  requireSprint(await sprintsRepository.getSprint(sprintId), sprintId)
  const stats = await sprintsRepository.getSprintStats(sprintId)
  res.status(200).json({ data: stats })
})
