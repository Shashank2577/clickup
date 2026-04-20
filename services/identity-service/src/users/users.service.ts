import bcrypt from 'bcrypt'
import { ErrorCode } from '@clickup/contracts'
import { AppError, tier2Get, tier2Set, tier2Del, CacheKeys } from '@clickup/sdk'
import type { UsersRepository, UserRow } from './users.repository.js'

function toUserDto(user: Omit<UserRow, 'password_hash'>) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url,
    timezone: user.timezone,
    createdAt: user.created_at.toISOString(),
  }
}

export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  async getMyProfile(userId: string) {
    const cacheKey = CacheKeys.userProfile(userId)
    const cached = await tier2Get<ReturnType<typeof toUserDto>>(cacheKey)
    if (cached) return cached

    const user = await this.repository.getUserById(userId)
    if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND)

    const dto = toUserDto(user)
    await tier2Set(cacheKey, dto)
    return dto
  }

  async updateProfile(userId: string, input: { name?: string; avatarUrl?: string | null; timezone?: string }) {
    const user = await this.repository.updateUser(userId, input)
    await tier2Del(CacheKeys.userProfile(userId))
    return toUserDto(user)
  }

  async changePassword(
    userId: string,
    sessionId: string,
    input: { currentPassword: string; newPassword: string },
  ): Promise<void> {
    const user = await this.repository.getUserById(userId)
    if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND)

    const valid = await bcrypt.compare(input.currentPassword, user.password_hash)
    if (!valid) throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS)

    const newHash = await bcrypt.hash(input.newPassword, 12)
    await this.repository.updatePasswordHash(userId, newHash)
    // Invalidate all OTHER sessions (security: force re-login on other devices)
    await this.repository.deleteAllSessionsExcept(userId, sessionId)
    await tier2Del(CacheKeys.userProfile(userId))
  }

  async getUserById(id: string) {
    const user = await this.repository.getUserById(id)
    if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND)
    return toUserDto(user)
  }

  async batchGetUsers(ids: string[]) {
    if (ids.length > 100) throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Max 100 IDs per batch request')
    const rows = await this.repository.batchGetUsers(ids)
    return rows.map((r) => toUserDto(r))
  }
}
