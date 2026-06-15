import dotenv from "dotenv";

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
    console.log("Poster raw response:", text);

    let data;
    data = JSON.parse(text).response;
    console.log("Response data:", data);

    console.log("Ищем ID:", `telegram_id:${telegramId}`);
    data.forEach((u) => console.log("В базе данных:", u.comment));

    const user = data.filter((user) =>
      user.comment.includes(`telegram_id:${telegramId}`),
    );
    if (user && user.length > 0) {
      console.log("Found user:", user);
      return user;
    }
    console.log("No user with provided telegram id was found");
    return;
  } catch (error) {
    console.error("Poster client create error:", error);
  }
};

export default getUser;
