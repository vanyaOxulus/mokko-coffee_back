import { Composer } from "telegraf";
import { welcomeMessage, validationSchema } from "./validation.js";
import createPosterUser from "../posterMethods/createUser.js";
import getUser from "../posterMethods/getUser.js";

const userData = {};
const userComposer = new Composer();

const phoneKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: "📱 Поділитись номером", request_contact: true }],
      [{ text: "Ввести номер вручну" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
};

const removeKeyboard = {
  reply_markup: {
    remove_keyboard: true,
  },
};

const formatUkrainianPhone = (rawPhone) => {
  let cleaned = rawPhone.replace(/[\s\-\(\)\+]/g, "");

  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "38" + cleaned;
  } else if (!cleaned.startsWith("380") && cleaned.length === 9) {
    cleaned = "380" + cleaned;
  }

  if (cleaned.startsWith("380") && cleaned.length === 12) {
    return "+" + cleaned;
  }

  return "+" + cleaned;
};

const checkIfUserExists = async (userId) => {
  try {
    const posterUser = await getUser(userId);
    const hasPosterUser = posterUser && posterUser.length > 0;

    console.log(`[Check User ${userId}] Poster: ${hasPosterUser}`);

    return hasPosterUser;
  } catch (error) {
    console.error(`Ошибка при проверке пользователя ${userId}:`, error);
    return false;
  }
};

const handlePhone = async (ctx, userId, phone) => {
  try {
    const formattedPhone = formatUkrainianPhone(phone);
    await validationSchema.validateAt("phone", { phone: formattedPhone });

    await createPosterUser(userData[userId].name, formattedPhone, userId);

    await ctx.reply("Дякую, номер прийнято!", removeKeyboard);

    await ctx.reply(
      "Ваша заявка на створення профілю прийнята.\nТепер ви можете користуватись застосунком. Натисніть кнопку нижче, щоб відкрити додаток та зануритися в атмосферу Mokko!",
    );

    delete userData[userId];
  } catch (err) {
    await ctx.reply(err.message);
  }
};

userComposer.start(async (ctx) => {
  const userId = ctx.chat.id;

  const isRegistered = await checkIfUserExists(userId);
  if (isRegistered) {
    return ctx.reply(
      "Ви вже зареєстровані.\n\nВідкрийте застосунок та почніть користуватись знижками.",
    );
  }

  userData[userId] = { stage: "name" };
  await ctx.reply(welcomeMessage);
  await ctx.reply("Будь-ласка напишіть ваше ім'я та прізвище");
});

userComposer.on("text", async (ctx) => {
  const userId = ctx.chat.id;
  const text = ctx.message.text ? ctx.message.text.trim() : "";

  if (!userData[userId]) {
    const isRegistered = await checkIfUserExists(userId);
    if (isRegistered) {
      return ctx.reply(
        "Ви вже зареєстровані.\n\nВідкрийте застосунок та почніть користуватись знижками.",
      );
    }
    return ctx.reply("Будь ласка, натисніть /start для реєстрації.");
  }

  const userState = userData[userId];

  switch (userState.stage) {
    case "name":
      try {
        await validationSchema.validateAt("fullName", { fullName: text });
        userData[userId].name = text;
        userData[userId].stage = "phone";
        await ctx.reply(
          "Дякую, прийнято!\nТепер поділіться номером телефону або введіть його вручну.",
          phoneKeyboard,
        );
      } catch (err) {
        await ctx.reply(err.message);
      }
      break;

    case "phone":
      if (text === "Ввести номер вручну") {
        await ctx.reply("Напишіть ваш номер телефону повідомленням.");
        break;
      }

      await handlePhone(ctx, userId, text);
      break;

    default:
      await ctx.reply(
        "Вибачте, я вас не розумію. Напишіть /start для початку реєстрації.",
      );
      break;
  }
});

userComposer.on("contact", async (ctx) => {
  const userId = ctx.chat.id;

  if (!userData[userId]) {
    const isRegistered = await checkIfUserExists(userId);
    if (isRegistered) {
      return ctx.reply(
        "Ви вже зареєстровані.\n\nВідкрийте застосунок та почніть користуватись знижками.",
      );
    }
    return ctx.reply("Будь ласка, натисніть /start для реєстрації.");
  }

  const userState = userData[userId];

  if (userState.stage !== "phone") {
    return ctx.reply(
      "Вибачте, я вас не розумію. Напишіть /start для початку реєстрації.",
    );
  }

  await handlePhone(ctx, userId, ctx.message.contact.phone_number);
});

export { userComposer as userScenary };
