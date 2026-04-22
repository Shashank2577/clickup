# Work Order — Goal Service: Core CRUD
**Wave:** 2
**Session ID:** WO-040
**Depends on:** WO-001 (identity-service merged), WO-009 (test-helpers merged)
**Branch name:** `wave2/goal-core`
**Estimated time:** 2 hours

---

## 1. Mission

Build the Goal Service: a standalone microservice that owns workspace-level goals
and their measurable targets. Goals are the OKR-style tracking layer of the
platform — each goal has one or more typed targets (number, currency, boolean,
or task-linked), and overall progress is computed as the average of all target
progress percentages.

This WO implements full CRUD for goals and targets, progress computation, Redis
caching on the hot GET paths, and all NATS event publishing. It does NOT implement
goal-to-task linking automation (Wave 3) or goal roll-ups across spaces (Wave 3).

---

## 2. Context: How This Service Fits

```
Client
  → API Gateway (:3000)
    → goal-service (:3009)
      → PostgreSQL (tables: goals, goal_targets — already exist, DO NOT create)
      → identity-service (:3001) HTTP: verify workspace membership + ownership
      ↘ NATS publishes:
          goal.created           (after insert)
          goal.updated           (after patch)
          goal.deleted           (after soft-delete)
          goal.progress_updated  (after any target current_value change)
      ← NATS subscribes: none in Wave 2

Progress computation (done in-service, not in DB):
  - number / currency target:  min((current_value / target_value) * 100, 100)
  - boolean target:            current_value === 1 ? 100 : 0
  - task target:               resolved via task-service HTTP call → completed? 100 : 0
  - Goal overall progress:     average of all target progress values (0 if no targets)

Cache policy (tier2 = 5-minute TTL):
  - CacheKeys.goal(goalId)          → single goal + targets + progress
  - CacheKeys.goalList(workspaceId) → list of goals for workspace
  - Invalidate both on any write that touches that goal
```

---

## 3. Repository Setup

```bash
cp -r services/_template services/goal-service
cd services/goal-service

# In package.json change:
# "name": "@clickup/goal-service"

cp .env.example .env
# Edit: SERVICE_NAME=goal-service
# Edit: PORT=3009
# Edit: IDENTITY_SERVICE_URL=http://localhost:3001
# Edit: TASK_SERVICE_URL=http://localhost:3002
```

No additional npm dependencies required — all needed packages come from
`@clickup/sdk` (which re-exports `pg`, `redis`, `express`, etc.).

---

## 4. Files to Create

```
services/goal-service/
├── src/
│   ├── index.ts                        [copy _template, SERVICE_NAME=goal-service, PORT=3009]
│   ├── routes.ts                       [register all goal + target routes]
│   ├── goals/
│   │   ├── goals.handler.ts            [HTTP handlers — no SQL, no business logic]
│   │   ├── goals.service.ts            [business logic, progress compute, cache, events]
│   │   ├── goals.repository.ts         [all DB queries — no business logic here]
│   │   └── goals.queries.ts            [SQL string constants only]
│   └── targets/
│       ├── targets.handler.ts          [HTTP handlers for target endpoints]
│       ├── targets.service.ts          [target business logic + progress_updated event]
│       └── targets.repository.ts      [all target DB queries]
├── tests/
│   ├── unit/
│   │   ├── goals.service.test.ts       [mock repository, test progress logic in isolation]
│   │   └── targets.service.test.ts     [mock repository, test target progress logic]
│   └── integration/
│       ├── goals.handler.test.ts       [real DB via withRollback(), test HTTP layer]
│       └── targets.handler.test.ts     [real DB via withRollback(), test target HTTP layer]
├── package.json                        [name: @clickup/goal-service]
├── tsconfig.json                       [extend ../../tsconfig.base.json]
└── .env.example
```

---

## 5. Implementation

### 5.1 SQL Queries (`src/goals/goals.queries.ts`)

```typescript
// src/goals/goals.queries.ts
// ALL SQL for the goals domain lives here.
// Repository files import these constants — never write SQL inline in repositories.

export const GoalQueries = {
  /**
   * Insert a new goal row.
   * Returns the full row for immediate use (avoids a second SELECT).
   */
  INSERT_GOAL: `
    INSERT INTO goals (workspace_id, name, description, due_date, owner_id, color)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      id, workspace_id, name, description,
      due_date, owner_id, color,
      created_at, updated_at, deleted_at
  `,

  /**
   * List all non-deleted goals for a workspace, newest first.
   * Progress is computed in the service layer, not here.
   */
  LIST_GOALS_BY_WORKSPACE: `
    SELECT
      id, workspace_id, name, description,
      due_date, owner_id, color,
      created_at, updated_at
    FROM goals
    WHERE workspace_id = $1
      AND deleted_at IS NULL
    ORDER BY created_at DESC
  `,

  /**
   * Fetch a single goal by ID (including soft-deleted check).
   */
  GET_GOAL_BY_ID: `
    SELECT
      id, workspace_id, name, description,
      due_date, owner_id, color,
      created_at, updated_at, deleted_at
    FROM goals
    WHERE id = $1
      AND deleted_at IS NULL
  `,

  /**
   * Update mutable goal fields.
   * Only sets columns whose new values are provided — all five are optional.
   * Uses COALESCE so omitted fields retain their current DB values.
   */
  UPDATE_GOAL: `
    UPDATE goals
    SET
      name        = COALESCE($2, name),
      description = COALESCE($3, description),
      due_date    = COALESCE($4, due_date),
      color       = COALESCE($5, color),
      owner_id    = COALESCE($6, owner_id),
      updated_at  = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING
      id, workspace_id, name, description,
      due_date, owner_id, color,
      created_at, updated_at
  `,

  /**
   * Soft-delete a goal. Cascades to goal_targets via FK ON DELETE CASCADE,
   * but since goal_targets has no deleted_at, they are hard-deleted by Postgres.
   * The service layer must publish goal.deleted AFTER this write completes.
   */
  SOFT_DELETE_GOAL: `
    UPDATE goals
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = $1
      AND deleted_at IS NULL
    RETURNING id, workspace_id
  `,

  /**
   * Insert a target row for a goal.
   */
  INSERT_TARGET: `
    INSERT INTO goal_targets (goal_id, name, type, target_value, current_value, task_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      id, goal_id, name, type,
      target_value, current_value, task_id,
      created_at, updated_at
  `,

  /**
   * Fetch all targets for a given goal, ordered by insertion time.
   */
  LIST_TARGETS_BY_GOAL: `
    SELECT
      id, goal_id, name, type,
      target_value, current_value, task_id,
      created_at, updated_at
    FROM goal_targets
    WHERE goal_id = $1
    ORDER BY created_at ASC
  `,

  /**
   * Fetch a single target row by ID.
   */
  GET_TARGET_BY_ID: `
    SELECT
      id, goal_id, name, type,
      target_value, current_value, task_id,
      created_at, updated_at
    FROM goal_targets
    WHERE id = $1
  `,

  /**
   * Update mutable target fields.
   * current_value change triggers goal.progress_updated event in service layer.
   */
  UPDATE_TARGET: `
    UPDATE goal_targets
    SET
      name          = COALESCE($2, name),
      current_value = COALESCE($3, current_value),
      target_value  = COALESCE($4, target_value),
      updated_at    = NOW()
    WHERE id = $1
    RETURNING
      id, goal_id, name, type,
      target_value, current_value, task_id,
      created_at, updated_at
  `,

  /**
   * Hard-delete a single target row (no soft-delete on targets).
   * Returns the deleted goal_id so the service can recompute + emit progress event.
   */
  DELETE_TARGET: `
    DELETE FROM goal_targets
    WHERE id = $1
    RETURNING id, goal_id
  `,
} as const
```

### 5.2 Goals Repository (`src/goals/goals.repository.ts`)

```typescript
// src/goals/goals.repository.ts
// Pure DB access layer. No business logic, no AppError, no event publishing.
// All SQL comes from goals.queries.ts.

import { getDb } from '@clickup/sdk'
import type { Goal, GoalTarget, CreateGoalInput, UpdateGoalInput } from '@clickup/contracts'
import { GoalQueries } from './goals.queries'

// ─── Goals ──────────────────────────────────────────────────────────────────

export async function dbInsertGoal(
  input: CreateGoalInput & { workspaceId: string; ownerId: string },
): Promise<Goal> {
  const db = getDb()
  const { rows } = await db.query(GoalQueries.INSERT_GOAL, [
    input.workspaceId,
    input.name,
    input.description ?? null,
    input.dueDate ?? null,
    input.ownerId,
    input.color ?? '#6366f1',
  ])
  return rows[0] as Goal
}

export async function dbListGoalsByWorkspace(workspaceId: string): Promise<Goal[]> {
  const db = getDb()
  const { rows } = await db.query(GoalQueries.LIST_GOALS_BY_WORKSPACE, [workspaceId])
  return rows as Goal[]
}

export async function dbGetGoalById(goalId: string): Promise<Goal | null> {
  const db = getDb()
  const { rows } = await db.query(GoalQueries.GET_GOAL_BY_ID, [goalId])
  return (rows[0] as Goal) ?? null
}

export async function dbUpdateGoal(
  goalId: string,
  input: UpdateGoalInput,
): Promise<Goal | null> {
  const db = getDb()
  const { rows } = await db.query(GoalQueries.UPDATE_GOAL, [
    goalId,
    input.name ?? null,
    input.description ?? null,
    input.dueDate ?? null,
    input.color ?? null,
    input.ownerId ?? null,
  ])
  return (rows[0] as Goal) ?? null
}

export async function dbSoftDeleteGoal(
  goalId: string,
): Promise<{ id: string; workspaceId: string } | null> {
  const db = getDb()
  const { rows } = await db.query(GoalQueries.SOFT_DELETE_GOAL, [goalId])
  return rows[0] ?? null
}

// ─── Targets ─────────────────────────────────────────────────────────────────

export async function dbInsertTarget(
  input: { goalId: string } & import('@clickup/contracts').CreateGoalTargetInput,
): Promise<GoalTarget> {
  const db = getDb()
  const { rows } = await db.query(GoalQueries.INSERT_TARGET, [
    input.goalId,
    input.name,
    input.type,
    input.targetValue ?? null,
    input.currentValue ?? 0,
    input.taskId ?? null,
  ])
  return rows[0] as GoalTarget
}

export async function dbListTargetsByGoal(goalId: string): Promise<GoalTarget[]> {
  const db = getDb()
  const { rows } = await db.query(GoalQueries.LIST_TARGETS_BY_GOAL, [goalId])
  return rows as GoalTarget[]
}

export async function dbGetTargetById(targetId: string): Promise<GoalTarget | null> {
  const db = getDb()
  const { rows } = await db.query(GoalQueries.GET_TARGET_BY_ID, [targetId])
  return (rows[0] as GoalTarget) ?? null
}

export async function dbUpdateTarget(
  targetId: string,
  input: import('@clickup/contracts').UpdateGoalTargetInput,
): Promise<GoalTarget | null> {
  const db = getDb()
  const { rows } = await db.query(GoalQueries.UPDATE_TARGET, [
    targetId,
    input.name ?? null,
    input.currentValue ?? null,
    input.targetValue ?? null,
  ])
  return (rows[0] as GoalTarget) ?? null
}

export async function dbDeleteTarget(
  targetId: string,
): Promise<{ id: string; goalId: string } | null> {
  const db = getDb()
  const { rows } = await db.query(GoalQueries.DELETE_TARGET, [targetId])
  return rows[0] ?? null
}
```

### 5.3 Progress Calculation Helper (`src/goals/goals.service.ts` — top section)

```typescript
// src/goals/goals.service.ts
// Business logic layer. Calls repository for DB, computes progress,
// manages cache, and publishes NATS events.
//
// Progress rules:
//   number / currency  → min((current / target) * 100, 100)  [0 if target is null/0]
//   boolean            → current_value === 1 ? 100 : 0
//   task               → resolved via task-service; completed status = 100, else 0
//
// IMPORTANT: Publish NATS events AFTER the DB write. NEVER inside a transaction.

import {
  AppError, validate, tier2Get, tier2Set, tier2Del,
  CacheKeys, publish, logger, createServiceClient,
} from '@clickup/sdk'
import {
  ErrorCode,
  CreateGoalSchema, UpdateGoalSchema,
  GOAL_EVENTS,
  type Goal, type GoalTarget,
  type CreateGoalInput, type UpdateGoalInput,
  type CreateGoalTargetInput, type UpdateGoalTargetInput,
  type GoalCreatedEvent, type GoalUpdatedEvent,
  type GoalDeletedEvent, type GoalProgressUpdatedEvent,
} from '@clickup/contracts'
import {
  dbInsertGoal, dbListGoalsByWorkspace, dbGetGoalById,
  dbUpdateGoal, dbSoftDeleteGoal,
} from './goals.repository'
import {
  dbInsertTarget, dbListTargetsByGoal,
  dbGetTargetById, dbUpdateTarget, dbDeleteTarget,
} from '../targets/targets.repository'

// ─── Progress Calculation ────────────────────────────────────────────────────

export interface TargetWithProgress extends GoalTarget {
  progress: number   // 0–100
}

export interface GoalWithProgress extends Goal {
  targets: TargetWithProgress[]
  overallProgress: number   // 0–100, average of all target progress values
}

/**
 * Compute progress percentage (0–100) for a single target.
 * For 'task' targets, taskCompleted must be resolved BEFORE calling this.
 */
export function computeTargetProgress(
  target: GoalTarget,
  taskCompleted?: boolean,
): number {
  switch (target.type) {
    case 'number':
    case 'currency': {
      if (!target.targetValue || target.targetValue === 0) return 0
      const pct = (Number(target.currentValue) / Number(target.targetValue)) * 100
      return Math.min(Math.round(pct * 100) / 100, 100)
    }
    case 'boolean':
      return Number(target.currentValue) === 1 ? 100 : 0
    case 'task':
      return taskCompleted === true ? 100 : 0
    default:
      return 0
  }
}

/**
 * Compute the overall progress of a goal given all its targets.
 * Returns 0 when a goal has no targets (not yet started).
 */
export function computeOverallProgress(targetProgress: number[]): number {
  if (targetProgress.length === 0) return 0
  const sum = targetProgress.reduce((acc, p) => acc + p, 0)
  return Math.round((sum / targetProgress.length) * 100) / 100
}

/**
 * Resolve progress for all targets in a goal.
 * Makes a single batch call to task-service for any 'task' type targets.
 */
async function resolveTargetsWithProgress(
  targets: GoalTarget[],
): Promise<TargetWithProgress[]> {
  // Collect all task IDs that need status resolution
  const taskTargets = targets.filter(t => t.type === 'task' && t.taskId)

  // Batch-fetch task statuses from task-service (one call for all task targets)
  const taskCompletionMap = new Map<string, boolean>()
  if (taskTargets.length > 0) {
    try {
      const taskClient = createServiceClient(
        process.env['TASK_SERVICE_URL'] ?? 'http://localhost:3002',
      )
      const taskIds = taskTargets.map(t => t.taskId!).join(',')
      const response = await taskClient.get<{ tasks: Array<{ id: string; status: string }> }>(
        `/api/v1/internal/tasks/batch?ids=${taskIds}`,
      )
      for (const task of response.tasks) {
        taskCompletionMap.set(task.id, task.status === 'closed' || task.status === 'complete')
      }
    } catch (err) {
      // task-service unavailable — treat task targets as incomplete (0%)
      // Log but do not fail the goal fetch
      logger.warn({ err }, 'goal-service: could not resolve task completion statuses')
    }
  }

  return targets.map(target => ({
    ...target,
    progress: computeTargetProgress(
      target,
      target.taskId ? taskCompletionMap.get(target.taskId) : undefined,
    ),
  }))
}

// ─── Goal Operations ─────────────────────────────────────────────────────────

export async function createGoal(
  workspaceId: string,
  requesterId: string,
  rawInput: unknown,
): Promise<GoalWithProgress> {
  const input = validate(CreateGoalSchema, rawInput) as CreateGoalInput

  const goal = await dbInsertGoal({ ...input, workspaceId, ownerId: requesterId })

  // New goal has no targets yet — progress is 0
  const result: GoalWithProgress = { ...goal, targets: [], overallProgress: 0 }

  // Cache the new goal immediately
  await tier2Set(CacheKeys.goal(goal.id), result)
  // Invalidate the workspace list cache (stale after new goal)
  await tier2Del(CacheKeys.goalList(workspaceId))

  // Publish AFTER DB write — never inside transaction
  const event: GoalCreatedEvent = {
    goalId: goal.id,
    workspaceId: goal.workspaceId,
    ownerId: goal.ownerId,
    name: goal.name,
  }
  await publish(GOAL_EVENTS.CREATED, event)

  logger.info({ goalId: goal.id, workspaceId }, 'goal created')
  return result
}

export async function listGoals(
  workspaceId: string,
): Promise<GoalWithProgress[]> {
  const cacheKey = CacheKeys.goalList(workspaceId)
  const cached = await tier2Get<GoalWithProgress[]>(cacheKey)
  if (cached) return cached

  const goals = await dbListGoalsByWorkspace(workspaceId)

  // For list view: resolve targets + progress for each goal in parallel
  const results = await Promise.all(
    goals.map(async (goal) => {
      const targets = await dbListTargetsByGoal(goal.id)
      const targetsWithProgress = await resolveTargetsWithProgress(targets)
      const overallProgress = computeOverallProgress(targetsWithProgress.map(t => t.progress))
      return { ...goal, targets: targetsWithProgress, overallProgress }
    }),
  )

  await tier2Set(cacheKey, results)
  return results
}

export async function getGoal(goalId: string): Promise<GoalWithProgress> {
  const cacheKey = CacheKeys.goal(goalId)
  const cached = await tier2Get<GoalWithProgress>(cacheKey)
  if (cached) return cached

  const goal = await dbGetGoalById(goalId)
  if (!goal) {
    throw new AppError(ErrorCode.GOAL_NOT_FOUND, `Goal ${goalId} not found.`)
  }

  const targets = await dbListTargetsByGoal(goalId)
  const targetsWithProgress = await resolveTargetsWithProgress(targets)
  const overallProgress = computeOverallProgress(targetsWithProgress.map(t => t.progress))

  const result: GoalWithProgress = { ...goal, targets: targetsWithProgress, overallProgress }
  await tier2Set(cacheKey, result)
  return result
}

export async function updateGoal(
  goalId: string,
  requesterId: string,
  rawInput: unknown,
): Promise<GoalWithProgress> {
  const input = validate(UpdateGoalSchema, rawInput) as UpdateGoalInput

  const existing = await dbGetGoalById(goalId)
  if (!existing) {
    throw new AppError(ErrorCode.GOAL_NOT_FOUND, `Goal ${goalId} not found.`)
  }
  if (existing.ownerId !== requesterId) {
    throw new AppError(
      ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      'Only the goal owner can update this goal.',
    )
  }

  const updated = await dbUpdateGoal(goalId, input)
  if (!updated) {
    throw new AppError(ErrorCode.GOAL_NOT_FOUND, `Goal ${goalId} not found.`)
  }

  // Recompute progress from current targets
  const targets = await dbListTargetsByGoal(goalId)
  const targetsWithProgress = await resolveTargetsWithProgress(targets)
  const overallProgress = computeOverallProgress(targetsWithProgress.map(t => t.progress))
  const result: GoalWithProgress = { ...updated, targets: targetsWithProgress, overallProgress }

  // Invalidate both caches
  await tier2Del(CacheKeys.goal(goalId))
  await tier2Del(CacheKeys.goalList(updated.workspaceId))

  const event: GoalUpdatedEvent = {
    goalId: updated.id,
    workspaceId: updated.workspaceId,
    changes: input,
  }
  await publish(GOAL_EVENTS.UPDATED, event)

  logger.info({ goalId, requesterId }, 'goal updated')
  return result
}

export async function deleteGoal(
  goalId: string,
  requesterId: string,
): Promise<void> {
  const existing = await dbGetGoalById(goalId)
  if (!existing) {
    throw new AppError(ErrorCode.GOAL_NOT_FOUND, `Goal ${goalId} not found.`)
  }
  if (existing.ownerId !== requesterId) {
    throw new AppError(
      ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      'Only the goal owner can delete this goal.',
    )
  }

  const deleted = await dbSoftDeleteGoal(goalId)
  if (!deleted) {
    throw new AppError(ErrorCode.GOAL_NOT_FOUND, `Goal ${goalId} not found.`)
  }

  // Invalidate caches
  await tier2Del(CacheKeys.goal(goalId))
  await tier2Del(CacheKeys.goalList(existing.workspaceId))

  const event: GoalDeletedEvent = {
    goalId: deleted.id,
    workspaceId: deleted.workspaceId,
  }
  await publish(GOAL_EVENTS.DELETED, event)

  logger.info({ goalId, requesterId }, 'goal soft-deleted')
}
```

### 5.4 Targets Service (`src/targets/targets.service.ts`)

```typescript
// src/targets/targets.service.ts
// Business logic for goal targets.
// Publishes goal.progress_updated whenever current_value changes.

import { AppError, validate, tier2Del, CacheKeys, publish, logger } from '@clickup/sdk'
import {
  ErrorCode,
  CreateGoalTargetSchema, UpdateGoalTargetSchema,
  GOAL_EVENTS,
  type GoalTarget, type CreateGoalTargetInput, type UpdateGoalTargetInput,
  type GoalProgressUpdatedEvent,
} from '@clickup/contracts'
import {
  dbInsertTarget, dbListTargetsByGoal,
  dbGetTargetById, dbUpdateTarget, dbDeleteTarget,
} from './targets.repository'
import { dbGetGoalById } from '../goals/goals.repository'
import {
  computeTargetProgress, computeOverallProgress, resolveTargetsWithProgress,
} from '../goals/goals.service'

export async function addTarget(
  goalId: string,
  requesterId: string,
  rawInput: unknown,
): Promise<GoalTarget> {
  const input = validate(CreateGoalTargetSchema, rawInput) as CreateGoalTargetInput

  const goal = await dbGetGoalById(goalId)
  if (!goal) {
    throw new AppError(ErrorCode.GOAL_NOT_FOUND, `Goal ${goalId} not found.`)
  }

  // Only the goal owner can add targets
  if (goal.ownerId !== requesterId) {
    throw new AppError(
      ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      'Only the goal owner can add targets.',
    )
  }

  // boolean targets must not have a target_value
  if (input.type === 'boolean' && input.targetValue != null) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Boolean targets do not use target_value.',
    )
  }

  // number/currency targets require target_value
  if ((input.type === 'number' || input.type === 'currency') && !input.targetValue) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `Targets of type '${input.type}' require target_value.`,
    )
  }

  const target = await dbInsertTarget({ goalId, ...input })

  // Invalidate goal cache — target count changed
  await tier2Del(CacheKeys.goal(goalId))
  await tier2Del(CacheKeys.goalList(goal.workspaceId))

  // Emit progress_updated because a new target (starting at 0) changes overall %
  await emitProgressUpdated(goalId, goal.workspaceId)

  logger.info({ goalId, targetId: target.id }, 'goal target added')
  return target
}

export async function listTargets(goalId: string): Promise<GoalTarget[]> {
  const goal = await dbGetGoalById(goalId)
  if (!goal) {
    throw new AppError(ErrorCode.GOAL_NOT_FOUND, `Goal ${goalId} not found.`)
  }
  return dbListTargetsByGoal(goalId)
}

export async function updateTarget(
  goalId: string,
  targetId: string,
  requesterId: string,
  rawInput: unknown,
): Promise<GoalTarget> {
  const input = validate(UpdateGoalTargetSchema, rawInput) as UpdateGoalTargetInput

  const goal = await dbGetGoalById(goalId)
  if (!goal) {
    throw new AppError(ErrorCode.GOAL_NOT_FOUND, `Goal ${goalId} not found.`)
  }
  if (goal.ownerId !== requesterId) {
    throw new AppError(
      ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      'Only the goal owner can update targets.',
    )
  }

  const existing = await dbGetTargetById(targetId)
  if (!existing || existing.goalId !== goalId) {
    throw new AppError(ErrorCode.GOAL_TARGET_NOT_FOUND, `Target ${targetId} not found.`)
  }

  const updated = await dbUpdateTarget(targetId, input)
  if (!updated) {
    throw new AppError(ErrorCode.GOAL_TARGET_NOT_FOUND, `Target ${targetId} not found.`)
  }

  // Invalidate caches
  await tier2Del(CacheKeys.goal(goalId))
  await tier2Del(CacheKeys.goalList(goal.workspaceId))

  // Publish progress_updated whenever current_value changed
  const currentValueChanged = input.currentValue != null
  if (currentValueChanged) {
    await emitProgressUpdated(goalId, goal.workspaceId)
  }

  logger.info({ goalId, targetId, requesterId }, 'goal target updated')
  return updated
}

export async function deleteTarget(
  goalId: string,
  targetId: string,
  requesterId: string,
): Promise<void> {
  const goal = await dbGetGoalById(goalId)
  if (!goal) {
    throw new AppError(ErrorCode.GOAL_NOT_FOUND, `Goal ${goalId} not found.`)
  }
  if (goal.ownerId !== requesterId) {
    throw new AppError(
      ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
      'Only the goal owner can delete targets.',
    )
  }

  const existing = await dbGetTargetById(targetId)
  if (!existing || existing.goalId !== goalId) {
    throw new AppError(ErrorCode.GOAL_TARGET_NOT_FOUND, `Target ${targetId} not found.`)
  }

  await dbDeleteTarget(targetId)

  // Invalidate caches
  await tier2Del(CacheKeys.goal(goalId))
  await tier2Del(CacheKeys.goalList(goal.workspaceId))

  // Progress changed because a target was removed — emit updated overall %
  await emitProgressUpdated(goalId, goal.workspaceId)

  logger.info({ goalId, targetId, requesterId }, 'goal target deleted')
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Recomputes overall goal progress and publishes goal.progress_updated.
 * Called after any operation that changes a target's current_value or count.
 * Always called AFTER the DB write — never inside a transaction.
 */
async function emitProgressUpdated(
  goalId: string,
  workspaceId: string,
): Promise<void> {
  try {
    const targets = await dbListTargetsByGoal(goalId)
    const targetsWithProgress = await resolveTargetsWithProgress(targets)
    const overallProgress = computeOverallProgress(targetsWithProgress.map(t => t.progress))

    const event: GoalProgressUpdatedEvent = {
      goalId,
      workspaceId,
      overallProgress,
      targetCount: targets.length,
    }
    await publish(GOAL_EVENTS.PROGRESS_UPDATED, event)
  } catch (err) {
    // Never fail the user-facing operation because of a NATS publish error
    logger.error({ err, goalId }, 'goal-service: failed to emit progress_updated event')
  }
}
```

### 5.5 Goals Handler (`src/goals/goals.handler.ts`)

```typescript
// src/goals/goals.handler.ts
// HTTP layer only. No SQL, no business logic.
// Extracts req params, calls service, returns JSON.

import { Router } from 'express'
import { requireAuth, asyncHandler } from '@clickup/sdk'
import {
  createGoal, listGoals, getGoal, updateGoal, deleteGoal,
} from './goals.service'

export function createGoalRoutes(): Router {
  const router = Router()

  // POST /workspaces/:workspaceId/goals
  router.post(
    '/workspaces/:workspaceId/goals',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params
      const requesterId = req.user!.id
      const goal = await createGoal(workspaceId, requesterId, req.body)
      res.status(201).json({ goal })
    }),
  )

  // GET /workspaces/:workspaceId/goals
  router.get(
    '/workspaces/:workspaceId/goals',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params
      const goals = await listGoals(workspaceId)
      res.json({ goals })
    }),
  )

  // GET /goals/:goalId
  router.get(
    '/goals/:goalId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { goalId } = req.params
      const goal = await getGoal(goalId)
      res.json({ goal })
    }),
  )

  // PATCH /goals/:goalId
  router.patch(
    '/goals/:goalId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { goalId } = req.params
      const requesterId = req.user!.id
      const goal = await updateGoal(goalId, requesterId, req.body)
      res.json({ goal })
    }),
  )

  // DELETE /goals/:goalId
  router.delete(
    '/goals/:goalId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { goalId } = req.params
      const requesterId = req.user!.id
      await deleteGoal(goalId, requesterId)
      res.status(204).send()
    }),
  )

  return router
}
```

### 5.6 Targets Handler (`src/targets/targets.handler.ts`)

```typescript
// src/targets/targets.handler.ts
// HTTP layer for goal target endpoints. No SQL, no business logic.

import { Router } from 'express'
import { requireAuth, asyncHandler } from '@clickup/sdk'
import {
  addTarget, listTargets, updateTarget, deleteTarget,
} from './targets.service'

export function createTargetRoutes(): Router {
  const router = Router()

  // POST /goals/:goalId/targets
  router.post(
    '/goals/:goalId/targets',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { goalId } = req.params
      const requesterId = req.user!.id
      const target = await addTarget(goalId, requesterId, req.body)
      res.status(201).json({ target })
    }),
  )

  // GET /goals/:goalId/targets
  router.get(
    '/goals/:goalId/targets',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { goalId } = req.params
      const targets = await listTargets(goalId)
      res.json({ targets })
    }),
  )

  // PATCH /goals/:goalId/targets/:targetId
  router.patch(
    '/goals/:goalId/targets/:targetId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { goalId, targetId } = req.params
      const requesterId = req.user!.id
      const target = await updateTarget(goalId, targetId, requesterId, req.body)
      res.json({ target })
    }),
  )

  // DELETE /goals/:goalId/targets/:targetId
  router.delete(
    '/goals/:goalId/targets/:targetId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { goalId, targetId } = req.params
      const requesterId = req.user!.id
      await deleteTarget(goalId, targetId, requesterId)
      res.status(204).send()
    }),
  )

  return router
}
```

### 5.7 Routes (`src/routes.ts`)

```typescript
// src/routes.ts
// Top-level route registration for goal-service.

import { Router } from 'express'
import { createGoalRoutes } from './goals/goals.handler'
import { createTargetRoutes } from './targets/targets.handler'

export function createRoutes(): Router {
  const router = Router()

  router.use('/api/v1', createGoalRoutes())
  router.use('/api/v1', createTargetRoutes())

  return router
}
```

### 5.8 Service Entry Point (`src/index.ts`)

```typescript
// src/index.ts
// Copy from services/_template/src/index.ts, then change:
//   SERVICE_NAME=goal-service
//   PORT=3009
//
// No other changes needed — the template handles:
//   - Express setup
//   - DB pool initialisation
//   - Redis connection
//   - NATS connection
//   - Health endpoint at GET /health
//   - Error handler middleware
//   - Graceful shutdown

import { createApp } from '@clickup/sdk'
import { createRoutes } from './routes'

const PORT = parseInt(process.env['PORT'] ?? '3009', 10)

const app = createApp({
  serviceName: 'goal-service',
  routes: createRoutes(),
})

app.listen(PORT, () => {
  // logger is configured by createApp
})
```

### 5.9 `.env.example`

```
SERVICE_NAME=goal-service
PORT=3009
LOG_LEVEL=info

# PostgreSQL
DATABASE_URL=postgres://clickup:clickup@localhost:5432/clickup

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# NATS
NATS_URL=nats://localhost:4222

# JWT (same secret across all services)
JWT_SECRET=change-me-in-production

# Downstream services
IDENTITY_SERVICE_URL=http://localhost:3001
TASK_SERVICE_URL=http://localhost:3002
```

### 5.10 `package.json`

```json
{
  "name": "@clickup/goal-service",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src tests --ext .ts"
  },
  "dependencies": {
    "@clickup/contracts": "workspace:*",
    "@clickup/sdk": "workspace:*"
  },
  "devDependencies": {
    "@clickup/test-helpers": "workspace:*",
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "tsx": "^4.7.0",
    "vitest": "^1.4.0"
  }
}
```

---

## 6. Database Tables

The tables are **already created** in the shared migration. DO NOT create or alter them.

```
goals         — workspace-scoped goal rows with soft-delete (deleted_at)
goal_targets  — targets for each goal; hard-deleted when goal is hard-deleted
```

Key constraints to know for test data setup:
- `goals.workspace_id` references `workspaces(id)` — must seed a workspace first
- `goals.owner_id` references `users(id)` — must seed a user first
- `goal_targets.task_id` references `tasks(id) ON DELETE SET NULL` — safe to omit in tests
- `goal_targets.type` is an enum: `'number' | 'currency' | 'boolean' | 'task'`

---

## 7. Mandatory Tests

### Unit Tests — `tests/unit/goals.service.test.ts`

```
□ computeTargetProgress — number: returns (current/target)*100 capped at 100
□ computeTargetProgress — number: returns 0 when target_value is 0 or null
□ computeTargetProgress — currency: same cap-at-100 logic as number
□ computeTargetProgress — boolean: returns 100 when current_value === 1
□ computeTargetProgress — boolean: returns 0 when current_value === 0
□ computeTargetProgress — task: returns 100 when taskCompleted is true
□ computeTargetProgress — task: returns 0 when taskCompleted is false or undefined
□ computeOverallProgress — returns 0 when targets array is empty
□ computeOverallProgress — returns average of all target progress values
□ computeOverallProgress — rounds to 2 decimal places
□ createGoal — throws VALIDATION_ERROR on missing required fields (name)
□ createGoal — invalidates goalList cache after insert
□ createGoal — publishes goal.created event after DB write (not before)
□ getGoal — returns cached value on cache hit (repository not called)
□ getGoal — throws GOAL_NOT_FOUND when goal does not exist
□ updateGoal — throws AUTH_INSUFFICIENT_PERMISSION when requesterId !== ownerId
□ updateGoal — throws GOAL_NOT_FOUND when goal does not exist
□ updateGoal — invalidates goal and goalList cache after update
□ updateGoal — publishes goal.updated event after DB write
□ deleteGoal — throws AUTH_INSUFFICIENT_PERMISSION when requesterId !== ownerId
□ deleteGoal — throws GOAL_NOT_FOUND when goal does not exist
□ deleteGoal — publishes goal.deleted event after DB write
□ deleteGoal — invalidates goal and goalList cache after soft-delete
```

### Unit Tests — `tests/unit/targets.service.test.ts`

```
□ addTarget — throws GOAL_NOT_FOUND when goal does not exist
□ addTarget — throws AUTH_INSUFFICIENT_PERMISSION when requester is not owner
□ addTarget — throws VALIDATION_ERROR when boolean target has a target_value
□ addTarget — throws VALIDATION_ERROR when number/currency target has no target_value
□ addTarget — emits goal.progress_updated after insert
□ addTarget — invalidates goal cache after insert
□ updateTarget — throws GOAL_TARGET_NOT_FOUND when target does not exist
□ updateTarget — throws GOAL_TARGET_NOT_FOUND when target belongs to different goal
□ updateTarget — publishes goal.progress_updated when current_value changes
□ updateTarget — does NOT publish goal.progress_updated when only name changes
□ deleteTarget — throws GOAL_TARGET_NOT_FOUND when target does not exist
□ deleteTarget — emits goal.progress_updated after deletion
□ deleteTarget — invalidates goal cache after deletion
□ emitProgressUpdated — does not throw when NATS publish fails (logs error instead)
```

### Integration Tests — `tests/integration/goals.handler.test.ts`

All integration tests MUST use `withRollback()` from `@clickup/test-helpers`.
Never mock the DB. Never leave data in the DB after a test.

```
□ POST /api/v1/workspaces/:workspaceId/goals
    → 401 when no auth token
    → 400 VALIDATION_ERROR when name is missing
    → 201 with goal object on valid input (name, optional fields)
    → created goal has overallProgress: 0 (no targets yet)
    → goal.created event published to NATS

□ GET /api/v1/workspaces/:workspaceId/goals
    → 401 when no auth token
    → 200 empty array when workspace has no goals
    → 200 returns all non-deleted goals with overallProgress for each
    → soft-deleted goals are NOT included in results

□ GET /api/v1/goals/:goalId
    → 401 when no auth token
    → 404 GOAL_NOT_FOUND for nonexistent ID
    → 404 GOAL_NOT_FOUND for soft-deleted goal
    → 200 with goal + targets array + overallProgress

□ PATCH /api/v1/goals/:goalId
    → 401 when no auth token
    → 404 GOAL_NOT_FOUND for nonexistent ID
    → 403 AUTH_INSUFFICIENT_PERMISSION when requester is not owner
    → 200 with updated goal on valid partial input (name only)
    → 200 with updated goal on valid partial input (due_date + color)
    → goal.updated event published to NATS

□ DELETE /api/v1/goals/:goalId
    → 401 when no auth token
    → 404 GOAL_NOT_FOUND for nonexistent ID
    → 403 AUTH_INSUFFICIENT_PERMISSION when requester is not owner
    → 204 on successful soft-delete
    → subsequent GET /goals/:goalId returns 404 after delete
    → goal.deleted event published to NATS
```

### Integration Tests — `tests/integration/targets.handler.test.ts`

```
□ POST /api/v1/goals/:goalId/targets
    → 401 when no auth token
    → 404 GOAL_NOT_FOUND when goal does not exist
    → 403 AUTH_INSUFFICIENT_PERMISSION when requester is not owner
    → 400 VALIDATION_ERROR when type='number' and no target_value
    → 400 VALIDATION_ERROR when type='boolean' and target_value provided
    → 201 with target object for type='number' with target_value
    → 201 with target object for type='boolean' (no target_value)
    → 201 with target object for type='currency'
    → goal.progress_updated published after insert

□ GET /api/v1/goals/:goalId/targets
    → 401 when no auth token
    → 404 GOAL_NOT_FOUND when goal does not exist
    → 200 empty array when goal has no targets
    → 200 returns all targets ordered by created_at ASC

□ PATCH /api/v1/goals/:goalId/targets/:targetId
    → 401 when no auth token
    → 404 GOAL_TARGET_NOT_FOUND for nonexistent targetId
    → 403 AUTH_INSUFFICIENT_PERMISSION when requester is not owner
    → 200 with updated target when name changed
    → 200 with updated target when current_value changed
    → goal.progress_updated published when current_value changes
    → goal.progress_updated NOT published when only name changes

□ DELETE /api/v1/goals/:goalId/targets/:targetId
    → 401 when no auth token
    → 404 GOAL_TARGET_NOT_FOUND for nonexistent targetId
    → 403 AUTH_INSUFFICIENT_PERMISSION when requester is not owner
    → 204 on successful deletion
    → subsequent GET /goals/:goalId shows target no longer present
    → goal.progress_updated published after deletion
```

---

## 8. Definition of Done

```
□ All 9 endpoints implemented and returning correct HTTP status codes
□ Progress computation correct for all 4 target types (number, currency, boolean, task)
□ overall_progress = 0 for goals with no targets
□ overall_progress = average of all target progress values (capped per target at 100)
□ task-type targets resolve completion via task-service HTTP call
□ task-service unavailability handled gracefully (logs warn, treats as 0%, does not 500)
□ Redis cache set on read, invalidated on every write (goal + goalList keys)
□ NATS events published AFTER DB write — never inside a transaction
□ goal.progress_updated published on: target add, current_value change, target delete
□ All owner-only operations return 403 AUTH_INSUFFICIENT_PERMISSION for non-owners
□ Soft-delete: deleted goals invisible in list + get, 404 returned
□ SQL only in goals.queries.ts and repository files — no inline SQL elsewhere
□ No console.log — logger from @clickup/sdk only
□ packages/contracts and packages/sdk not modified
□ pnpm typecheck passes with zero errors
□ pnpm lint passes with zero warnings
□ All unit tests pass (mock repository layer)
□ All integration tests pass using withRollback() — no DB mocking
□ Test coverage ≥ 80% on src/goals/* and src/targets/*
□ GET /health returns 200 with { status: 'ok' }
```

---

## 9. Constraints

```
✗ Do NOT modify packages/contracts or packages/sdk — READ ONLY
✗ Do NOT write SQL inside service or handler files — only in *.queries.ts and *.repository.ts
✗ Do NOT use console.log — use logger from @clickup/sdk
✗ Do NOT publish NATS events inside a DB transaction
✗ Do NOT use raw Error() — always use AppError(ErrorCode.X)
✗ Do NOT use custom validation — always use validate(Schema, data) from @clickup/sdk
✗ Do NOT mock the DB in integration tests — use withRollback() from @clickup/test-helpers
✗ Do NOT implement goal roll-ups across spaces (Wave 3 feature)
✗ Do NOT implement task-linking automation (Wave 3 feature)
✗ Do NOT hard-delete goals — soft-delete via deleted_at only
✗ Do NOT add goal_targets.deleted_at — targets are hard-deleted (FK cascade handles it)
✗ Do NOT retry task-service calls — log warn and default to 0% on failure
```

---

## 10. Error Code Reference

```
These are already in the ErrorCode enum in packages/contracts — READ ONLY.

GOAL_NOT_FOUND              → 404   goal row not found or soft-deleted
GOAL_TARGET_NOT_FOUND       → 404   target row not found or belongs to different goal
AUTH_INSUFFICIENT_PERMISSION → 403   requester is not the goal owner
VALIDATION_ERROR            → 400   validate() failure or business rule violation
```

---

## 11. NATS Event Reference

```
These constants are already in GOAL_EVENTS in packages/contracts — READ ONLY.

GOAL_EVENTS.CREATED          = 'goal.created'
GOAL_EVENTS.UPDATED          = 'goal.updated'
GOAL_EVENTS.DELETED          = 'goal.deleted'
GOAL_EVENTS.PROGRESS_UPDATED = 'goal.progress_updated'

GoalCreatedEvent        { goalId, workspaceId, ownerId, name }
GoalUpdatedEvent        { goalId, workspaceId, changes: UpdateGoalInput }
GoalDeletedEvent        { goalId, workspaceId }
GoalProgressUpdatedEvent { goalId, workspaceId, overallProgress, targetCount }
```
