import "dotenv/config";
import { Telegraf, Composer } from "telegraf";
import * as Yup from "yup";
import { setManagerRole, getManagerRole } from "../db/managers_db.js";
import { userScenary } from "./userScenary.js";
import { workerScenary } from "./workerScenary.js";
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.use(async (ctx, next) => {
  const userID = ctx.from?.id;
  if (!userID) return;

  const managerRow = getManagerRole(userID);

  console.log(`[Бот] Запрос роли для ID ${userID}:`, managerRow);

  if (managerRow && managerRow === "worker") {
    ctx.state.role = "worker";
  } else if (managerRow && managerRow === "boss") {
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
