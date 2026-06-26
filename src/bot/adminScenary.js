import { Composer, Markup } from "telegraf";
import {
  deleteAdmin,
  getAdminRole,
  getAllAdmins,
  setAdminRole,
} from "../db/admins_db.js";
import { addCard, deleteCard, getAllCards } from "../db/cards_db.js";

const adminComposer = new Composer();
const adminState = {};

const isAdmin = (userId) => getAdminRole(userId) === "admin";

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

adminComposer.action("card_ignore", async (ctx) => await ctx.answerCbQuery());

adminComposer.action("card_close", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText("🚩 Перегляд карток завершено.");
});

adminComposer.action(/^card_page:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const targetIndex = Number(ctx.match[1]);
  const cards = getAllCards();

  if (cards.length === 0) {
    return ctx.editMessageText("📭 Усі картки було видалено.");
  }

  const { text, keyboard } = renderCardPagination(cards, targetIndex);
  await ctx.editMessageText(text, { parse_mode: "HTML", ...keyboard });
});

adminComposer.action(/^card_confirm_del:(\d+):(\d+)$/, async (ctx) => {
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

adminComposer.action(/^card_execute_del:(\d+):(\d+)$/, async (ctx) => {
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

adminComposer.action("cancel_admin_add", async (ctx) => {
  const userId = ctx.from.id;
  delete adminState[userId];

  await ctx.answerCbQuery("Скасовано");
  await ctx.editMessageText("❌ Додавання адміністратора скасовано.");
});

adminComposer.command("commands", async (ctx) => {
  const userId = ctx.from.id;

  if (isAdmin(userId)) {
    const adminText =
      `👑 <b>Панель адміністратора Mokko Coffee</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Вітаємо! Вам доступні команди для управління контентом та адмінами.\n\n` +
      `📝 <b>Управління картками:</b>\n` +
      `• /newCard — Додати нову акційну картку (покроковий режим)\n` +
      `• /deleteCard — Перегляд та видалення карток (інтерактивна карусель)\n\n` +
      `👥 <b>Управління адмінами:</b>\n` +
      `• /newAdmin — Надати користувачу адмін-доступ\n` +
      `• /deleteAdmin — Забрати адмін-доступ\n` +
      `• /listAdmins — Список усіх адмінів\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 <i>Для виклику будь-якої команди просто натисніть на неї.</i>`;

    return await ctx.reply(adminText, { parse_mode: "HTML" });
  }

  await ctx.reply(
    "❌ <b>Доступ обмежено.</b>\n\nЦя панель доступна тільки адміністраторам <b>Mokko Coffee</b>.",
    { parse_mode: "HTML" },
  );
});

adminComposer.command("newAdmin", async (ctx) => {
  const userId = ctx.from.id;

  if (isAdmin(userId)) {
    adminState[userId] = { stage: "wait_admin_id" };
    await ctx.reply(
      "💼 <b>Режим додавання адміністратора</b>\n\nБудь ласка, надішліть Telegram ID користувача, якому потрібно надати адмін-доступ:",
      { parse_mode: "HTML" },
    );
  } else {
    await ctx.reply("❌ У вас немає прав для виконання цієї команди.");
  }
});

adminComposer.command("deleteAdmin", async (ctx) => {
  const userId = ctx.from.id;

  if (isAdmin(userId)) {
    adminState[userId] = { stage: "wait_delete_admin_id" };
    await ctx.reply(
      "💼 <b>Режим видалення адміністратора</b>\n\nБудь ласка, надішліть Telegram ID адміністратора, у якого потрібно забрати доступ:",
      { parse_mode: "HTML" },
    );
  } else {
    await ctx.reply("❌ У вас немає прав для виконання цієї команди.");
  }
});

adminComposer.command("newCard", async (ctx) => {
  const userId = ctx.from.id;

  if (isAdmin(userId)) {
    adminState[userId] = { stage: "wait_title" };
    await ctx.reply(
      "💼 <b>Режим додавання карточки</b>\n\nБудь ласка, надішліть коротку назву карточки (не більше 3 слів):",
      { parse_mode: "HTML" },
    );
  } else {
    await ctx.reply("❌ У вас немає прав для виконання цієї команди.");
  }
});

adminComposer.command("deleteCard", async (ctx) => {
  const userId = ctx.from.id;

  if (!isAdmin(userId)) {
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

adminComposer.command("listAdmins", async (ctx) => {
  const userId = ctx.from.id;

  if (!isAdmin(userId)) {
    return ctx.reply("❌ У вас немає прав для виконання цієї команди.");
  }

  const admins = getAllAdmins();

  if (admins.length === 0) {
    return ctx.reply(
      "📭 У базі даних немає жодного зареєстрованого адміністратора.",
    );
  }

  let text = "📋 <b>Список адмінів Mokko Coffee:</b>\n━━━━━━━━━━━━━━━━━━━━\n";

  admins.forEach((admin, index) => {
    text += `${index + 1}. ID: <code>${admin.userID}</code> — <b>👑 Адмін</b>\n`;
  });

  text +=
    "━━━━━━━━━━━━━━━━━━━━\n💡 <i>Ви можете скопіювати ID для видалення через /deleteAdmin</i>";

  await ctx.reply(text, { parse_mode: "HTML" });
});

adminComposer.on("text", async (ctx, next) => {
  const userId = ctx.from.id;
  const text = ctx.message.text ? ctx.message.text.trim() : "";

  if (!adminState[userId]) {
    return next();
  }

  const currentState = adminState[userId];
  const targetAdminId = Number(text);

  try {
    switch (currentState.stage) {
      case "wait_admin_id": {
        if (isNaN(targetAdminId) || text.length < 5) {
          return ctx.reply("❌ Некоректний Telegram ID. Спробуйте ще раз:");
        }

        await setAdminRole(targetAdminId);
        await ctx.reply(
          `🎉 <b>Успішно додано!</b>\n\nКористувачу з ID <code>${targetAdminId}</code> надано адмін-доступ.`,
          { parse_mode: "HTML" },
        );
        delete adminState[userId];
        break;
      }

      case "wait_delete_admin_id": {
        if (isNaN(targetAdminId) || text.length < 5) {
          return ctx.reply("❌ Некоректний Telegram ID. Спробуйте ще раз:");
        }

        if (!getAdminRole(targetAdminId)) {
          return ctx.reply(
            "❌ Адміністратора з таким Telegram ID не знайдено. Спробуйте ще раз:",
          );
        }

        if (targetAdminId === ctx.from.id) {
          return ctx.reply(
            "❌ Ви не можете видалити самого себе. Введіть ID іншого адміністратора:",
          );
        }

        const isDeleted = await deleteAdmin(targetAdminId);

        if (isDeleted) {
          await ctx.reply(
            `✅ Адміністратора з ID <code>${targetAdminId}</code> успішно <b>видалено</b> з бази даних.`,
            { parse_mode: "HTML" },
          );
        } else {
          await ctx.reply(
            `⚠️ Адміністратора з ID <code>${targetAdminId}</code> не знайдено в базі даних.`,
            { parse_mode: "HTML" },
          );
        }
        delete adminState[userId];
        break;
      }

      case "wait_title": {
        const wordsCount = text.split(/\s+/).length;

        if (wordsCount > 3 || !text) {
          return ctx.reply(
            "❌ Некоректна назва. Будь ласка, надішліть назву, що містить не більше 3 слів:",
          );
        }

        console.log(`Назва карточки получена: ${text}.`);

        adminState[userId] = {
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
        console.log(`Короткий опис получен: ${text}.`);

        adminState[userId] = {
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

        adminState[userId] = { ...currentState, fullDescription };

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
        delete adminState[userId];
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
    delete adminState[userId];
  }
});

export { adminComposer as adminScenary };
