import { Composer } from "telegraf";
import * as JimpPkg from "jimp"; // Импортируем весь пакет, чтобы обойти разницу версий
import jsQR from "jsqr";

const qrComposer = new Composer();

// Безопасный метод чтения для любой версии Jimp
async function readImageWithJimp(buffer) {
  // Если это новая версия 1.x, у неё есть JimpPkg.Jimp
  if (JimpPkg.Jimp && typeof JimpPkg.Jimp.read === "function") {
    return await JimpPkg.Jimp.read(buffer);
  }
  // Если это старая версия 0.x, то сам JimpPkg является функцией/классом с методом read
  if (typeof JimpPkg.read === "function") {
    return await JimpPkg.read(buffer);
  }
  // Если используется совсем новая модульная структура
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

// Хендлер на фото
qrComposer.on("photo", async (ctx) => {
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
    console.log(`[Бот] Результат сканування: ${qrContent}`);

    if (qrContent) {
      await ctx.reply(
        `✅ <b>QR-код розпізнано!</b>\n\nВміст:\n<code>${qrContent}</code>`,
        { parse_mode: "HTML" },
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

export { qrComposer as workerScenary };
