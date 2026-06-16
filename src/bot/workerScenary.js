import { Composer, Markup } from "telegraf";
import * as JimpPkg from "jimp";
import jsQR from "jsqr";
import {
  getUserById,
  incrementUserBonuses,
  resetUserBonuses,
} from "../db/user_db.js";
import {
  deleteManager,
  getManagerRole,
  setManagerRole,
} from "../db/managers_db.js";

const managerComposer = new Composer();

async function readImageWithJimp(buffer) {
  if (JimpPkg.Jimp && typeof JimpPkg.Jimp.read === "function") {
    return await JimpPkg.Jimp.read(buffer);
  }
  if (typeof JimpPkg.read === "function") {
    return await JimpPkg.read(buffer);
  }
  if (typeof JimpPkg.default?.read === "function") {
    return await JimpPkg.default.read(buffer);
  }
  throw new Error(
    "Не вдалося знайти метод read у бібліотеці Jimp. Перевірте версію пакета.",
  );
}

async function scanQRCode(imageBuffer) {
  try {
    console.log("[QR] Запуск Jimp для читання буфера...");
    const image = await readImageWithJimp(imageBuffer);

    console.log("[QR] Зображення успішно зчитано Jimp. Передаємо в jsQR...");
    const { data, width, height } = image.bitmap;
    const code = jsQR(data, width, height);

    return code ? code.data : null;
  } catch (error) {
    console.error("[QR Помилка всередині scanQRCode]:", error.message);
    return null;
  }
}

managerComposer.on("photo", async (ctx) => {
  console.log(
    `\n=== [ВХІДНИЙ АПДЕЙТ] Отримано фото від користувача з ID: ${ctx.from.id} ===`,
  );
  try {
    await ctx.reply("Сканую QR-код, зачекайте секунду...");
    console.log("[Бот] Повідомлення про очікування відправлено.");

    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;
    console.log(`[Бот] ID файлу у Telegram: ${fileId}`);

    const fileLink = await ctx.telegram.getFileLink(fileId);
    console.log(`[Бот] Посилання на файл отримано: ${fileLink.href}`);

    console.log("[Бот] Завантаження файлу в оперативну пам'ять...");
    const response = await fetch(fileLink.href);
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    console.log(
      `[Бот] Файл завантажено. Розмір буфера: ${imageBuffer.length} байт.`,
    );

    const qrContent = await scanQRCode(imageBuffer);
    const clientId = qrContent.split(":")[1];
    console.log(`[Бот] Результат сканування: ${clientId}`);
    const user = getUserById(clientId);
    console.log("User:", user);

    if (user) {
      await ctx.reply(
        `👤 <b>Клієнта знайдено!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🏷️ <b>Ім'я:</b> ${user.name}\n` +
          `📞 <b>Телефон:</b> <code>${user.phone}</code>\n` +
          `🪙 <b>Бонуси:</b> ${user.bonuses}/7\n` +
          `🆔 <b>Telegram ID:</b> <code>${user.userID}</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Оберіть дію для цього профілю:`,
        {
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            [
              user.bonuses < 7
                ? Markup.button.callback(
                    "➕ Додати бонус",
                    `bonus_add:${user.userID}`,
                  )
                : Markup.button.callback(
                    "🪙 Списати бонуси",
                    `bonus_reset:${user.userID}`,
                  ),
              Markup.button.callback(
                "❌ Скасувати",
                `bonus_cancel:${user.userID}`,
              ),
            ],
          ]),
        },
      );
    } else if (qrContent && !user) {
      await ctx.telegram.sendMessage(
        clientId,
        `☕ <b>Mokko Coffee</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Вашу картку лояльності щойно відсканував бариста, але ви не зареєстровані.\n` +
          `Напишіть /start для того щоб зареєструвати профіль(1-2 хв) ⏳`,

        { parse_mode: "HTML" },
      );
      await ctx.reply("❌ QR-код зчитаний, але клієнта не має в базі данних.");
    } else {
      await ctx.reply(
        "❌ Не вдалось знайти або зчитати QR-код. Спробуйте зробити фото чіткішим та без бліків.",
      );
    }
  } catch (error) {
    console.error("[Критична помилка в хендлері фото]:", error);
    await ctx.reply("Сталася помилка при обробці фото.");
  }
});

managerComposer.action(/^bonus_add:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery("Обробка...");

  const clientId = ctx.match[1];

  try {
    await incrementUserBonuses(clientId);

    await ctx.editMessageText(
      `✅ Бонус успішно додано для клієнта (ID: ${clientId})!`,
    );
  } catch (error) {
    console.error("Помилка нарахування бонусу:", error);
    await ctx.reply("❌ Провисла помилка при додаванні бонусу в базу.");
  }
});

managerComposer.action(/^bonus_cancel:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const clientId = ctx.match[1];

  // Просто редактируем сообщение, убирая кнопки и закрывая сессию
  await ctx.editMessageText(
    `🚫 Операцію для клієнта (ID: ${clientId}) скасовано менеджером.`,
  );
});

export { managerComposer as workerScenary };

managerComposer.action(/^bonus_reset:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery("Обробка...");

  const clientId = ctx.match[1];

  try {
    await resetUserBonuses(clientId);

    await ctx.editMessageText(
      `✅ Бонуси успішно списано для клієнта (ID: ${clientId})!`,
    );
  } catch (error) {
    console.error("Помилка списання бонусу:", error);
    await ctx.reply("❌ Провисла помилка при списанні бонусу в базу.");
  }
});

const managerState = {};
managerComposer.command("setWorker", async (ctx) => {
  const userId = ctx.from.id;
  const role = getManagerRole(userId).role;
  console.log("Role:", role);

  if (role === "boss") {
    managerState[userId] = { stage: "wait_manager_id" };

    await ctx.reply(
      "💼 *Режим додавання працівника\\.*\n\nБудь ласка, надішліть Telegram ID менеджера, якого ви хочете додати:",
      {
        parse_mode: "MarkdownV2",
      },
    );
  } else {
    await ctx.reply("❌ У вас немає прав для виконання цієї команди.");
  }
});
managerComposer.command("deleteWorker", async (ctx) => {
  const userId = ctx.from.id;
  const role = getManagerRole(userId).role;
  console.log("Role:", role);

  if (role === "boss") {
    managerState[userId] = { stage: "wait_delete_manager_id" };

    await ctx.reply(
      "💼 *Режим видалення працівника\\.*\n\nБудь ласка, надішліть Telegram ID менеджера, якого ви хочете видалити:",
      {
        parse_mode: "MarkdownV2",
      },
    );
  } else {
    await ctx.reply("❌ У вас немає прав для виконання цієї команди.");
  }
});

managerComposer.on("text", async (ctx, next) => {
  const userId = ctx.from.id;
  const text = ctx.message.text ? ctx.message.text.trim() : "";

  if (!managerState[userId]) {
    return next();
  }

  const currentState = managerState[userId];

  if (currentState.stage === "wait_manager_id") {
    const newManagerId = Number(text);

    if (isNaN(newManagerId) || text.length < 5) {
      return ctx.reply(
        "❌ Некоректний Telegram ID. Він має складатися лише з цифр. Спробуйте ще раз або введіть інший:",
      );
    }

    try {
      await setManagerRole(newManagerId, "worker");

      await ctx.reply(
        `✅ Працівника з ID \`${newManagerId}\` успішно додано до бази даних як менеджера\\.`,
        {
          parse_mode: "MarkdownV2",
        },
      );

      delete managerState[userId];
    } catch (error) {
      console.error("Помилка при додаванні менеджера:", error);
      await ctx.reply(
        "❌ Провисла помилка при збереженні менеджера в базу даних.",
      );
      delete managerState[userId];
    }
  } else if (currentState.stage === "wait_delete_manager_id") {
    const managerId = Number(text);

    if (isNaN(managerId) || text.length < 5) {
      return ctx.reply(
        "❌ Некоректний Telegram ID. Він має складатися лише з цифр. Спробуйте ще раз або введіть інший:",
      );
    } else if (managerId === ctx.from.id) {
      return ctx.reply(
        "❌ Ви не можете видалити себе. Спробуйте ще раз або введіть інший:",
      );
    }

    try {
      await deleteManager(managerId);

      await ctx.reply(
        `✅ Працівника з ID \`${managerId}\` успішно додано до бази даних як менеджера\\.`,
        {
          parse_mode: "MarkdownV2",
        },
      );

      delete managerState[userId];
    } catch (error) {
      console.error("Помилка при додаванні менеджера:", error);
      await ctx.reply(
        "❌ Провисла помилка при збереженні менеджера в базу даних.",
      );
      delete managerState[userId];
    }
  }
});
