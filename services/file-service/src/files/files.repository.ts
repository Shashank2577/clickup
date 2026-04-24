import { Pool } from 'pg'
import { File } from '@clickup/contracts'

export async function insertFile(db: Pool, record: {
  id: string
  workspaceId: string
  taskId: string | null
  name: string
  url: string
  sizeBytes: number
  mimeType: string
  uploadedBy: string
}): Promise<File> {
  const { rows } = await db.query(
    'INSERT INTO files (id, workspace_id, task_id, name, url, size_bytes, mime_type, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
    [record.id, record.workspaceId, record.taskId, record.name, record.url, record.sizeBytes, record.mimeType, record.uploadedBy]
  )
  const r = rows[0]
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    taskId: r.task_id,
    name: r.name,
    url: r.url,
    sizeBytes: parseInt(r.size_bytes, 10),
    mimeType: r.mime_type,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at
  }
}

export async function getFileById(db: Pool, fileId: string): Promise<File | null> {
  const { rows } = await db.query('SELECT * FROM files WHERE id = $1', [fileId])
  if (!rows[0]) return null
  const r = rows[0]
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    taskId: r.task_id,
    name: r.name,
    url: r.url,
    sizeBytes: parseInt(r.size_bytes, 10),
    mimeType: r.mime_type,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at
  }
}

export async function listFilesByTaskId(db: Pool, taskId: string): Promise<File[]> {
  const { rows } = await db.query('SELECT * FROM files WHERE task_id = $1 ORDER BY created_at DESC', [taskId])
  return rows.map(r => ({
    id: r.id,
    workspaceId: r.workspace_id,
    taskId: r.task_id,
    name: r.name,
    url: r.url,
    sizeBytes: parseInt(r.size_bytes, 10),
    mimeType: r.mime_type,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at
  }))
}

export async function deleteFileById(db: Pool, fileId: string): Promise<void> {
  await db.query('DELETE FROM files WHERE id = $1', [fileId])
}
