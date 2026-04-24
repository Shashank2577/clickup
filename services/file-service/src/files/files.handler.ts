import { Request, Response } from 'express'
import multer from 'multer'
import crypto from 'crypto'
import { Pool } from 'pg'
import { 
  AppError, 
  asyncHandler, 
  createServiceClient, 
  publish, 
  logger 
} from '@clickup/sdk'
import { 
  ErrorCode, 
  FILE_EVENTS,
  FileUploadedEvent
} from '@clickup/contracts'
import { createMinioClient, uploadToMinio, getPresignedUrl, deleteFromMinio } from './minio.client.js'
import { insertFile, getFileById, listFilesByTaskId, deleteFileById } from './files.repository.js'

const BUCKET = process.env['MINIO_BUCKET'] || 'clickup-files'

const storage = multer.memoryStorage()
export const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
})

const ALLOWED_MIME_PREFIXES = ['image/', 'text/']
const ALLOWED_MIME_EXACT = ['application/pdf', 'application/zip']

function isAllowedMimeType(mimeType: string): boolean {
  return (
    ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix)) ||
    ALLOWED_MIME_EXACT.includes(mimeType)
  )
}

function getMinioKey(storedUrl: string): string {
  return (storedUrl.split('/' + BUCKET + '/')[1]) as string
}

export function uploadFile(db: Pool) {
  const minio = createMinioClient()
  const identityUrl = process.env['IDENTITY_SERVICE_URL'] || 'http://localhost:3001'

  return asyncHandler(async (req: Request, res: Response) => {
    const file = req.file
    const { workspaceId, taskId } = req.body

    if (!workspaceId || !file) {
      throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT)
    }

    if (file.size > 50 * 1024 * 1024) {
      throw new AppError(ErrorCode.FILE_TOO_LARGE)
    }

    if (!isAllowedMimeType(file.mimetype)) {
      throw new AppError(ErrorCode.FILE_TYPE_NOT_ALLOWED)
    }

    const identityClient = createServiceClient(identityUrl, { traceId: req.headers['x-trace-id'] as string }) as any
    const { data: member } = await identityClient.get('/api/v1/workspaces/' + workspaceId + '/members/' + req.auth!.userId)
    if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

    const fileId = crypto.randomUUID()
    const key = workspaceId + '/' + fileId + '/' + file.originalname
    
    const url = await uploadToMinio(minio, key, file.buffer, file.mimetype)
    
    const record = await insertFile(db, {
      id: fileId,
      workspaceId,
      taskId: taskId || null,
      name: file.originalname,
      url,
      sizeBytes: file.size,
      mimeType: file.mimetype,
      uploadedBy: req.auth!.userId
    })

    await publish(FILE_EVENTS.UPLOADED as any, {
      fileId: record.id,
      workspaceId: record.workspaceId,
      taskId: record.taskId,
      name: record.name,
      sizeBytes: record.sizeBytes,
      mimeType: record.mimeType,
      uploadedBy: record.uploadedBy,
      occurredAt: new Date().toISOString(),
    } as FileUploadedEvent)

    const presignedUrl = await getPresignedUrl(minio, key)
    res.status(201).json({ data: { ...record, url: presignedUrl } })
  })
}

export function getFile(db: Pool) {
  const minio = createMinioClient()
  const identityUrl = process.env['IDENTITY_SERVICE_URL'] || 'http://localhost:3001'

  return asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params
    const record = await getFileById(db, fileId!)
    if (!record) throw new AppError(ErrorCode.FILE_NOT_FOUND)

    const identityClient = createServiceClient(identityUrl, { traceId: req.headers['x-trace-id'] as string }) as any
    const { data: member } = await identityClient.get('/api/v1/workspaces/' + record.workspaceId + '/members/' + req.auth!.userId)
    if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

    const key = getMinioKey(record.url)
    const presignedUrl = await getPresignedUrl(minio, key)
    res.json({ data: { ...record, url: presignedUrl } })
  })
}

export function deleteFile(db: Pool) {
  const minio = createMinioClient()
  const identityUrl = process.env['IDENTITY_SERVICE_URL'] || 'http://localhost:3001'

  return asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params
    const record = await getFileById(db, fileId!)
    if (!record) throw new AppError(ErrorCode.FILE_NOT_FOUND)

    const identityClient = createServiceClient(identityUrl, { traceId: req.headers['x-trace-id'] as string }) as any
    const { data: member } = await identityClient.get('/api/v1/workspaces/' + record.workspaceId + '/members/' + req.auth!.userId)
    if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

    const canDelete = record.uploadedBy === req.auth!.userId || ['owner', 'admin'].includes(member.role || member.data?.role)
    if (!canDelete) throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)

    const key = getMinioKey(record.url)
    await deleteFromMinio(minio, key)
    await deleteFileById(db, fileId!)

    await publish(FILE_EVENTS.DELETED as any, {
      fileId: record.id,
      workspaceId: record.workspaceId,
      taskId: record.taskId,
      deletedBy: req.auth!.userId,
      occurredAt: new Date().toISOString(),
    } as any)

    res.status(204).end()
  })
}

export function listTaskFiles(db: Pool) {
  const minio = createMinioClient()
  const identityUrl = process.env['IDENTITY_SERVICE_URL'] || 'http://localhost:3001'

  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { taskId } = req.params
    const records = await listFilesByTaskId(db, taskId!)
    if (records.length === 0) {
      res.json({ data: [] })
      return
    }

    const firstRecord = records[0] as any
    const identityClient = createServiceClient(identityUrl, { traceId: req.headers['x-trace-id'] as string }) as any
    const { data: member } = await identityClient.get('/api/v1/workspaces/' + firstRecord.workspaceId + '/members/' + req.auth!.userId)
    if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)

    const data = await Promise.all(records.map(async (r) => {
      const key = getMinioKey(r.url)
      const presignedUrl = await getPresignedUrl(minio, key)
      return { ...r, url: presignedUrl }
    }))

    res.json({ data })
  })
}
