import type { AutomationCondition } from '@clickup/contracts'

export function evaluateConditions(
  conditions: AutomationCondition[],
  payload: Record<string, unknown>
): boolean {
  if (!conditions || conditions.length === 0) return true

  return conditions.every(condition => evaluateOne(condition, payload))
}

function evaluateOne(
  condition: AutomationCondition,
  payload: Record<string, unknown>
): boolean {
  const fieldValue = payload[condition.field]

  switch (condition.operator) {
    case 'equals':
      return String(fieldValue) === String(condition.value)
    case 'not_equals':
      return String(fieldValue) !== String(condition.value)
    case 'contains':
      return typeof fieldValue === 'string'
        && typeof condition.value === 'string'
        && fieldValue.includes(condition.value)
    case 'is_empty':
      return fieldValue === null || fieldValue === undefined || fieldValue === ''
    case 'is_not_empty':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
    default:
      return false
  }
}
