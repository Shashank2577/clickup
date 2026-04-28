import { z } from 'zod'

const SidebarItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['space', 'list', 'doc', 'view', 'dashboard', 'folder']),
  visible: z.boolean(),
  pinned: z.boolean().optional().default(false),
  position: z.number().int().min(0),
})

export const SaveSidebarConfigSchema = z.object({
  workspaceId: z.string().min(1),
  items: z.array(SidebarItemSchema).max(500),
})

export type SidebarItem = z.infer<typeof SidebarItemSchema>
export type SaveSidebarConfigInput = z.infer<typeof SaveSidebarConfigSchema>
