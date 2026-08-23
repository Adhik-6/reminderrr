import Database from 'better-sqlite3';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import * as path from 'path';

// File paths (adjust these if your script is in a different directory relative to /data)
const DB_PATH = path.resolve(__dirname, '../../../data/my_database.sqlite');
const APPOINTMENTS_CSV = path.resolve(__dirname, '../../../data/appointments.csv');
const CONTACTS_CSV = path.resolve(__dirname, '../../../data/contacts.csv');

// Initialize SQLite Database
const db = new Database(DB_PATH);

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

    // 4. Wrap inserts in a transaction for massive performance gains
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

// Execute the imports
try {
    importCsvToTable(CONTACTS_CSV, 'contacts');
    importCsvToTable(APPOINTMENTS_CSV, 'appointments');
    console.log(`✅ All imports finished! Database saved to: ${DB_PATH}`);
} catch (error) {
    console.error('An error occurred during import:', error);
} finally {
    // Always safely close the database connection
    db.close();
}