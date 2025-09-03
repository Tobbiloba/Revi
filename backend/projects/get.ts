import { api, APIError } from "encore.dev/api";
import { db } from "./db";

export interface GetProjectParams {
  id: number;
}

export interface Project {
  id: number;
  name: string;
  api_key: string;
  created_at: Date;
  updated_at: Date;
}

// Retrieves project details by ID.
export const get = api<GetProjectParams, { success: true; project: Project }>(
  { expose: true, method: "GET", path: "/api/projects/:id" },
  async (params) => {
    const project = await db.queryRow<Project>`
      SELECT id, name, api_key, created_at, updated_at
      FROM projects
      WHERE id = ${params.id}
    `;
    
    if (!project) {
      throw APIError.notFound("project not found");
    }
    
    return { success: true, project };
  }
);
