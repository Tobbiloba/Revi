import { api } from "encore.dev/api";
import { db } from "./db";
import { randomBytes } from "crypto";

export interface CreateProjectRequest {
  name: string;
}

export interface Project {
  id: number;
  name: string;
  api_key: string;
  created_at: Date;
  updated_at: Date;
}

// Creates a new project and returns it with the generated API key.
export const create = api<CreateProjectRequest, { success: true; project: Project }>(
  { expose: true, method: "POST", path: "/api/projects" },
  async (req) => {
    const apiKey = generateApiKey();
    
    const project = await db.queryRow<Project>`
      INSERT INTO projects (name, api_key, updated_at)
      VALUES (${req.name}, ${apiKey}, NOW())
      RETURNING id, name, api_key, created_at, updated_at
    `;
    
    if (!project) {
      throw new Error("Failed to create project");
    }
    
    return { success: true, project };
  }
);

function generateApiKey(): string {
  return `revi_${randomBytes(32).toString('hex')}`;
}
