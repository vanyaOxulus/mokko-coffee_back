import express from "express";
import cors from "cors";
import dotenv from "dotenv";

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

app.post("/api/poster/clients", async (req, res) => {
  try {
    const { name, phone, telegramId } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        message: "name and phone are required",
      });
    }

    const token = encodeURIComponent(process.env.POSTER_TOKEN);
    const url = `${process.env.POSTER_API_URL}/clients.createClient?token=${token}`;

    const posterResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_name: name,
        client_groups_id_client: "3",
        phone: phone,
        comment: telegramId ? `telegram_id:${telegramId}` : "",
      }),
    });

    const text = await posterResponse.text();
    console.log("Poster raw response:", text);

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!posterResponse.ok || data?.error) {
      return res.status(400).json({
        message: "Poster client create error",
        poster: data,
      });
    }

    res.status(201).json({
      message: "Client created in Poster",
      poster: data,
    });
  } catch (error) {
    console.error("Poster client create error:", error);

    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
