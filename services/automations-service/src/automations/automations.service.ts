import { Pool } from 'pg'
import { 
  AppError, 
  createServiceClient, 
  logger 
} from '@clickup/sdk'
import { 
  ErrorCode, 
  AutomationTriggerType,
  AutomationActionType
} from '@clickup/contracts'
import { AutomationsRepository } from './automations.repository.js'

export class AutomationsService {
  private identityUrl = process.env['IDENTITY_SERVICE_URL'] || 'http://localhost:3001'

  constructor(private readonly repository: AutomationsRepository) {}

  private getIdentityClient(traceId?: string) {
    const options: { traceId?: string } = {}
    if (traceId) options.traceId = traceId
    return createServiceClient(this.identityUrl, options) as any
  }

  private async verifyMembership(workspaceId: string, userId: string, traceId?: string) {
    const client = this.getIdentityClient(traceId)
    try {
      const response = await client.get('/api/v1/workspaces/' + workspaceId + '/members/' + userId)
      const member = response.data?.data || response.data
      if (!member) throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
      return member
    } catch (err: any) {
      if (err instanceof AppError) throw err
      throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED)
    }
  }

  async createAutomation(userId: string, input: any, traceId?: string) {
    await this.verifyMembership(input.workspaceId, userId, traceId)

    const automation = await this.repository.createAutomation({
      ...input,
      createdBy: userId
    })

    return automation
  }

  async listAutomations(userId: string, workspaceId: string, traceId?: string) {
    await this.verifyMembership(workspaceId, userId, traceId)
    return this.repository.findByWorkspace(workspaceId)
  }

  async getAutomation(userId: string, id: string, traceId?: string) {
    const automation = await this.repository.findById(id)
    if (!automation) throw new AppError(ErrorCode.AUTOMATION_NOT_FOUND)

    await this.verifyMembership(automation.workspace_id, userId, traceId)
    return automation
  }

  async updateAutomation(userId: string, id: string, updates: any, traceId?: string) {
    const automation = await this.repository.findById(id)
    if (!automation) throw new AppError(ErrorCode.AUTOMATION_NOT_FOUND)

    await this.verifyMembership(automation.workspace_id, userId, traceId)
    return this.repository.updateAutomation(id, updates)
  }

  async deleteAutomation(userId: string, id: string, traceId?: string) {
    const automation = await this.repository.findById(id)
    if (!automation) throw new AppError(ErrorCode.AUTOMATION_NOT_FOUND)

    const member = await this.verifyMembership(automation.workspace_id, userId, traceId)
    if (!['owner', 'admin'].includes(member.role || member.data?.role)) {
      throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION)
    }

    await this.repository.deleteAutomation(id)
  }

  async listRuns(userId: string, id: string, page: number, pageSize: number, traceId?: string) {
    const automation = await this.repository.findById(id)
    if (!automation) throw new AppError(ErrorCode.AUTOMATION_NOT_FOUND)

    await this.verifyMembership(automation.workspace_id, userId, traceId)
    
    const runs = await this.repository.listRuns(id, pageSize, (page - 1) * pageSize)
    const total = await this.repository.countRuns(id)

    return {
      data: runs,
      total,
      page,
      pageSize,
    }
  }
}

export const createAutomationsService = (db: Pool) => new AutomationsService(new AutomationsRepository(db))
