import { Telegraf } from "telegraf";
import * as Yup from "yup";
const { setManagerRole, getManagerRole } = require("./db");

const bot = new Telegraf("8852550649:AAGhuyCwn5ABtIO2X4jMVC-bxORDj3mxgx0");
const role = "";

bot.use(async (ctx, next) => {
  const userID = ctx.from?.id;
  if (getManagerRole(userID) === "worker") {
    role = "worker";
  } else if (getManagerRole(userID) === "boss") {
    role = "boss";
  } else {
    role = "user";
  }
});

switch (role) {
  case "user":
    require("./userScenary");
    break;
  case "worker":
    require("./workerScenary");
    break;
  case "boss":
    require("./workerScenery");
    break;
  default:
    break;
}

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
