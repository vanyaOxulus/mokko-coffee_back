import { Composer, Markup } from "telegraf";
import * as JimpPkg from "jimp";
import jsQR from "jsqr";
import { getUserById, incrementUserBonuses } from "../db/user_db.js";

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

    if (clientId) {
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
              Markup.button.callback(
                "➕ Додати бонус",
                `bonus_add:${user.userID}`,
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
