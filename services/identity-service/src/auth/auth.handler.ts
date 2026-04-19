import { Router } from 'express'
import type { Pool } from 'pg'
import { asyncHandler, validate, requireAuth } from '@clickup/sdk'
import { RegisterSchema, LoginSchema } from '@clickup/contracts'
import { AuthRepository } from './auth.repository.js'
import { AuthService } from './auth.service.js'

export function authRoutes(db: Pool): Router {
  const router = Router()
  const repository = new AuthRepository(db)
  const service = new AuthService(repository)

  router.post(
    '/register',
    asyncHandler(async (req, res) => {
      const body = validate(RegisterSchema, req.body)
      const result = await service.register(body)
      res.status(201).json({ data: result })
    }),
  )

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const body = validate(LoginSchema, req.body)
      const result = await service.login(body)
      res.json({ data: result })
    }),
  )

  router.post(
    '/logout',
    requireAuth,
    asyncHandler(async (req, res) => {
      await service.logout(req.auth.sessionId)
      res.status(204).end()
    }),
  )

  router.get(
    '/verify',
    requireAuth,
    asyncHandler(async (req, res) => {
      res.json({ data: req.auth })
    }),
  )

  router.post(
    '/refresh',
    requireAuth,
    asyncHandler(async (req, res) => {
      const result = await service.refresh(req.auth)
      res.json({ data: result })
    }),
  )

  return router
}
