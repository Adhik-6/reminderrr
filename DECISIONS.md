# DECISIONS

## What I chose

### Tech Stack

- **Backend:** Node.js with Express and TypeScript. Although the provided simulation code was written in Python, I chose Node.js because I was more familiar with it, allowing faster development while still integrating with the provided Python simulator.
- **Database:** SQLite. The provided CSV data mapped naturally to relational tables, required almost no setup, and made the project easy for judges to run locally.
- **Queueing:** A custom SQLite-backed queue with a background worker. I initially planned to use BullMQ with Redis, but replaced it with SQLite to remove external dependencies while still supporting delayed jobs, retries, and fallback logic.

### Architecture

- Imported the provided CSV files into SQLite instead of reading CSVs directly at runtime.
- Built a modular Policy Engine where each rule lives in its own file, making it easier to extend for the Day 2 surprise challenge.
- Used `delivery_log` as the source of truth for auditing every outbound attempt and for calculating the rolling seven-day contact limit.
- Added `blocked_contacts` to record reminders withheld due to the regulator's limit.

### API Design

- Added `GET /fetch` to retrieve appointments matching specific conditions, making it easier to test edge cases without manually editing the database.
- Separated Express routes into individual modules instead of keeping everything in `index.ts` for better maintainability.

### Database Optimizations

Created indexes on:

- `contacts(resident_id)`
- `appointments(resident_id)`
- `appointments(scheduled_at)`

to speed up common lookups.

---

## What I rejected and why

- **Python backend:** Rejected despite the provided simulator because switching stacks would have slowed development.
- **MongoDB:** Rejected because relational queries suited the dataset better.
- **PostgreSQL/MySQL:** Rejected because they required additional setup that wasn't necessary for this project's scale.
- **BullMQ + Redis:** Rejected in the final implementation because requiring Redis would make the project harder to run for judges.

---

## What I cut for time

- A frontend dashboard for live queue monitoring.
- Real translated message templates (used language indicators instead).
- Dynamic worker sleep scheduling instead of a one-second polling interval.
- More advanced retry policies with exponential backoff.
- Appointment prioritization when multiple reminders compete for the remaining contact allowance.

---

## What my solution does not do

- It does not send real SMS, voice calls, or emails; it uses the provided Python simulation.
- It does not provide a production-grade distributed queue.
- It does not translate reminder text into multiple languages.
- It does not guarantee fairness beyond the implemented regulatory rules when multiple appointments compete for contact limits.

---

## What I would fix first

1. Replace the polling worker with an event-driven scheduler.
2. Add real multilingual templates.
3. Build a frontend analytics dashboard showing queue status, delivery outcomes, and compliance metrics.
4. Improve retry behavior using adaptive backoff based on provider failures.
5. Add configurable prioritization for appointments affected by contact limits.