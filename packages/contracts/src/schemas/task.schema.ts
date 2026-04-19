import { z } from 'zod'
import { TaskPriority, TaskRelationType } from '../types/enums.js'

const uuid = z.string().uuid()
const isoDate = z.string().datetime({ offset: true })

export const CreateTaskSchema = z.object({
  listId: uuid,
  parentId: uuid.optional(),
  title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
  description: z.string().max(50000).optional(),
  status: z.string().max(100).optional(),
  priority: z.nativeEnum(TaskPriority).optional().default(TaskPriority.None),
  assigneeId: uuid.optional(),
  dueDate: isoDate.optional(),
  startDate: isoDate.optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  sprintPoints: z.number().int().nonnegative().optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional().default([]),
})

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(50000).nullable().optional(),
  status: z.string().max(100).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assigneeId: uuid.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  startDate: isoDate.nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  sprintPoints: z.number().int().nonnegative().nullable().optional(),
})

export const MoveTaskSchema = z.object({
  listId: uuid,
  parentId: uuid.nullable().optional(),
  position: z.number().optional(),
})

export const AddTaskTagSchema = z.object({
  tag: z.string().min(1).max(50),
})

export const AddTaskRelationSchema = z.object({
  relatedTaskId: uuid,
  type: z.nativeEnum(TaskRelationType),
})

export const CreateChecklistSchema = z.object({
  title: z.string().min(1).max(200).optional().default('Checklist'),
})

export const CreateChecklistItemSchema = z.object({
  title: z.string().min(1).max(500),
  assigneeId: uuid.optional(),
  dueDate: isoDate.optional(),
})

export const UpdateChecklistItemSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  completed: z.boolean().optional(),
  assigneeId: uuid.nullable().optional(),
  dueDate: isoDate.nullable().optional(),
})

export const TaskListQuerySchema = z.object({
  listId: uuid,
  status: z.string().optional(),
  assigneeId: uuid.optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueBefore: isoDate.optional(),
  dueAfter: isoDate.optional(),
  tags: z.array(z.string()).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(50),
  includeSubtasks: z.coerce.boolean().optional().default(false),
})

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>
export type MoveTaskInput = z.infer<typeof MoveTaskSchema>
export type TaskListQuery = z.infer<typeof TaskListQuerySchema>
