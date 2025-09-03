import { api } from "encore.dev/api";
import { db } from "./db";
import { ErrorFingerprinter, ErrorInput, FingerprintResult } from "./fingerprint";

export interface ErrorGroup {
  id: number;
  project_id: number;
  fingerprint: string;
  pattern_hash: string;
  title: string;
  message_template: string;
  stack_pattern: string;
  url_pattern: string;
  first_seen: Date;
  last_seen: Date;
  total_occurrences: number;
  unique_users: number;
  status: 'open' | 'resolved' | 'ignored' | 'investigating';
  assigned_to?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
  metadata: Record<string, any>;
}

export interface ProcessErrorParams {
  project_id: number;
  error_id: number;
  error_data: ErrorInput;
  user_id?: string;
  session_id?: string;
}

export interface ProcessErrorResponse {
  error_group_id: number;
  is_new_group: boolean;
  fingerprint: string;
  similarity_score?: number;
}

/**
 * Process an error and assign it to an error group using intelligent fingerprinting
 */
export const processError = api<ProcessErrorParams, ProcessErrorResponse>(
  { expose: true, method: "POST", path: "/api/intelligence/process-error" },
  async (params) => {
    const { project_id, error_id, error_data, user_id, session_id } = params;
    
    // Generate fingerprint for the error
    const fingerprintResult = ErrorFingerprinter.generateFingerprint(error_data);
    
    // Try to find existing error group with exact fingerprint
    let existingGroup = await db.queryRow<ErrorGroup>`
      SELECT * FROM error_groups 
      WHERE project_id = ${project_id} AND fingerprint = ${fingerprintResult.fingerprint}
    `;
    
    let errorGroupId: number;
    let isNewGroup = false;
    let similarityScore: number | undefined;
    
    if (existingGroup) {
      // Update existing group
      errorGroupId = existingGroup.id;
      await updateErrorGroup(existingGroup.id, user_id);
    } else {
      // Look for similar error groups using pattern hash
      const similarGroups = await db.queryAll<ErrorGroup>`
        SELECT * FROM error_groups 
        WHERE project_id = ${project_id} AND pattern_hash = ${fingerprintResult.patternHash}
        ORDER BY last_seen DESC
        LIMIT 10
      `;
      
      let bestMatch: ErrorGroup | null = null;
      let bestSimilarity = 0;
      
      // Calculate similarity with existing groups
      for (const group of similarGroups) {
        const similarity = ErrorFingerprinter.calculateSimilarity(
          fingerprintResult.normalizedMessage,
          group.message_template
        );
        
        if (similarity > bestSimilarity && similarity > 0.8) {
          bestMatch = group;
          bestSimilarity = similarity;
        }
      }
      
      if (bestMatch && bestSimilarity > 0.8) {
        // Add to existing similar group
        errorGroupId = bestMatch.id;
        similarityScore = bestSimilarity;
        await updateErrorGroup(bestMatch.id, user_id);
        
        // Update the group's fingerprint list (could have multiple similar fingerprints)
        await db.exec`
          UPDATE error_groups 
          SET metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{similar_fingerprints}',
            COALESCE(metadata->'similar_fingerprints', '[]'::jsonb) || ${JSON.stringify([fingerprintResult.fingerprint])},
            true
          ),
          updated_at = NOW()
          WHERE id = ${bestMatch.id}
        `;
      } else {
        // Create new error group
        const newGroup = await db.queryRow<{ id: number }>`
          INSERT INTO error_groups (
            project_id, fingerprint, pattern_hash, title, message_template,
            stack_pattern, url_pattern, first_seen, last_seen,
            total_occurrences, unique_users, metadata
          ) VALUES (
            ${project_id}, ${fingerprintResult.fingerprint}, ${fingerprintResult.patternHash},
            ${fingerprintResult.title}, ${fingerprintResult.normalizedMessage},
            ${fingerprintResult.normalizedStack}, ${fingerprintResult.urlPattern},
            NOW(), NOW(), 1, ${user_id ? 1 : 0},
            ${JSON.stringify({ first_error_id: error_id })}
          )
          RETURNING id
        `;
        
        errorGroupId = newGroup!.id;
        isNewGroup = true;
      }
    }
    
    // Update the error record with group assignment
    await db.exec`
      UPDATE errors 
      SET error_group_id = ${errorGroupId}, fingerprint = ${fingerprintResult.fingerprint}
      WHERE id = ${error_id}
    `;
    
    // Update statistics
    await updateErrorStatistics(project_id, errorGroupId, user_id, session_id);
    
    return {
      error_group_id: errorGroupId,
      is_new_group: isNewGroup,
      fingerprint: fingerprintResult.fingerprint,
      similarity_score: similarityScore
    };
  }
);

/**
 * Get error groups for a project with filtering and pagination
 */
export interface ListErrorGroupsParams {
  project_id: number;
  status?: 'open' | 'resolved' | 'ignored' | 'investigating';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  assigned_to?: string;
  search?: string;
  sort_by?: 'last_seen' | 'occurrences' | 'users' | 'created_at';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ListErrorGroupsResponse {
  groups: ErrorGroup[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export const listErrorGroups = api<ListErrorGroupsParams, ListErrorGroupsResponse>(
  { expose: true, method: "GET", path: "/api/intelligence/error-groups/by-project/:project_id" },
  async (params) => {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 100);
    const offset = (page - 1) * limit;
    
    let whereConditions = "WHERE project_id = $1";
    const queryParams: any[] = [params.project_id];
    let paramIndex = 2;
    
    // Add filters
    if (params.status) {
      whereConditions += ` AND status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    }
    
    if (params.priority) {
      whereConditions += ` AND priority = $${paramIndex}`;
      queryParams.push(params.priority);
      paramIndex++;
    }
    
    if (params.assigned_to) {
      whereConditions += ` AND assigned_to = $${paramIndex}`;
      queryParams.push(params.assigned_to);
      paramIndex++;
    }
    
    if (params.search) {
      whereConditions += ` AND (title ILIKE $${paramIndex} OR message_template ILIKE $${paramIndex})`;
      queryParams.push(`%${params.search}%`);
      paramIndex++;
    }
    
    // Add sorting
    let orderClause = "ORDER BY ";
    switch (params.sort_by) {
      case 'occurrences':
        orderClause += "total_occurrences";
        break;
      case 'users':
        orderClause += "unique_users";
        break;
      case 'created_at':
        orderClause += "created_at";
        break;
      default:
        orderClause += "last_seen";
    }
    
    orderClause += (params.sort_order === 'asc') ? " ASC" : " DESC";
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM error_groups
      ${whereConditions}
    `;
    
    const dataQuery = `
      SELECT *
      FROM error_groups
      ${whereConditions}
      ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const [countResult, groups] = await Promise.all([
      db.rawQueryRow<{ total: number }>(countQuery, ...queryParams),
      db.rawQueryAll<ErrorGroup>(dataQuery, ...queryParams, limit, offset)
    ]);
    
    const total = countResult?.total || 0;
    
    return {
      groups: groups.map(group => ({
        ...group,
        tags: Array.isArray(group.tags) ? group.tags : [],
        metadata: typeof group.metadata === 'string' ? JSON.parse(group.metadata) : group.metadata
      })),
      total,
      page,
      limit,
      has_more: offset + limit < total
    };
  }
);

/**
 * Update error group status and other properties
 */
export interface UpdateErrorGroupParams {
  group_id: number;
  status?: 'open' | 'resolved' | 'ignored' | 'investigating';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  assigned_to?: string;
  tags?: string[];
  resolution_notes?: string;
}

export const updateErrorGroupStatus = api<UpdateErrorGroupParams, { success: boolean }>(
  { expose: true, method: "PATCH", path: "/api/intelligence/error-groups/:group_id" },
  async (params) => {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (params.status) {
      updates.push(`status = $${paramIndex}`);
      values.push(params.status);
      paramIndex++;
    }
    
    if (params.priority) {
      updates.push(`priority = $${paramIndex}`);
      values.push(params.priority);
      paramIndex++;
    }
    
    if (params.assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramIndex}`);
      values.push(params.assigned_to);
      paramIndex++;
    }
    
    if (params.tags) {
      updates.push(`tags = $${paramIndex}`);
      values.push(JSON.stringify(params.tags));
      paramIndex++;
    }
    
    if (params.resolution_notes) {
      updates.push(`metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{resolution_notes}', $${paramIndex})`);
      values.push(JSON.stringify(params.resolution_notes));
      paramIndex++;
    }
    
    updates.push("updated_at = NOW()");
    
    const query = `
      UPDATE error_groups 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `;
    
    await db.rawQuery(query, ...values, params.group_id);
    
    return { success: true };
  }
);

/**
 * Helper function to update error group statistics
 */
async function updateErrorGroup(groupId: number, userId?: string): Promise<void> {
  const userIncrement = userId ? 1 : 0;
  
  await db.exec`
    UPDATE error_groups 
    SET 
      last_seen = NOW(),
      total_occurrences = total_occurrences + 1,
      unique_users = CASE 
        WHEN ${userIncrement} > 0 THEN unique_users + ${userIncrement}
        ELSE unique_users
      END,
      updated_at = NOW()
    WHERE id = ${groupId}
  `;
}

/**
 * Helper function to update error statistics for trend analysis
 */
async function updateErrorStatistics(
  projectId: number, 
  errorGroupId: number, 
  userId?: string, 
  sessionId?: string
): Promise<void> {
  const timeBucket = new Date();
  timeBucket.setMinutes(0, 0, 0); // Round to nearest hour
  
  // Upsert hourly statistics
  await db.exec`
    INSERT INTO error_statistics (
      project_id, error_group_id, time_bucket, error_count,
      unique_users, unique_sessions
    ) VALUES (
      ${projectId}, ${errorGroupId}, ${timeBucket}, 1,
      ${userId ? 1 : 0}, ${sessionId ? 1 : 0}
    )
    ON CONFLICT (project_id, error_group_id, time_bucket)
    DO UPDATE SET
      error_count = error_statistics.error_count + 1,
      unique_users = error_statistics.unique_users + ${userId ? 1 : 0},
      unique_sessions = error_statistics.unique_sessions + ${sessionId ? 1 : 0}
  `;
}