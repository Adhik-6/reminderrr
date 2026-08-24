import { Router } from "express";
import { db } from "../db/database";
import { MetricsService } from "../services/metricsService";

const router = Router();
const metrics = new MetricsService(db);

router.get("/summary", (_, res) => {
  res.json({
    success: true,
    data: metrics.getSummary()
  });
});

export default router;