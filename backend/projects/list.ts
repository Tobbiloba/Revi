import { api, Query } from "encore.dev/api";
import { db } from "./db";

export interface ListProjectsParams {
  page?: Query<number>;
  limit?: Query<number>;
}

export interface Project {
  id: number;
  name: string;
  api_key: string;
  created_at: Date;
  updated_at: Date;
  error_count?: number;
  session_count?: number;
}

export interface ListProjectsResponse {
  success: true;
  projects: Project[];
  total?: number;
  page?: number;
  limit?: number;
}

// Lists all projects with optional pagination and basic statistics.
export const listProjects = api<ListProjectsParams, ListProjectsResponse>(
  { expose: true, method: "GET", path: "/api/projects" },
  async (params) => {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const offset = (page - 1) * limit;
    
    // Get total count
    const countResult = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM projects
    `;
    
    const total = countResult?.count || 0;
    
    // Get projects with basic stats
    const projects = await db.queryAll<{
      id: number;
      name: string;
      api_key: string;
      created_at: Date;
      updated_at: Date;
      error_count: number;
      session_count: number;
    }>`
      SELECT 
        p.id, p.name, p.api_key, p.created_at, p.updated_at,
        COALESCE(error_stats.error_count, 0) as error_count,
        COALESCE(session_stats.session_count, 0) as session_count
      FROM projects p
      LEFT JOIN (
        SELECT project_id, COUNT(*) as error_count
        FROM errors
        WHERE timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY project_id
      ) error_stats ON p.id = error_stats.project_id
      LEFT JOIN (
        SELECT project_id, COUNT(DISTINCT session_id) as session_count
        FROM sessions
        WHERE started_at >= NOW() - INTERVAL '30 days'
        GROUP BY project_id
      ) session_stats ON p.id = session_stats.project_id
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    return {
      success: true,
      projects: projects.map(project => ({
        ...project,
        error_count: Number(project.error_count),
        session_count: Number(project.session_count)
      })),
      total,
      page,
      limit
    };
  }
);