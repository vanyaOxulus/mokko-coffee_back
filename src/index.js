import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
require("./bot/bot");

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Cafe loyalty backend is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
