export const TASKS_QUERIES = {
    FIND_BY_ID: `
    SELECT
      t.*,
      u.id     AS assignee_user_id,
      u.name   AS assignee_name,
      u.avatar_url AS assignee_avatar,
      COUNT(DISTINCT s.id) AS subtask_count,
      COUNT(DISTINCT c.id) AS comment_count
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN tasks s ON s.parent_id = t.id AND s.deleted_at IS NULL
    LEFT JOIN comments c ON c.task_id = t.id AND c.deleted_at IS NULL
    WHERE t.id = $1
      AND t.deleted_at IS NULL
    GROUP BY t.id, u.id, u.name, u.avatar_url
  `,
    LIST_BY_LIST: `
    SELECT
      t.*,
      u.id         AS assignee_user_id,
      u.name       AS assignee_name,
      u.avatar_url AS assignee_avatar,
      COUNT(DISTINCT s.id) AS subtask_count,
      COUNT(DISTINCT c.id) AS comment_count
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN tasks s ON s.parent_id = t.id AND s.deleted_at IS NULL
    LEFT JOIN comments c ON c.task_id = t.id AND c.deleted_at IS NULL
    WHERE t.list_id = $1
      AND t.parent_id IS NULL
      AND t.deleted_at IS NULL
    GROUP BY t.id, u.id, u.name, u.avatar_url
    ORDER BY t.position ASC
    LIMIT $2 OFFSET $3
  `,
    INSERT: `
    INSERT INTO tasks (
      id, list_id, parent_id, path, title, description,
      status, priority, assignee_id, due_date, position, created_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
    ) RETURNING *
  `,
    UPDATE: `
    UPDATE tasks
    SET
      title = COALESCE($1, title),
      description = COALESCE($2, description),
      status = COALESCE($3, status),
      priority = COALESCE($4, priority),
      assignee_id = COALESCE($5, assignee_id),
      due_date = COALESCE($6, due_date),
      position = COALESCE($7, position),
      updated_at = NOW()
    WHERE id = $8 AND deleted_at IS NULL
    RETURNING *
  `,
    SOFT_DELETE: `
    UPDATE tasks
    SET deleted_at = NOW()
    WHERE id = $1 OR path LIKE $2 || '%'
    RETURNING id
  `,
    GET_MAX_POSITION: `
    SELECT COALESCE(MAX(position), 0) as max_pos
    FROM tasks
    WHERE list_id = $1 AND parent_id IS $2 AND deleted_at IS NULL
  `,
};
//# sourceMappingURL=tasks.queries.js.map