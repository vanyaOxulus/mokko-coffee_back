import "dotenv/config";
import { Telegraf, Composer } from "telegraf";
import * as Yup from "yup";
import { setManagerRole, getManagerRole } from "../db.js";
import { userScenary } from "./userScenary.js";
import { workerScenary } from "./workerScenary.js";
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.use(async (ctx, next) => {
  const userID = ctx.from?.id;
  if (!userID) return;

  // 1. Получаем объект из базы данных
  const managerRow = getManagerRole(userID);

  // Добавим логи в консоль, чтобы ты своими глазами увидел, что происходит
  console.log(`[Бот] Запрос роли для ID ${userID}:`, managerRow);

  // 2. Проверяем: если запись найдена, берем свойство .role
  if (managerRow && managerRow.role === "worker") {
    ctx.state.role = "worker";
  } else if (managerRow && managerRow.role === "boss") {
    ctx.state.role = "boss";
  } else {
    ctx.state.role = "user";
  }

  console.log(`[Бот] Установлена роль: ${ctx.state.role}`);

  await next();
});

bot.use(Composer.optional((ctx) => ctx.state.role === "user", userScenary));

bot.use(
  Composer.optional(
    (ctx) => ctx.state.role === "worker" || ctx.state.role === "boss",
    workerScenary,
  ),
);

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
