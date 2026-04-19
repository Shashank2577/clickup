import { Router } from 'express'
import type { Pool } from 'pg'
import { requireAuth, asyncHandler, validate } from '@clickup/sdk'
import { UpdateProfileSchema, ChangePasswordSchema, BatchGetUsersSchema } from '@clickup/contracts'
import { UsersRepository } from './users.repository.js'
import { UsersService } from './users.service.js'

export function usersRoutes(db: Pool): Router {
  const router = Router()
  const repository = new UsersRepository(db)
  const service = new UsersService(repository)

  // GET /users/me
  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await service.getMyProfile(req.auth.userId)
      res.json({ data: user })
    }),
  )

  // PATCH /users/me
  router.patch(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const input = validate(UpdateProfileSchema, req.body)
      const user = await service.updateProfile(req.auth.userId, input)
      res.json({ data: user })
    }),
  )

  // POST /users/me/change-password
  router.post(
    '/me/change-password',
    requireAuth,
    asyncHandler(async (req, res) => {
      const input = validate(ChangePasswordSchema, req.body)
      await service.changePassword(req.auth.userId, req.auth.sessionId, input)
      res.status(204).end()
    }),
  )

  // POST /users/batch
  router.post(
    '/batch',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { ids } = validate(BatchGetUsersSchema, req.body)
      const users = await service.batchGetUsers(ids)
      res.json({ data: users })
    }),
  )

  // GET /users/:userId — must be LAST to avoid shadowing /me and /batch
  router.get(
    '/:userId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await service.getUserById(req.params['userId']!)
      res.json({ data: user })
    }),
  )

  return router
}
