import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import * as path from 'path';
import { db } from './database';

// CSV File paths
const APPOINTMENTS_CSV = path.resolve(__dirname, '../../../data/appointments.csv');
const CONTACTS_CSV = path.resolve(__dirname, '../../../data/contacts.csv');

/**
 * Reads a CSV file and inserts it into a dynamically created SQLite table.
 */
function importCsvToTable(csvFilePath: string, tableName: string) {
    console.log(`Reading data for table: '${tableName}'...`);
    
    // Check if file exists to prevent hard crashes
    if (!fs.existsSync(csvFilePath)) {
        console.error(`Error: File not found at ${csvFilePath}\n`);
        return;
    }

    // Read and parse the CSV file
    const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
    const records: Record<string, string>[] = parse(fileContent, {
        columns: true,          // Uses the first row as keys (headers)
        skip_empty_lines: true, 
        trim: true              // Removes extra whitespace around values
    });

    if (records.length === 0) {
        console.log(`No records found in ${csvFilePath}. Skipping table creation.\n`);
        return;
    }

    // 1. Extract headers to build the table schema dynamically
    const headers = Object.keys(records[0]);
    const columnsDef = headers.map(header => `"${header}" TEXT`).join(', '); // Defaulting to TEXT type
    
    // 2. Drop the existing table (if any) and create a new one
    db.exec(`DROP TABLE IF EXISTS "${tableName}";`);
    db.exec(`CREATE TABLE "${tableName}" (${columnsDef});`);

    // 3. Prepare the SQL Insert Statement
    const placeholders = headers.map(() => '?').join(', ');
    const insertSql = `INSERT INTO "${tableName}" (${headers.map(h => `"${h}"`).join(', ')}) VALUES (${placeholders})`;
    const insertStmt = db.prepare(insertSql);

    // 4. Wrap inserts in a transaction for performance gains
    const insertMany = db.transaction((rows: Record<string, string>[]) => {
        for (const row of rows) {
            const values = headers.map(header => {
                let val = row[header];
                // Normalize scheduled_at column to proper ISO string
                if (header === 'scheduled_at' && val) {
                    val = formatToIsoDate(val);
                }
                return val;
            });
            insertStmt.run(values);
        }
    });

    // Execute the transaction
    insertMany(records);
    console.log(`Successfully imported ${records.length} rows into '${tableName}'.\n`);
}

function formatToIsoDate(dateStr: string): string {
    if (!dateStr) return dateStr;
    
    // Handles formats like "2026-03-02 09:00" or "2026-03-02 09:00:00"
    const parsedDate = new Date(dateStr.trim().replace(' ', 'T'));
    
    // Check if valid date, return ISO string without milliseconds
    if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('.')[0]; 
    }
    return dateStr; // fallback if parsing fails
}

/**
 * Initializes persistent tables, migrations, and performance indexes.
 */
function setupDatabaseSchema() {
    console.log('Setting up persistent tables and indexes...');

    // 1. Create persistent tables (IF NOT EXISTS preserves existing log, queue, and blocklist data across CSV re-imports)
    db.exec(`
        CREATE TABLE IF NOT EXISTS delivery_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resident_id TEXT,
            appointment_id TEXT,
            channel TEXT,
            status TEXT,
            detail TEXT,
            attempted_at TEXT,
            body_preview TEXT
        );

        CREATE TABLE IF NOT EXISTS reminder_queue (
            job_id INTEGER PRIMARY KEY AUTOINCREMENT,
            resident_id TEXT NOT NULL,
            appointment_id TEXT NOT NULL,
            scheduled_for TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            attempt INTEGER NOT NULL DEFAULT 1,
            current_channel TEXT,
            next_attempt_at TEXT,
            fallback_index INTEGER DEFAULT 0,
            last_error TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            processed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS blocked_contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resident_id TEXT NOT NULL,
            appointment_id TEXT NOT NULL,
            blocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
            reason TEXT NOT NULL,
            contacts_last_7_days INTEGER NOT NULL
        );
    `);

    // 2. Run inline migrations for existing databases missing these columns
    const columnsToEnsure = [
        { name: 'current_channel', type: 'TEXT' },
        { name: 'next_attempt_at', type: 'TEXT' },
        { name: 'fallback_index', type: 'INTEGER DEFAULT 0' },
        { name: 'last_error', type: 'TEXT' }
    ];

    for (const col of columnsToEnsure) {
        try {
            db.exec(`ALTER TABLE reminder_queue ADD COLUMN ${col.name} ${col.type};`);
        } catch {
            // Ignore error if column already exists in table
        }
    }

    // 3. Create performance indexes
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_contacts_resident_id 
        ON contacts (resident_id);

        CREATE INDEX IF NOT EXISTS idx_appointments_resident_id 
        ON appointments (resident_id);

        CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at 
        ON appointments (scheduled_at);

        CREATE INDEX IF NOT EXISTS idx_queue_status_time
        ON reminder_queue(status, scheduled_for);

        CREATE INDEX IF NOT EXISTS idx_blocked_contacts_resident_id
        ON blocked_contacts(resident_id);
    `);

    console.log('✅ Persistent tables and indexes ready.\n');
}

// Execute the script workflow
try {
    // Import CSVs (Recreates contacts and appointments)
    importCsvToTable(CONTACTS_CSV, 'contacts');
    importCsvToTable(APPOINTMENTS_CSV, 'appointments');

    // Setup persistent tables and indexes
    setupDatabaseSchema();

    console.log(`✅ All imports finished!`);
} catch (error) {
    console.error('An error occurred during import:', error);
} finally {
    // Safely close the database connection when CLI import finishes
    db.close();
}