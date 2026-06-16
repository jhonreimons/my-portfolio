const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "my-portfolio",
    timestamp: new Date().toISOString()
  });
});

// Fallback to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Listen only on localhost. Nginx will expose it publicly.
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Portfolio app running on http://127.0.0.1:${PORT}`);
});
