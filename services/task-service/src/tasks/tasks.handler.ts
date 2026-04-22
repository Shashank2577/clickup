import { Router, Request, Response } from 'express'
import { asyncHandler, requireAuth, validate } from '@clickup/sdk'
import { CreateTaskSchema, UpdateTaskSchema } from '@clickup/contracts'
import { TasksService } from './tasks.service.js'

export function createTasksRouter(service: TasksService): Router {
  const router = Router()

  router.post('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const input = validate(CreateTaskSchema, req.body) as any
    const task = await service.createTask(input, (req as any).user!.id)
    res.status(201).json({ data: task })
  }))

  router.get('/:taskId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const task = await service.getTask(req.params['taskId']!, (req as any).user!.id)
    res.json({ data: task })
  }))

  router.patch('/:taskId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const input = validate(UpdateTaskSchema, req.body) as any
    const task = await service.updateTask(req.params['taskId']!, input, (req as any).user!.id)
    res.json({ data: task })
  }))

  router.delete('/:taskId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    await service.deleteTask(req.params['taskId']!, (req as any).user!.id)
    res.status(204).send()
  }))

  return router
}
