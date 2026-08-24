import express from 'express';
import cors from 'cors';
import { db } from './db/database';
import { PolicyEngine } from "./policy/PolicyEngine";
import { ReminderContext } from "./policy/types";
import { ProviderFactory } from "./providers/providerFactory";
import { DeliveryLogger } from "./services/DeliveryLogger";

const app = express();
const PORT = 8000;
const policyEngine = new PolicyEngine();
const deliveryLogger = new DeliveryLogger(db);

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

app.post("/simulate/send", async (req, res) => {
  const { residentId, appointmentId, simulateTime } = req.body;

  try {
    const resident = db.prepare(
      `SELECT * FROM contacts WHERE resident_id = ?`
    ).get(residentId) as any;

    const appointment = db.prepare(
      `SELECT * FROM appointments WHERE appointment_id = ?`
    ).get(appointmentId) as any;

    if (!resident || !appointment) {
      return res.status(404).json({
        success: false,
        error: "Resident or appointment not found."
      });
    }

    const context: ReminderContext = {
      resident,
      appointment,
      now: simulateTime
        ? new Date(simulateTime)
        : new Date()
    };

    const decision = policyEngine.evaluate(context);

    if (!decision.allowed || !decision.channel) {
      return res.json({
        success: true,
        decision,
        providerResult: null
      });
    }

    const provider = ProviderFactory.get(decision.channel);
    const recipient =
      decision.channel === "email"
        ? resident.email
        : decision.channel === "voice"
        ? resident.landline || resident.mobile
        : resident.mobile;

    const body =
      `Reminder: Your ${appointment.service_type} appointment is scheduled for ` +
      `${appointment.scheduled_at}.`;

    const providerResult = await provider.send({
      recipient,
      body,
      at: context.now,
      attempt: 1
    });

    deliveryLogger.log({
      residentId: resident.resident_id,
      appointmentId: appointment.appointment_id,
      channel: decision.channel,
      status: providerResult.status,
      detail: providerResult.detail,
      attemptedAt: context.now,
      bodyPreview: body
    });

    res.json({
      success: true,
      decision,
      providerResult
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Simulation failed."
    });

  }

});

app.get("/delivery-log", (req, res) => {

  try {
    const logs = db.prepare(`
      SELECT
        id,
        resident_id,
        appointment_id,
        channel,
        status,
        detail,
        attempted_at,
        body_preview
      FROM delivery_log
      ORDER BY attempted_at DESC
      LIMIT 100
    `).all();

    res.json({
      success: true,
      count: logs.length,
      data: logs
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Could not fetch delivery log."
    });

  }

});

app.get("/fetch", (req, res) => {
  try {
    const {
      lang,
      sms_optout,
      voice_optout,
      email_optout,
      mobile,
      shared_mobile,
      appointments_gt
    } = req.query;

    let sql = `
      SELECT
        c.*,
        COUNT(a.appointment_id) AS appointment_count
      FROM contacts c
      LEFT JOIN appointments a
      ON c.resident_id = a.resident_id
    `;

    const where: string[] = [];
    const params: any[] = [];

    if (lang) {
      where.push("c.language = ?");
      params.push(lang);
    }
    if (sms_optout) {
      where.push("c.sms_optout = ?");
      params.push(sms_optout);
    }
    if (voice_optout) {
      where.push("c.voice_optout = ?");
      params.push(voice_optout);
    }
    if (email_optout) {
      where.push("c.email_optout = ?");
      params.push(email_optout);
    }
    if (mobile === "missing") {
      where.push("(c.mobile IS NULL OR c.mobile = '')");
    }
    if (shared_mobile === "true") {
      where.push(`
        c.mobile IN (
          SELECT mobile
          FROM contacts
          WHERE mobile IS NOT NULL
          AND mobile <> ''
          GROUP BY mobile
          HAVING COUNT(*) > 1
        )
      `);
    }
    if (where.length) sql += " WHERE " + where.join(" AND ");

    sql += `
      GROUP BY c.resident_id
    `;
    if (appointments_gt) {
      sql += ` HAVING appointment_count > ?`;
      params.push(Number(appointments_gt));
    }

    sql += ` ORDER BY c.resident_id LIMIT 100`;
    const rows = db.prepare(sql).all(...params);

    res.json({
      success: true,
      count: rows.length,
      filters: req.query,
      data: rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Fetch failed."
    });

  }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});