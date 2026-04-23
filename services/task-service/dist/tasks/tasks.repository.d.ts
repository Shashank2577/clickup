import { Pool } from 'pg';
import { TaskPriority } from '@clickup/contracts';
export declare class TasksRepository {
    private readonly db;
    constructor(db: Pool);
    getTask(id: string): Promise<any | null>;
    getListMetadata(listId: string): Promise<any | null>;
    createTask(record: {
        id: string;
        listId: string;
        title: string;
        parentId: string | null;
        path: string;
        createdBy: string;
        priority?: TaskPriority;
        assigneeId?: string;
    }): Promise<any>;
    listTasks(listId: string, limit: number, offset: number): Promise<any[]>;
    countTasks(listId: string): Promise<number>;
    updateTask(id: string, updates: any): Promise<any>;
    softDeleteWithPath(path: string): Promise<void>;
    moveTask(id: string, newBasePath: string, oldPath: string): Promise<void>;
    addTag(taskId: string, tag: string): Promise<void>;
    removeTag(taskId: string, tag: string): Promise<void>;
    getTags(taskId: string): Promise<string[]>;
    getRelations(taskId: string): Promise<any[]>;
    addRelation(record: {
        taskId: string;
        relatedTaskId: string;
        type: string;
        createdBy: string;
    }): Promise<any>;
    deleteRelation(relationId: string, taskId: string): Promise<void>;
    getWatchers(taskId: string): Promise<any[]>;
    addWatcher(taskId: string, userId: string): Promise<void>;
    removeWatcher(taskId: string, userId: string): Promise<void>;
    getChecklists(taskId: string): Promise<any[]>;
    getChecklist(checklistId: string): Promise<any | null>;
    createChecklist(taskId: string, title: string): Promise<any>;
    deleteChecklist(checklistId: string): Promise<void>;
    getChecklistItem(itemId: string): Promise<any | null>;
    createChecklistItem(checklistId: string, input: {
        title: string;
        assigneeId?: string;
        dueDate?: string;
    }): Promise<any>;
    updateChecklistItem(itemId: string, input: Record<string, unknown>): Promise<any>;
    deleteChecklistItem(itemId: string): Promise<void>;
    getTimeEntries(taskId: string): Promise<any[]>;
    getTimeEntry(entryId: string): Promise<any | null>;
    createTimeEntry(record: {
        taskId: string;
        userId: string;
        minutes: number;
        billable: boolean;
        note?: string;
        startedAt: Date;
        endedAt: Date;
    }): Promise<any>;
    updateTimeEntry(entryId: string, updates: Record<string, unknown>): Promise<any>;
    deleteTimeEntry(entryId: string): Promise<void>;
    bulkUpdateTasks(taskIds: string[], updates: Record<string, unknown>): Promise<any[]>;
    getCustomFields(workspaceId: string): Promise<any[]>;
    createCustomField(record: {
        workspaceId: string;
        name: string;
        type: string;
        config: Record<string, unknown>;
    }): Promise<any>;
    getTaskCustomFields(taskId: string): Promise<any[]>;
    setTaskCustomFieldValue(taskId: string, fieldId: string, value: unknown): Promise<any>;
}
export declare const createTasksRepository: (db: Pool) => TasksRepository;
//# sourceMappingURL=tasks.repository.d.ts.map