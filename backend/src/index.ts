import express from 'express';
import cors from 'cors';
import { db } from './db/database';
import { PolicyEngine } from "./policy/PolicyEngine";
import { ReminderContext } from "./policy/types";

const app = express();
const PORT = 8000;
const policyEngine = new PolicyEngine();

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

// 2. Get Upcoming Appointments
app.get('/appointments/upcoming', (req, res) => {
    try {
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
            ORDER BY a.scheduled_at ASC
            LIMIT 50
        `);
        
        const appointments = stmt.all();
        res.json({ success: true, count: appointments.length, data: appointments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Database query failed' });
    }
});

// 3. Get Resident Info
app.get('/resident/:id', (req, res) => {
    const residentId = req.params.id;
    try {
        const resident = db.prepare(`SELECT * FROM contacts WHERE resident_id = ?`).get(residentId);
        
        if (!resident) {
            res.status(404).json({ success: false, error: `Resident '${residentId}' not found` });
            return;
        }

        const appointments = db.prepare(`
            SELECT appointment_id, scheduled_at, location, service_type, status 
            FROM appointments 
            WHERE resident_id = ? 
            ORDER BY scheduled_at DESC
        `).all(residentId);
        
        res.json({
            success: true,
            data: {
                ...resident,
                appointments
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Database query failed' });
    }
});

app.post("/policy/evaluate", (req, res) => {

  const { residentId, appointmentId } = req.body;

  try {

    const resident = db.prepare(
      `SELECT * FROM contacts WHERE resident_id = ?`
    ).get(residentId);

    const appointment = db.prepare(
      `SELECT * FROM appointments WHERE appointment_id = ?`
    ).get(appointmentId);

    if (!resident || !appointment) {
      return res.status(404).json({
        success: false,
        error: "Resident or appointment not found."
      });
    }

    const context: ReminderContext = {
      resident: resident as any,
      appointment: appointment as any,
      now: new Date()
    };

    const decision = policyEngine.evaluate(context);

    res.json({
      success: true,
      context,
      decision
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Policy evaluation failed."
    });
  }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});