const createUser = async (name, phone, telegramId) => {
  try {
    if (!name || !phone) {
      throw new Error("name and phone are required");
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
        cardNumber: telegramId,
        comment: telegramId ? `telegram_id:${telegramId}` : "",
      }),
    });

    const text = await posterResponse.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!posterResponse.ok || data?.error) {
      console.log("[Poster] Client create request failed");
      return;
    }

    console.log(
      `[Poster] Client create request completed for telegram id ${telegramId}`,
    );
  } catch (error) {
    console.error("Poster client create error:", error);
  }
};

export default createUser;
