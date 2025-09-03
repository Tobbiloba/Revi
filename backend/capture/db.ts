import { SQLDatabase } from "encore.dev/storage/sqldb";

// OPTIMIZATION: Advanced connection pool - using standard Encore configuration for now
// TODO: Configure advanced connection pooling when Encore supports it
export const db = SQLDatabase.named("revi");
