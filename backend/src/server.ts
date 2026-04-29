import "dotenv/config";
import express from "express";
import cors from "cors";
import searchRoutes from "./routes/search.js";
import pageFirstRoutes from "./routes/pageFirstIntake.js";

const app = express();
const PORT = process.env.PORT || 5000;
const NXTLVL_API_URL = process.env.NXTLVL_API_URL || "http://localhost:4000";

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:8080",
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Search routes (local)
app.use("/api", searchRoutes);

// Page-first intake routes
app.use("/api", pageFirstRoutes);

// Proxy document routes to nxt-lvl-api
app.use("/api/documents", express.json({ limit: "50mb" }), async (req, res) => {
  try {
    const { method, path, headers, body } = req;
    const forwardUrl = `${NXTLVL_API_URL}/api/docs${path}`;

    // Forward authorization header
    const forwardHeaders: Record<string, string> = {
      "content-type": "application/json",
    };
    if (headers.authorization) {
      forwardHeaders.authorization = headers.authorization;
    }

    const response = await fetch(forwardUrl, {
      method,
      headers: forwardHeaders,
      body: ["POST", "PUT", "PATCH"].includes(method) ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({ error: "Failed to forward request to nxt-lvl-api" });
  }
});

// Proxy file upload to nxt-lvl-api
app.post("/api/upload", async (req, res) => {
  try {
    const { authorization } = req.headers;
    if (!authorization) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const forwardUrl = `${NXTLVL_API_URL}/api/docs/upload`;
    const response = await fetch(forwardUrl, {
      method: "POST",
      headers: {
        authorization,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Upload proxy error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Community Chronicle backend running on port ${PORT}`);
  console.log(`Proxying to nxt-lvl-api at ${NXTLVL_API_URL}`);
});
