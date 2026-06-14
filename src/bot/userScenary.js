const welcomeMessage = `Вітаємо у Mokko Coffee! 🧡
Ми створили цей бот, щоб ви могли легко керувати своїм профілем та першими дізнаватися про наші акції.

Що ви отримаєте:
✅ Доступ до спеціальних пропозицій.
✅ Зручний мобільний застосунок для замовлень.
✅ Персональні знижки для наших постійних гостей.

Пройдіть реєстрацію нижче для того, щоб почати користуватись застосунком!`;

const validationSchema = Yup.object().shape({
  fullName: Yup.string()
    .min(2, "Ім’я та прізвище занадто короткі")
    .max(50, "Ім’я та прізвище занадто довгі")
    .matches(/^[a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ\s]+$/, "Використовуйте лише літери"),

  phone: Yup.string()
    .matches(
      /^\+?[0-9]{10,12}$/,
      "Введіть коректний номер (наприклад, +380...)",
    )
    .required("Номер телефону обов’язковий"),
});

const userData = {};

bot.start((ctx) => {
  userData[ctx.chat.id] = { stage: "name" };
  ctx.reply(welcomeMessage);
  ctx.reply("Будь-ласка напишіть ваше ім'я та прізвище");
});

bot.on("text", async (ctx) => {
  const userId = ctx.chat.id;

  if (!userData[userId]) {
    return ctx.reply("Будь ласка, натисніть /start для реєстрації.");
  }

  const text = ctx.message.text;
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

        // poster pos api

        delete userData[userId];
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
