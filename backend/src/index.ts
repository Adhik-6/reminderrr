import express from 'express';
import cors from 'cors';

import { healthRoutes, appointmentRoutes, residentRoutes, simulationRoutes, fetchRoutes, deliveryRoutes, policyRoutes } from "./routes/index";

const app = express();
const PORT = 8000;


// Middleware
app.use(cors());
app.use(express.json());

app.use("/health", healthRoutes);
app.use("/appointments", appointmentRoutes);
app.use("/resident", residentRoutes);
app.use("/simulation", simulationRoutes);
app.use("/fetch", fetchRoutes);  
app.use("/delivery", deliveryRoutes);
app.use("/policy", policyRoutes);


app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});