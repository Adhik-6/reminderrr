# Reminder That Reaches

A reminder system for Calder County that schedules appointment reminders, applies policy checks (quiet hours, opt-outs, preferred channels, and regulatory contact limits), retries failed deliveries, falls back across channels, and records every decision for auditing.

---

# Features

- CSV → SQLite data import
- Appointment reminder scheduling
- Policy Engine with modular rules
- SMS → Voice → Email fallback
- Retry handling
- Day 2 regulator compliance (rolling seven-day contact limit)
- Delivery audit logs
- Metrics dashboard

---

# Project Structure

```
backend/
frontend/
channels/          # Provided Python simulator
data/              # CSV files and SQLite database
```

---

# Prerequisites

- Node.js (v18+ recommended)
- Python 3

---

# Installation

Clone the repository.

## Install backend

```bash
cd backend
npm install
```

## Install frontend

```bash
cd ../frontend
npm install
```

---

# Initialize the database

From the backend directory:

```bash
npm run db:import
```

This imports:

- `contacts.csv`
- `appointments.csv`

into `data/my_database.sqlite`.

---

# Running the application

Open two terminals.

## Terminal 1

```bash
cd backend
npm run dev
```

Starts the Express server.

## Terminal 2

```bash
cd backend
npm run worker
```

Starts the reminder worker.

---

# Running the simulation

## Reset previous data

```http
DELETE /simulation/reset
```

## Queue every appointment

```http
POST /simulation/run-all
```

The worker will begin processing reminders automatically.

---

# View results

| Endpoint | Purpose |
|----------|---------|
| `GET /metrics/summary` | Overall performance metrics |
| `GET /delivery-log` | Delivery history |
| `GET /policy/evidence/:residentId` | Compliance evidence |
| `GET /fetch` | Find test cases |

inspect `data/outbox.jsonl` for the simulated provider output.
---

# Example Metrics
After processing the provided dataset, the system reports:
- Appointments processed
- Delivery success rate
- Coverage rate
- Channel performance
- Retry statistics
- Regulatory blocks
- Data quality insights

---

# Architecture
1. Import CSV data into SQLite.
2. Queue reminder jobs.
3. Worker claims due jobs.
4. Policy Engine evaluates quiet hours, opt-outs, preferred channels, and regulatory limits.
5. Provider simulation sends the reminder.
6. Retry or fallback occurs if needed.
7. Every decision is logged for auditing and metrics.

---

# Decision Tree
The decision tree followed by the worker:
```
FOR each due reminder

    Rebuild resident + appointment context

    IF quiet hours
        postpone reminder
        CONTINUE

    IF resident already has 2 contacts in rolling 7 days
        record blocked_contact
        mark completed
        CONTINUE

    Select preferred channel

    IF preferred channel unavailable
        choose next available channel

    IF channel opted out
        choose next available channel

    Send using Python provider

    IF result is delivered
        mark completed

    ELSE IF result is answered
        mark completed

    ELSE IF result is voicemail_left
        mark completed

    ELSE IF result is busy
        retry same channel after 10 minutes

    ELSE IF result is no_answer
        retry same channel after 15 minutes

    ELSE IF result is carrier_rejected
        retry SMS after 30 minutes

    ELSE IF result is soft_bounce
        retry Email after 1 hour

    ELSE IF result is no_number
        immediately switch to next channel

    ELSE IF result is hard_bounce
        switch to next channel

    ELSE IF no channels remain
        mark permanently failed

END
```
---

# Data Flow
The system follows a complete reminder lifecycle, from importing the provided dataset to generating compliance reports and performance metrics.

### Step 1 – Import the dataset
The provided contacts.csv and appointments.csv files are imported into SQLite during setup. Using SQLite instead of reading CSV files directly makes querying faster, simplifies joins between residents and appointments, and provides a single source of truth for the application.

### Step 2 – Start the application
Two processes are started:
- **Express Backend** – exposes REST APIs for scheduling reminders, testing scenarios, viewing logs, and generating metrics.
- **Reminder Worker** – continuously processes scheduled reminder jobs in the background.

### Step 3 – Queue reminder jobs
For demonstrations, the endpoint POST /simulation/run-all reads all 940 appointments from the database and inserts them into the reminder_queue table.
The queue stores information such as:
- Resident ID
- Appointment ID
- Scheduled execution time
- Retry attempt count
- Current fallback channel
This allows reminders to be processed independently of the original appointment data.

### Step 4 – Worker claims due jobs
Every second, the worker checks the queue for reminders whose scheduled time has arrived. Due jobs are claimed inside a SQLite transaction so that the same reminder cannot be processed twice.

### Step 5 – Reconstruct reminder context
Using the resident ID and appointment ID, the ReminderService rebuilds the complete reminder context by joining data from the contacts and appointments tables.
This provides all information required for policy evaluation, including contact details, preferred language, communication preferences, and appointment information.

### Step 6 – Policy Engine evaluates the reminder
The reminder passes through a sequence of independent policy rules.
1. **Quiet Hours** – postpones reminders sent during restricted hours.
2. **Rolling Seven-Day Contact Limit** – blocks reminders when a resident has already received two contacts within the previous seven days.
3. **Channel Selection** – selects the most appropriate communication channel.
4. **Opt-Out Checks** – respects channel-specific communication preferences.
5. **Language Selection** – chooses the reminder language based on resident preferences.
If any rule blocks the reminder, the reason is recorded and no provider is contacted.

### Step 7 – Send through the Python provider
If the reminder is approved, the selected provider (SMS, Voice, or Email) is invoked through the provided Python simulator (channels.py).
The provider returns realistic outcomes such as:
- Delivered
- Answered
- Voicemail left
- Busy
- No answer
- Carrier rejected
- Unroutable landline

### Step 8 – Retry or fallback
The worker reacts to the provider's result instead of treating all failures equally.
- Temporary failures are retried after a delay.
- Missing numbers or hard failures trigger fallback to another available channel.
- Successful deliveries complete the reminder.
- Permanent failures are recorded after all available channels have been exhausted.

### Step 9 – Record every decision
Every reminder attempt is recorded in `delivery_log`, while reminders blocked by the regulator are stored in `blocked_contacts`.
These records provide a complete audit trail for compliance.

### Step 10 – Generate metrics
The `MetricsService` analyzes the recorded history to produce operational metrics such as:
- Delivery success rate
- Appointment coverage rate
- Channel performance
- Retry statistics
- Regulatory blocks
- Data quality insights

# AI Usage

See `AI-USAGE.md`.

# Design Decisions

See `DECISIONS.md`.