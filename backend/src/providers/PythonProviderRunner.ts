import { spawn } from "child_process";
import path from "path";
import { ReminderPayload, SendResult } from "./types";

export function runPythonProvider(
  channel: "sms" | "voice" | "email",
  payload: ReminderPayload
): Promise<SendResult> {

  return new Promise((resolve, reject) => {

    const script = path.resolve(
      __dirname,
      "../../../channels/provider_cli.py"
    );

    const python = spawn("python", [
      script,
      channel,
      payload.recipient,
      payload.body,
      payload.at.toISOString(),
      payload.attempt.toString()
    ]);

    let stdout = "";
    let stderr = "";

    python.stdout.on("data", data => stdout += data.toString());
    python.stderr.on("data", data => stderr += data.toString());

    python.on("close", code => {

      if (code !== 0) {
        return reject(new Error(stderr || "Python provider failed"));
      }

      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("Invalid JSON from Python provider."));
      }

    });

  });

}