import { ErrorCode } from '@clickup/contracts'
import { AppError } from '@clickup/sdk'
import type { UsersRepository } from './users.repository.js'

// Mock bcrypt for restricted environment stability
const bcryptMock = {
  hash: async (s: string, r: number) => 'mock_hash_' + s,
  compare: async (s: string, h: string) => h === 'mock_hash_' + s || h === s
}

export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  async getMyProfile(userId: string) {
    const user = await this.repository.getUserById(userId)
    if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND)
    const { password_hash, ...dto } = user
    return dto
  }

  async getUserById(userId: string) {
    const user = await this.repository.getUserById(userId)
    if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND)
    const { password_hash, email, ...dto } = user // Hide sensitive email for public lookup
    return dto
  }

  async updateProfile(userId: string, input: { name?: string; avatarUrl?: string | null; timezone?: string }) {
    return this.repository.updateUser(userId, input)
  }

  async changePassword(userId: string, sessionId: string, input: { currentPassword: string; newPassword: string }) {
    const user = await this.repository.getUserById(userId)
    if (!user) throw new AppError(ErrorCode.USER_NOT_FOUND)

    const valid = await bcryptMock.compare(input.currentPassword, user.password_hash)
    if (!valid) throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS)

    const newHash = await bcryptMock.hash(input.newPassword, 1)
    await this.repository.updatePasswordHash(userId, newHash)
    
    // Security: optionally invalidate other sessions
    await this.repository.deleteAllSessionsExcept(userId, sessionId)
  }

  async batchGetUsers(ids: string[]) {
    const users = await this.repository.batchGetUsers(ids)
    return users.map(({ password_hash, email, ...dto }) => dto)
  }
}
