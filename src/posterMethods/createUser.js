import dotenv from "dotenv";

const createUser = async (name, phone, telegramId) => {
  try {
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
      console.log("Poster client create error");
    }
  } catch (error) {
    console.error("Poster client create error:", error);
  }
};

export default createUser;
