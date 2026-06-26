import { Composer } from "telegraf";
import { welcomeMessage, validationSchema } from "./validation.js";
import { createUser } from "../db/user_db.js";
import createPosterUser from "../posterMethods/createUser.js";
import getUser from "../posterMethods/getUser.js";

const userData = {};
const userComposer = new Composer();

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
        await ctx.reply("Дякую, прийнято!\nТепер напишіть ваш номер телефону");
      } catch (err) {
        await ctx.reply(err.message);
      }
      break;

    case "phone":
      try {
        const formattedPhone = formatUkrainianPhone(text);
        await validationSchema.validateAt("phone", { phone: formattedPhone });

        await ctx.reply("Дякую, номер прийнято!");

        await createPosterUser(userData[userId].name, formattedPhone, userId);

        try {
          await createUser(userId, userData[userId].name, formattedPhone, 0);
        } catch (dbError) {
          console.error("Помилка локального кешування користувача:", dbError);
        }

        await ctx.reply(
          "Ваша заявка на створення профілю прийнята.\nТепер ви можете користуватись застосунком. Натисніть кнопку нижче, щоб відкрити додаток та зануритися в атмосферу Mokko!",
        );

        delete userData[userId];
      } catch (err) {
        await ctx.reply(err.message);
      }
      break;

    default:
      await ctx.reply(
        "Вибачте, я вас не розумію. Напишіть /start для початку реєстрації.",
      );
      break;
  }
});

export { userComposer as userScenary };
