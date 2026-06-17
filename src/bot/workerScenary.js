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
import { addCard, deleteCard, getAllCards } from "../db/cards_db.js";

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

    console.log(
      "[QR] Изображение считано. Применяем фильтры улучшения контраста...",
    );

    image.greyscale().contrast(0.7).normalize();

    if (image.bitmap.width > 1200) {
      image.resize(1000, JimpPkg.AUTO || JimpPkg.default?.AUTO || -1);
    }

    console.log("[QR] Обработка завершена. Передаем в jsQR...");
    const { data, width, height } = image.bitmap;
    const code = jsQR(data, width, height);

    return code ? code.data : null;
  } catch (error) {
    console.error("[QR Помилка всередині scanQRCode]:", error.message);
    return null;
  }
}

function renderCardPagination(cards, currentIndex) {
  const card = cards[currentIndex];
  const total = cards.length;

  const text =
    `📋 <b>Каталог карток (Видалення) [${currentIndex + 1}/${total}]</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 <b>ID:</b> <code>${card.id}</code>\n` +
    `🏷️ <b>Назва:</b> ${card.title}\n` +
    `📝 <b>Короткий опис:</b> ${card.shortDescription}\n` +
    `📖 <b>Повний опис:</b> ${card.fullDescription}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Оберіть дію:`;

  const navigationRow = [];

  if (currentIndex > 0) {
    navigationRow.push(
      Markup.button.callback("⬅️ Назад", `card_page:${currentIndex - 1}`),
    );
  } else {
    navigationRow.push(Markup.button.callback("❌", "card_ignore"));
  }

  if (currentIndex < total - 1) {
    navigationRow.push(
      Markup.button.callback("Вперед ➡️", `card_page:${currentIndex + 1}`),
    );
  } else {
    navigationRow.push(Markup.button.callback("❌", "card_ignore"));
  }

  const keyboard = Markup.inlineKeyboard([
    navigationRow,
    [
      Markup.button.callback(
        "🗑️ Видалити цю картку",
        `card_confirm_del:${card.id}:${currentIndex}`,
      ),
    ],
    [Markup.button.callback("🚩 Закрити меню", "card_close")],
  ]);

  return { text, keyboard };
}

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

    if (!qrContent) {
      return ctx.reply(
        "❌ Не вдалось знайти або зчитати QR-код. Спробуйте зробити фото чіткішим, ближче та без бліків.",
      );
    }

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

managerComposer.action(/^bonus_cancel:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const clientId = ctx.match[1];
  await ctx.editMessageText(
    `🚫 Операцію для клієнта (ID: ${clientId}) скасовано менеджером.`,
  );
});

managerComposer.action("card_ignore", async (ctx) => await ctx.answerCbQuery());

managerComposer.action("card_close", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText("🚩 Перегляд карток завершено.");
});

managerComposer.action(/^card_page:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const targetIndex = Number(ctx.match[1]);
  const cards = getAllCards();

  if (cards.length === 0) {
    return ctx.editMessageText("📭 Усі картки було видалено.");
  }

  const { text, keyboard } = renderCardPagination(cards, targetIndex);
  await ctx.editMessageText(text, { parse_mode: "HTML", ...keyboard });
});

managerComposer.action(/^card_confirm_del:(\d+):(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const cardId = Number(ctx.match[1]);
  const currentIndex = Number(ctx.match[2]);

  await ctx.editMessageReplyMarkup(
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "⚠️ ТАК, видалити",
          `card_execute_del:${cardId}:${currentIndex}`,
        ),
        Markup.button.callback("❌ НІ, назад", `card_page:${currentIndex}`),
      ],
    ]).reply_markup,
  );
});

managerComposer.action(/^card_execute_del:(\d+):(\d+)$/, async (ctx) => {
  const cardId = Number(ctx.match[1]);
  const currentIndex = Number(ctx.match[2]);

  try {
    const isDeleted = deleteCard(cardId);

    if (!isDeleted) {
      await ctx.answerCbQuery("❌ Картку вже видалено!");
      return;
    }

    await ctx.answerCbQuery("✅ Видалено успішно");

    const cards = getAllCards();

    if (cards.length === 0) {
      return ctx.editMessageText(
        "📭 Картку видалено. Більше карток у базі немає.",
      );
    }

    const nextIndex =
      currentIndex >= cards.length ? cards.length - 1 : currentIndex;

    const { text, keyboard } = renderCardPagination(cards, nextIndex);
    await ctx.editMessageText(text, { parse_mode: "HTML", ...keyboard });
  } catch (error) {
    console.error("Помилка при видаленні картки:", error);
    await ctx.reply("❌ Сталася помилка при видаленні картки.");
  }
});

// 👑 СЦЕНАРИИ ДЛЯ БОССА (УПРАВЛЕНИЕ ПЕРСОНАЛОМ)

managerComposer.command("newWorker", async (ctx) => {
  const userId = ctx.from.id;
  const role = getManagerRole(userId);

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

managerComposer.command("deleteCard", async (ctx) => {
  const userId = ctx.from.id;
  const role = getManagerRole(userId);

  if (role !== "boss") {
    return ctx.reply("❌ У вас немає прав для виконання цієї команди.");
  }

  const cards = getAllCards();

  if (cards.length === 0) {
    return ctx.reply("📭 У базі даних ще немає жодної карточки.");
  }

  // Рендерим первую карточку (индекс 0)
  const { text, keyboard } = renderCardPagination(cards, 0);
  await ctx.reply(text, { parse_mode: "HTML", ...keyboard });
});

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

managerComposer.command("newCard", async (ctx) => {
  const userId = ctx.from.id;
  const role = getManagerRole(userId);

  if (role === "boss") {
    managerState[userId] = { stage: "wait_title" };
    await ctx.reply(
      "💼 <b>Режим додавання карточки</b>\n\nБудь ласка, надішліть коротку назву карточки (не більше 3 слів):",
      { parse_mode: "HTML" },
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
  const targetManagerId = Number(text);

  try {
    switch (currentState.stage) {
      case "wait_manager_id": {
        if (isNaN(targetManagerId) || text.length < 5) {
          return ctx.reply("❌ Некоректний Telegram ID. Спробуйте ще раз:");
        }

        await setManagerRole(targetManagerId, "worker");
        await ctx.reply(
          `✅ Працівника з ID <code>${targetManagerId}</code> успішно <b>додано</b> до бази даних як менеджера.`,
          { parse_mode: "HTML" },
        );
        delete managerState[userId]; // Чистим стейдж здесь, так как break выйдет за finally
        break;
      }

      case "wait_delete_manager_id": {
        if (isNaN(targetManagerId) || text.length < 5) {
          return ctx.reply("❌ Некоректний Telegram ID. Спробуйте ще раз:");
        }

        if (!getManagerRole(targetManagerId)) {
          return ctx.reply(
            "❌ Працівника з таким Telegram ID не знайдено. Спробуйте ще раз:",
          );
        }

        if (targetManagerId === ctx.from.id) {
          return ctx.reply(
            "❌ Ви не можете видалити самого себе. Введіть ID іншого менеджера:",
          );
        }

        const isDeleted = await deleteManager(targetManagerId);

        if (isDeleted) {
          await ctx.reply(
            `✅ Працівника з ID <code>${targetManagerId}</code> успішно <b>видалено</b> з бази даних.`,
            { parse_mode: "HTML" },
          );
        } else {
          await ctx.reply(
            `⚠️ Працівника з ID <code>${targetManagerId}</code> не знайдено в базі даних.`,
            { parse_mode: "HTML" },
          );
        }
        delete managerState[userId];
        break;
      }

      // 3. ЭТАП НАЗВАНИЯ КАРТОЧКИ (Новый стейдж для /newCard)
      case "wait_title": {
        const wordsCount = text.split(/\s+/).length;

        if (wordsCount > 3 || !text) {
          return ctx.reply(
            "❌ Некоректна назва. Будь ласка, надішліть назву, що містить не більше 3 слів:",
          );
        }

        console.log(`Назва карточки получена: ${text}.`);

        managerState[userId] = {
          stage: "wait_short_description",
          title: text,
        };

        await ctx.reply(
          `✅ Назву карточки "<b>${text}</b>" прийнято.\n\nТепер напишіть коротки опис карточки(бажано не більше 30 символів)`,
          {
            parse_mode: "HTML",
          },
        );
        break;
      }

      case "wait_short_description": {
        const sentenceLen = text.length;

        if (sentenceLen > 30 || !text) {
          return ctx.reply(
            "❌ Некоректна назва. Будь ласка, надішліть назву, що містить не більше 30 символів:",
          );
        }

        console.log(`Короткий опис получен: ${text}.`);

        managerState[userId] = {
          ...currentState,
          stage: "wait_full_description",
          shortDescription: text,
        };

        await ctx.reply(
          `✅ Короткий опис "<b>${text}</b>" прийнято.\n\nТепер напишіть повний опис карточки`,
          {
            parse_mode: "HTML",
          },
        );
        break;
      }

      case "wait_full_description": {
        if (!text) {
          return ctx.reply(
            "❌ Опис не може бути порожнім. Введіть повний опис:",
          );
        }

        const fullDescription = text.trim();
        console.log(`Повний опис получен: ${fullDescription}.`);

        managerState[userId] = { ...currentState, fullDescription };

        const { title, shortDescription } = currentState;

        const newCardId = addCard(title, shortDescription, fullDescription);

        await ctx.reply(
          `🎉 <b>Карточку успішно створено!</b>\n\n` +
            `🆔 <b>ID:</b> <code>${newCardId}</code>\n` +
            `🏷️ <b>Назва:</b> ${title}\n` +
            `📝 <b>Короткий опис:</b> ${shortDescription}\n` +
            `📖 <b>Повний опис:</b> ${fullDescription}`,
          { parse_mode: "HTML" },
        );
        delete managerState[userId];
        break;
      }

      default:
        return next();
    }
  } catch (error) {
    console.error(`Помилка при обробці стану ${currentState.stage}:`, error);
    await ctx.reply(
      "❌ Сталася внутрішня помилка при обробці запиту до бази даних.",
    );
    delete managerState[userId]; // В случае ошибки чистим стейдж
  }
});

export { managerComposer as workerScenary };
