// Use the shared database instance from projects service
// This avoids creating a separate database and uses the existing migrations
export { db } from "../projects/db";