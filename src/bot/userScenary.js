import { Composer } from "telegraf";
import { welcomeMessage, validationSchema } from "./validation.js";

// Локальное хранилище состояний сессий
const userData = {};

const userComposer = new Composer();

// Обработка команды /start
userComposer.start((ctx) => {
  const userId = ctx.chat.id;
  userData[userId] = { stage: "name" };

  ctx.reply(welcomeMessage);
  ctx.reply("Будь-ласка напишіть ваше ім'я та прізвище");
});

// Обработка текстовых сообщений во время регистрации
userComposer.on("text", async (ctx, next) => {
  const userId = ctx.chat.id;
  const text = ctx.message.text;

  // Если пользователя нет в базе регистрации, передаем управление дальше
  // (например, если он уже зарегистрирован и это просто текст)
  if (!userData[userId]) {
    return ctx.reply("Будь ласка, натисніть /start для реєстрації.");
  }

  const userState = userData[userId];

  switch (userState.stage) {
    case "name":
      try {
        await validationSchema.validateAt("fullName", { fullName: text });
        userData[userId].name = text;
        userData[userId].stage = "phone";
        ctx.reply("Дякую, прийнято!\nТепер напишіть ваш номер телефону");
      } catch (err) {
        ctx.reply(err.message);
      }
      break;

    case "phone":
      try {
        const cleanedPhone = text.replace(/[\s\-\(\)]/g, "");
        await validationSchema.validateAt("phone", { phone: cleanedPhone });

        userData[userId].phone = cleanedPhone;

        ctx.reply("Дякую, номер прийнято!");
        ctx.reply(
          "Ваша заявка на створення профілю прийнята.\nТепер ви можете користуватись застосунком. Натисніть кнопку нижче, щоб відкрити додаток та зануритися в атмосферу Mokko!",
        );

        // TODO: Отправка данных в poster pos api (userData[userId])

        delete userData[userId]; // Очищаем сессию после успешной регистрации
      } catch (err) {
        ctx.reply(err.message);
      }
      break;

    default:
      ctx.reply(
        "Вибачте, я вас не розумію. Напишіть /start для початку реєстрації.",
      );
      break;
  }
});

export { userComposer as userScenary };
