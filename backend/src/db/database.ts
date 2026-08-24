import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Path to SQLite DB file (located in backend/data/)
const dbPath = path.resolve(__dirname, '../../../data/my_database.sqlite');

// Ensure directory exists before initialization
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// Create and export a single shared database connection
export const db = new Database(dbPath, { 
    fileMustExist: false, // Ensures connection won't fail if DB isn't created yet
});

// Enable WAL mode (Write-Ahead Logging) for significantly better concurrency & performance
db.pragma('journal_mode = WAL');