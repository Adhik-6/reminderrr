import { Router } from "express";
import { db } from "../db/database";

const router = Router();

router.get('/:id', (req, res) => {
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

export default router;