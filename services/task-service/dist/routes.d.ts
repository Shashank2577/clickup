import { Router } from 'express';
import type { Pool } from 'pg';
import { workspaceCustomFieldsRouter } from './tasks/custom-fields.handler.js';
import { statusesRouter } from './tasks/statuses.handler.js';
import { taskTemplatesRouter } from './tasks/templates.handler.js';
import { formsRouter, standaloneFormsRouter } from './tasks/forms.handler.js';
import { fieldPermissionsRouter } from './tasks/field-permissions.handler.js';
import { taskTypesRouter } from './tasks/task-types.handler.js';
export declare function routes(db: Pool): Router;
export { workspaceCustomFieldsRouter };
export { statusesRouter };
export { taskTemplatesRouter };
export { formsRouter, standaloneFormsRouter };
export { taskTypesRouter };
export { fieldPermissionsRouter };
//# sourceMappingURL=routes.d.ts.map