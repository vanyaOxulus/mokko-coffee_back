import "dotenv/config";
import { Telegraf, Composer } from "telegraf";
import { getAdminRole } from "../db/admins_db.js";
import { userScenary } from "./userScenary.js";
import { adminScenary } from "./adminScenary.js";
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.use(async (ctx, next) => {
  const userID = ctx.from?.id;
  if (!userID) return;

  const role = getAdminRole(userID);

  console.log(`[Бот] Запрос роли для ID ${userID}:`, role);

  ctx.state.role = role === "admin" ? "admin" : "user";

  console.log(`[Бот] Установлена роль: ${ctx.state.role}`);

  await next();
});

bot.use(Composer.optional((ctx) => ctx.state.role === "user", userScenary));

bot.use(Composer.optional((ctx) => ctx.state.role === "admin", adminScenary));

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
