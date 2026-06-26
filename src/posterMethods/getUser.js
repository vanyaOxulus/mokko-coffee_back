const toNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const toPosterMoney = (value) => toNumber(value) / 100;

const firstDefined = (source, keys) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) {
      return source[key];
    }
  }

  return undefined;
};

const normalizeId = (value) => String(value ?? "").trim();

export const normalizePosterClient = (client) => {
  if (!client) {
    return null;
  }

  const firstName = firstDefined(client, ["firstname", "first_name"]);
  const lastName = firstDefined(client, ["lastname", "last_name"]);
  const composedName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    posterId: firstDefined(client, ["client_id", "id"]),
    userID: normalizeId(client.card_number),
    name:
      firstDefined(client, ["client_name", "name", "fullname", "full_name"]) ||
      composedName,
    phone: firstDefined(client, ["phone", "phone_number", "mobile"]),
    bonuses: toPosterMoney(
      firstDefined(client, [
        "bonus",
        "bonuses",
        "points",
        "loyalty_bonus",
        "client_bonus",
        "account_balance",
      ]),
    ),
    totalSpent: toPosterMoney(
      firstDefined(client, [
        "total_payed",
        "total_payed_sum",
        "total_paid",
        "totalPayed",
        "totalPaid",
        "payed_sum",
        "paid_sum",
        "total_sum",
        "total_amount",
        "turnover",
        "purchases_sum",
      ]),
    ),
  };
};

export const getPosterClientByTelegramId = async (telegramId) => {
  const normalizedTelegramId = normalizeId(telegramId);
  const users = await getUser(normalizedTelegramId);
  const client = normalizePosterClient(users?.[0]);

  if (client) {
    client.userID = normalizedTelegramId;
  }

  return client;
};

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

    if (!posterResponse.ok) {
      console.log(
        `[Poster] Client lookup failed with status ${posterResponse.status}: ${text}`,
      );
      return;
    }

    let data;
    const parsedResponse = JSON.parse(text);

    if (parsedResponse?.error) {
      console.log("[Poster] Client lookup returned error:", parsedResponse);
      return;
    }

    data = parsedResponse.response;

    if (!Array.isArray(data)) {
      console.log("[Poster] Unexpected clients response shape");
      return;
    }

    console.log(
      `[Poster] Loaded ${data.length} clients while checking telegram id ${telegramId}`,
    );

    const normalizedTelegramId = normalizeId(telegramId);
    const user = data.filter((user) => {
      const cardNumber = normalizeId(user.card_number);
      const legacyComment = normalizeId(user.comment);

      return (
        cardNumber === normalizedTelegramId ||
        legacyComment.includes(`telegram_id:${normalizedTelegramId}`)
      );
    });
    if (user && user.length > 0) {
      console.log(`[Poster] Found user for telegram id ${telegramId}`);
      return user;
    }
    console.log(
      `[Poster] No user found for telegram id ${telegramId}. Sample card numbers:`,
      data.slice(0, 5).map((client) => ({
        client_id: client.client_id,
        card_number: client.card_number,
        phone: client.phone,
      })),
    );
    return;
  } catch (error) {
    console.error("Poster client lookup error:", error);
  }
};

export default getUser;
