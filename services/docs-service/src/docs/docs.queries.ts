// ============================================================
// SQL queries for the docs domain
// All queries use AS aliasing to output camelCase columns
// matching the Doc interface from @clickup/contracts.
// ============================================================

const DOC_COLUMNS = `
  id,
  workspace_id  AS "workspaceId",
  title,
  content,
  parent_id     AS "parentId",
  path,
  is_public     AS "isPublic",
  created_by    AS "createdBy",
  created_at    AS "createdAt",
  updated_at    AS "updatedAt"
`

export const FIND_BY_ID = `
  SELECT ${DOC_COLUMNS}
  FROM docs
  WHERE id = $1 AND deleted_at IS NULL
`

export const LIST_TOP_LEVEL = `
  SELECT ${DOC_COLUMNS},
    (SELECT COUNT(*)::int FROM docs c WHERE c.parent_id = docs.id AND c.deleted_at IS NULL) AS "childCount"
  FROM docs
  WHERE workspace_id = $1
    AND parent_id IS NULL
    AND deleted_at IS NULL
  ORDER BY created_at DESC
`

export const LIST_CHILDREN = `
  SELECT ${DOC_COLUMNS},
    (SELECT COUNT(*)::int FROM docs c WHERE c.parent_id = docs.id AND c.deleted_at IS NULL) AS "childCount"
  FROM docs
  WHERE parent_id = $1
    AND deleted_at IS NULL
  ORDER BY created_at DESC
`

export const LIST_DESCENDANTS = `
  SELECT ${DOC_COLUMNS}
  FROM docs
  WHERE path LIKE $1 || '%'
    AND id != $2
    AND deleted_at IS NULL
  ORDER BY path ASC
`

export const INSERT = `
  INSERT INTO docs (id, workspace_id, title, content, parent_id, path, is_public, created_by)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING ${DOC_COLUMNS}
`

export const UPDATE = `
  UPDATE docs
  SET
    title      = COALESCE($2, title),
    content    = COALESCE($3, content),
    is_public  = COALESCE($4, is_public),
    updated_at = NOW()
  WHERE id = $1 AND deleted_at IS NULL
  RETURNING ${DOC_COLUMNS}
`

export const SOFT_DELETE = `
  UPDATE docs
  SET deleted_at = NOW()
  WHERE id = $1 AND deleted_at IS NULL
  RETURNING id
`

export const SOFT_DELETE_DESCENDANTS = `
  UPDATE docs
  SET deleted_at = NOW()
  WHERE path LIKE $1 || '%'
    AND id != $2
    AND deleted_at IS NULL
  RETURNING id
`
