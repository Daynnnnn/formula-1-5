import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

export * from "./schema";

const databaseFile = process.env.DATABASE_FILE || "./db.sqlite";
const sqlite = new Database(databaseFile);
export const db = drizzle(sqlite);
