import "./db/user_db.js";
import "./bot/bot.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getUserById } from "./db/user_db.js";
import { getAllCards } from "./db/cards_db.js";

dotenv.config();

console.log("POSTER_API_URL:", process.env.POSTER_API_URL);
console.log("TOKEN EXISTS:", !!process.env.POSTER_TOKEN);
console.log(
  "REQUEST URL WITHOUT TOKEN:",
  `${process.env.POSTER_API_URL}/clients.create`,
);

const app = express();

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

app.get("/api/users/:userID", (req, res) => {
  try {
    const { userID } = req.params;

    const user = getUserById(Number(userID));

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.json({
      message: "User info received",
      user,
    });
  } catch (error) {
    console.error("Get user error:", error);

    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

app.get("/api/cards", (req, res) => {
  try {
    const cards = getAllCards();

    res.json({
      message: "Cards fetched successfully",
      cards,
    });
  } catch (error) {
    console.error("Get cards error:", error);

    res.status(500).json({
      message: "Server error while fetching cards",
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
