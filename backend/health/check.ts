import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const db = SQLDatabase.named("revi");

export interface HealthCheckResponse {
  status: "healthy" | "unhealthy";
  timestamp: Date;
  checks: {
    database: "healthy" | "unhealthy";
  };
}

// Health check endpoint for monitoring system availability.
export const healthCheck = api<void, HealthCheckResponse>(
  { expose: true, method: "GET", path: "/health" },
  async () => {
    let dbStatus: "healthy" | "unhealthy" = "healthy";
    
    try {
      await db.queryRow`SELECT 1`;
    } catch (error) {
      dbStatus = "unhealthy";
    }
    
    const overallStatus = dbStatus === "healthy" ? "healthy" : "unhealthy";
    
    return {
      status: overallStatus,
      timestamp: new Date(),
      checks: {
        database: dbStatus
      }
    };
  }
);
