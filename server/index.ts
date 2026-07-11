import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { api } from "./api.ts";
import { dataDir } from "./store.ts";

const PORT = Number(process.env.PORT || 1969);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use("/api", api);

// Serve the built frontend when it exists (i.e. `npm run build` then `npm start`).
// In dev, Vite serves the frontend and proxies /api here.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*splat", (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Re-entry is ready  →  http://localhost:${PORT}`);
  console.log(`Your briefings live in ${dataDir()}`);
});
