import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';

const app = express();
const PORT = 8000;

// Initialize Database connection (pointing to backend/data/my_database.sqlite)
const dbPath = path.resolve(__dirname, '../../data/my_database.sqlite');
const db = new Database(dbPath, { readonly: true });

// Middleware
app.use(cors());
app.use(express.json());

// ==========================================
// ROUTES
// ==========================================

// 1. Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 2. Get Upcoming Appointments (Joined with Resident details)
app.get('/appointments/upcoming', (req, res) => {
    try {
        // First try to fetch appointments scheduled from today onwards
        const stmt = db.prepare(`
            SELECT 
                a.appointment_id,
                a.resident_id,
                a.scheduled_at,
                a.location,
                a.service_type,
                a.status,
                c.name AS resident_name,
                c.mobile,
                c.email
            FROM appointments a
            LEFT JOIN contacts c ON a.resident_id = c.resident_id
            WHERE a.scheduled_at >= datetime('now')
            ORDER BY a.scheduled_at ASC
            LIMIT 50
        `);
        
        let upcomingAppointments = stmt.all();

        // Fallback: If no future dates relative to current time exist, return all sorted by date
        if (upcomingAppointments.length === 0) {
            const fallbackStmt = db.prepare(`
                SELECT 
                    a.appointment_id,
                    a.resident_id,
                    a.scheduled_at,
                    a.location,
                    a.service_type,
                    a.status,
                    c.name AS resident_name,
                    c.mobile,
                    c.email
                FROM appointments a
                LEFT JOIN contacts c ON a.resident_id = c.resident_id
                ORDER BY a.scheduled_at ASC
                LIMIT 50
            `);
            upcomingAppointments = fallbackStmt.all();
        }

        res.json({ 
            success: true, 
            count: upcomingAppointments.length, 
            data: upcomingAppointments 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Database query failed' });
    }
});

// 3. Get Joined Resident Info by ID (e.g. /resident/RS-4000 or /resident/RS-4396)
app.get('/resident/:id', (req, res) => {
    const residentId = req.params.id;
    
    try {
        // Fetch contact details for the resident
        const residentStmt = db.prepare(`SELECT * FROM contacts WHERE resident_id = ?`);
        const resident = residentStmt.get(residentId);
        
        if (!resident) {
            res.status(404).json({ success: false, error: `Resident '${residentId}' not found` });
            return;
        }

        // Fetch all appointments for this specific resident
        const aptStmt = db.prepare(`
            SELECT appointment_id, scheduled_at, location, service_type, status 
            FROM appointments 
            WHERE resident_id = ? 
            ORDER BY scheduled_at DESC
        `);
        const appointments = aptStmt.all(residentId);
        
        // Return joined object containing resident contact details + their array of appointments
        res.json({
            success: true,
            data: {
                ...resident,
                appointments: appointments
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Database query failed' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});