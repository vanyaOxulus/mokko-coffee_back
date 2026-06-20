const getUser = async (telegramId) => {
  try {
    const token = encodeURIComponent(process.env.POSTER_TOKEN);
    const url = `${process.env.POSTER_API_URL}/clients.getClients?token=${token}`;

    const posterResponse = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const text = await posterResponse.text();

    let data;
    data = JSON.parse(text).response;
    console.log(
      `[Poster] Loaded ${Array.isArray(data) ? data.length : 0} clients while checking telegram id ${telegramId}`,
    );

    const user = data.filter((user) =>
      user.comment?.includes(`telegram_id:${telegramId}`),
    );
    if (user && user.length > 0) {
      console.log(`[Poster] Found user for telegram id ${telegramId}`);
      return user;
    }
    console.log(`[Poster] No user found for telegram id ${telegramId}`);
    return;
  } catch (error) {
    console.error("Poster client lookup error:", error);
  }
};

export default getUser;
