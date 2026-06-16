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
const managerState = {};

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

// Хендлер сканирования QR-кода по фото
managerComposer.on("photo", async (ctx) => {
  console.log(
    `\n=== [ВХІДНИЙ АПДЕЙТ] Отримано фото від користувача з ID: ${ctx.from.id} ===`,
  );
  try {
    await ctx.reply("Сканую QR-код, зачекайте секунду...");

    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;

    const fileLink = await ctx.telegram.getFileLink(fileId);
    const response = await fetch(fileLink.href);
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    const qrContent = await scanQRCode(imageBuffer);

    // 🔥 ИСПРАВЛЕНИЕ: Безопасная проверка. Если QR не считался, сразу выходим
    if (!qrContent) {
      return ctx.reply(
        "❌ Не вдалось знайти або зчитати QR-код. Спробуйте зробити фото чіткішим, ближче та без бліків.",
      );
    }

    // Если в QR записан не наш формат (нет двоеточия), защищаем код от падения
    if (!qrContent.includes(":")) {
      return ctx.reply("❌ Некоректний формат QR-коду.");
    }

    const clientId = qrContent.split(":")[1];
    console.log(`[Бот] Результат сканування clientId: ${clientId}`);

    const user = getUserById(clientId);
    console.log("User в БД:", user);

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
    } else {
      // Если QR считался, но в нашей локальной базе юзера нет, пробуем уведомить его
      try {
        await ctx.telegram.sendMessage(
          clientId,
          `☕ <b>Mokko Coffee</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `Вашу картку лояльності щойно відсканував бариста, але ви не зареєстровані.\n` +
            `Напишіть /start для того щоб зареєструвати профіль(1-2 хв) ⏳`,
          { parse_mode: "HTML" },
        );
      } catch (tgErr) {
        console.log(
          `Не вдалося надіслати повідомлення незареєстрованому юзеру: ${tgErr.message}`,
        );
      }
      await ctx.reply("❌ QR-код зчитаний, але клієнта немає в базі даних.");
    }
  } catch (error) {
    console.error("[Критична помилка в хендлері фото]:", error);
    await ctx.reply("Сталася помилка при обробці фото.");
  }
});

// Кнопка: Добавить бонус
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
    await ctx.reply("❌ Сталася помилка при додаванні бонусу в базу.");
  }
});

// Кнопка: Списать бонусы
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
    await ctx.reply("❌ Сталася помилка при списанні бонусу в базу.");
  }
});

// Кнопка: Отмена операции
managerComposer.action(/^bonus_cancel:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const clientId = ctx.match[1];
  await ctx.editMessageText(
    `🚫 Операцію для клієнта (ID: ${clientId}) скасовано менеджером.`,
  );
});

// Команда /setWorker для Босса
managerComposer.command("setWorker", async (ctx) => {
  const userId = ctx.from.id;
  // 🔥 ИСПРАВЛЕНИЕ: getManagerRole возвращает строку или null, а у тебя вызывалось .role у undefined
  const role = getManagerRole(userId);
  console.log("Role:", role);

  if (role === "boss") {
    managerState[userId] = { stage: "wait_manager_id" };
    await ctx.reply(
      "💼 <b>Режим додавання працівника</b>\n\nБудь ласка, надішліть Telegram ID менеджера, якого ви хочете додати:",
      { parse_mode: "HTML" },
    );
  } else {
    await ctx.reply("❌ У вас немає прав для виконання цієї команди.");
  }
});

// Команда /deleteWorker для Босса
managerComposer.command("deleteWorker", async (ctx) => {
  const userId = ctx.from.id;
  const role = getManagerRole(userId);

  if (role === "boss") {
    managerState[userId] = { stage: "wait_delete_manager_id" };
    await ctx.reply(
      "💼 <b>Режим видалення працівника</b>\n\nБудь ласка, надішліть Telegram ID менеджера, якого ви хочете видалити:",
      { parse_mode: "HTML" },
    );
  } else {
    await ctx.reply("❌ У вас немає прав для виконання цієї команди.");
  }
});

// Обработка текстовых ответов Босса (FSM Сценарий)
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
      return ctx.reply("❌ Некоректний Telegram ID. Спробуйте ще раз:");
    }

    try {
      await setManagerRole(newManagerId, "worker");
      await ctx.reply(
        `✅ Працівника з ID <code>${newManagerId}</code> успішно <b>додано</b> до бази даних як менеджера.`,
        {
          parse_mode: "HTML",
        },
      );
      delete managerState[userId];
    } catch (error) {
      console.error("Помилка при додаванні менеджера:", error);
      await ctx.reply("❌ Помилка при збереженні менеджера в базу даних.");
      delete managerState[userId];
    }
  } else if (currentState.stage === "wait_delete_manager_id") {
    const managerId = Number(text);

    if (isNaN(managerId) || text.length < 5) {
      return ctx.reply("❌ Некоректний Telegram ID. Спробуйте ще раз:");
    } else if (managerId === ctx.from.id) {
      return ctx.reply("❌ Ви не можете видалити самого себе.");
    }

    try {
      const isDeleted = await deleteManager(managerId); // Используем твою функцию удаления

      if (isDeleted) {
        await ctx.reply(
          `✅ Працівника з ID <code>${managerId}</code> успішно <b>видалено</b> з бази даних.`,
          {
            parse_mode: "HTML",
          },
        );
      } else {
        await ctx.reply(
          `⚠️ Працівника з ID <code>${managerId}</code> не знайдено в базі даних.`,
          {
            parse_mode: "HTML",
          },
        );
      }

      delete managerState[userId];
    } catch (error) {
      console.error("Помилка при видаленні менеджера:", error);
      await ctx.reply(
        "❌ Сталася помилка при видаленні менеджера з бази даних.",
      );
      delete managerState[userId];
    }
  }
});

export { managerComposer as workerScenary };
