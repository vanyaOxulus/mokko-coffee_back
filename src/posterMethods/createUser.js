const createUser = async (name, phone, telegramId) => {
  try {
    if (!name || !phone) {
      throw new Error("name and phone are required");
    }

    const token = encodeURIComponent(process.env.POSTER_TOKEN);
    const url = `${process.env.POSTER_API_URL}/clients.createClient?token=${token}`;

    const createClient = async (phoneValue) =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_name: name,
          client_groups_id_client: 7,
          phone: phoneValue,
          card_number: String(telegramId),
        }),
      });

    let posterResponse = await createClient(phone);
    const text = await posterResponse.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!posterResponse.ok || data?.error) {
      const phoneWithoutPlus = phone.startsWith("+") ? phone.slice(1) : phone;

      if (phoneWithoutPlus !== phone) {
        console.log("[Poster] Client create failed, retrying without plus:", {
          status: posterResponse.status,
          response: data,
        });

        posterResponse = await createClient(phoneWithoutPlus);
        const retryText = await posterResponse.text();

        try {
          data = JSON.parse(retryText);
        } catch {
          data = retryText;
        }
      }
    }

    if (!posterResponse.ok || data?.error) {
      console.log("[Poster] Client create request failed:", {
        status: posterResponse.status,
        response: data,
      });
      throw new Error("Не вдалося створити профіль. Спробуйте ще раз.");
    }

    console.log(
      `[Poster] Client create request completed for telegram id ${telegramId}`,
    );
    return data;
  } catch (error) {
    console.error("Poster client create error:", error);
    throw error;
  }
};

export default createUser;
