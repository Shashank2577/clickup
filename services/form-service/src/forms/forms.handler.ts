import { Request, Response } from 'express'
import { asyncHandler, validate, AppError } from '@clickup/sdk'
import {
  ErrorCode,
  CreateFormSchema,
  UpdateFormSchema,
  SubmitFormResponseSchema,
} from '@clickup/contracts'
import { FormsRepository } from './forms.repository.js'

// ============================================================
// Forms Handlers
// ============================================================

export function createFormsHandlers(repo: FormsRepository) {

  const createForm = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth!.userId as string
    const input = validate(CreateFormSchema, req.body) as {
      title: string
      description?: string
      listId: string
      fields: unknown[]
    }

    // Derive workspaceId from list — for now require it in query
    const workspaceId = req.query['workspaceId'] as string
    if (!workspaceId) {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'workspaceId query param required')
    }

    const isMember = await repo.isWorkspaceMember(workspaceId, userId)
    if (!isMember) {
      throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    }

    const form = await repo.createForm({
      workspaceId,
      listId: input.listId,
      title: input.title,
      description: input.description,
      fields: input.fields,
      createdBy: userId,
    })

    res.status(201).json({ data: form })
  })

  const listForms = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth!.userId as string
    const workspaceId = req.query['workspaceId'] as string
    if (!workspaceId) {
      throw new AppError(ErrorCode.VALIDATION_MISSING_FIELD, 'workspaceId query param required')
    }

    const isMember = await repo.isWorkspaceMember(workspaceId, userId)
    if (!isMember) {
      throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    }

    const forms = await repo.listForms(workspaceId)
    res.status(200).json({ data: forms })
  })

  const getForm = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as { id: string }
    const form = await repo.getForm(id)
    if (!form) {
      throw new AppError(ErrorCode.FORM_NOT_FOUND)
    }
    res.status(200).json({ data: form })
  })

  const updateForm = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth!.userId as string
    const { id } = req.params as { id: string }

    const existing = await repo.getForm(id)
    if (!existing) {
      throw new AppError(ErrorCode.FORM_NOT_FOUND)
    }

    // Only the creator can update
    if (existing.createdBy !== userId) {
      throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)
    }

    const input = validate(UpdateFormSchema, req.body) as {
      title?: string
      description?: string
      fields?: unknown[]
      isActive?: boolean
    }

    const updated = await repo.updateForm(id, {
      title: input.title,
      description: input.description,
      fields: input.fields,
      isActive: input.isActive,
    })

    res.status(200).json({ data: updated })
  })

  const deleteForm = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth!.userId as string
    const { id } = req.params as { id: string }

    const existing = await repo.getForm(id)
    if (!existing) {
      throw new AppError(ErrorCode.FORM_NOT_FOUND)
    }

    if (existing.createdBy !== userId) {
      throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)
    }

    await repo.deleteForm(id)
    res.status(204).send()
  })

  // ============================================================
  // Form responses — submit and list
  // ============================================================

  const submitResponse = asyncHandler(async (req: Request, res: Response) => {
    const { id: formId } = req.params as { id: string }

    const form = await repo.getForm(formId)
    if (!form) {
      throw new AppError(ErrorCode.FORM_NOT_FOUND)
    }
    if (!form.isActive) {
      throw new AppError(ErrorCode.FORM_INACTIVE)
    }

    const input = validate(SubmitFormResponseSchema, req.body) as {
      data: Record<string, unknown>
      submittedBy?: string
    }

    // Create a task from the form response
    const taskId = await repo.createTaskFromResponse(
      form.listId,
      input.data,
      form.fields as Array<{ id: string; taskField?: string; label: string }>,
      form.createdBy, // The form creator is used as the task creator
    )

    const response = await repo.submitResponse({
      formId,
      taskId,
      data: input.data,
      submittedBy: input.submittedBy,
    })

    res.status(201).json({ data: response })
  })

  const listResponses = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).auth!.userId as string
    const { id: formId } = req.params as { id: string }

    const form = await repo.getForm(formId)
    if (!form) {
      throw new AppError(ErrorCode.FORM_NOT_FOUND)
    }

    // Verify membership
    const isMember = await repo.isWorkspaceMember(form.workspaceId, userId)
    if (!isMember) {
      throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    }

    const limit = Math.min(Number(req.query['limit'] ?? 50), 100)
    const offset = Math.max(Number(req.query['offset'] ?? 0), 0)

    const { responses, total } = await repo.listResponses(formId, limit, offset)
    res.status(200).json({ data: responses, total })
  })

  return {
    createForm,
    listForms,
    getForm,
    updateForm,
    deleteForm,
    submitResponse,
    listResponses,
  }
}
