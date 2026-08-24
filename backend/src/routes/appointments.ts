import express from "express";
import { db } from "../db/database";

const router = express.Router();

router.get('/upcoming', (req, res) => {
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

export default router;