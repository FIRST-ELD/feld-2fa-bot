import { Bot, session } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { TOTP } from "otpauth";
import dotenv from "dotenv";
import DB from "./lib/db.js";

dotenv.config();

const GROUP_ID = process.env.GROUP_ID;
const ADMIN_STATUSES = ["creator", "administrator"];
const bot = new Bot(process.env.BOT_TOKEN);

const sanitizeBase32 = (str) => str.replace(/[^A-Z2-7]/gi, "").toUpperCase();

bot.use(
  session({
    storage: DB.sessionStorage,
    initial: () => ({ conversation: {} }),
  })
);
bot.use(conversations());

bot.api.setMyCommands([
  { command: "add", description: "Добавить 2FA аккаунт" },
  { command: "code", description: "Получить код 2FA (в группе)" },
  { command: "list_accounts", description: "Список всех аккаунтов (админы)" },
  { command: "delete_account", description: "Удалить 2FA аккаунт (админы)" },
  { command: "start", description: "Запуск бота" },
]);

async function addApp(conversation, ctx) {
  await ctx.reply("Отправьте ваш секретный ключ 2FA (Base32).");

  const response = await conversation.waitFor("message:text");
  const secret = response.message.text.trim();

  const sanitizedSecret = sanitizeBase32(secret);
  if (!sanitizedSecret) {
    return ctx.reply("⚠️ Ваш секретный ключ неверного формата.");
  }

  if (sanitizedSecret.length < 1) {
    return ctx.reply("Ваш секретный ключ пуст.");
  }

  if (sanitizedSecret === "/add") {
    return ctx.reply("Ваш секретный ключ /add ?????.");
  }

  await DB.setUser(ctx.from.id, {
    secret: sanitizedSecret,
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name || "",
    userId: ctx.from.id,
  });

  await ctx.reply(`✅ 2FA аккаунт успешно добавлен.`);
}

bot.use(createConversation(addApp));

bot.command("add", async (ctx) => {
  if (ctx.chat.type !== "private") {
    await ctx.reply("⚠️ Используйте эту команду в личных сообщениях.");
    return;
  }

  const existing = await DB.getUser(ctx.from.id);
  if (existing?.secret) {
    await ctx.reply(
      "⚠️ У вас уже есть 2FA аккаунт. Свяжитесь с админом для изменений."
    );
    return;
  }

  await ctx.conversation.enter("addApp");
});

bot.command("code", async (ctx) => {
  const userData = await DB.getUser(ctx.from.id);
  if (!userData?.secret) {
    return ctx.reply("⚠️ Сначала добавьте 2FA аккаунт командой /add.");
  }

  const sanitizedSecret = sanitizeBase32(userData.secret);
  if (!sanitizedSecret) {
    return ctx.reply("⚠️ Ваш секретный ключ неверного формата.");
  }

  try {
    const otp = new TOTP({ secret: sanitizedSecret }).generate();
    await ctx.reply(`🔑 OTP для ${ctx.from.first_name}: <code>${otp}</code>`, {
      parse_mode: "HTML",
    });
  } catch (err) {
    console.error(err);
    return ctx.reply("Ошибка при создании OTP кода.");
  }
});

bot.command("list_accounts", async (ctx) => {
  const member = await ctx.api.getChatMember(GROUP_ID, ctx.from.id);
  if (!ADMIN_STATUSES.includes(member.status)) {
    return ctx.reply(
      "⚠️ Только администраторы могут использовать эту команду."
    );
  }

  const users = await DB.getAllUsers();

  if (!users.length) {
    return ctx.reply("❌ Нет зарегистрированных 2FA аккаунтов.");
  }

  const message = users
    .map((u, i) => `${i + 1}. ${u.firstName} ${u.lastName} ${u.userId}`)
    .join("\n");

  await ctx.reply(`📜 Зарегистрированные аккаунты:\n${message}`, {
    parse_mode: "HTML",
  });
});

bot.command("delete_account", async (ctx) => {
  const member = await ctx.api.getChatMember(GROUP_ID, ctx.from.id);
  if (!ADMIN_STATUSES.includes(member.status)) {
    return ctx.reply(
      "⚠️ Только администраторы могут использовать эту команду."
    );
  }

  const [_, userID] = ctx.message.text.split(" ");
  if (!userID) return ctx.reply("⚠️ Использование: /delete_account <userID>");

  const user = await DB.getUser(userID);
  if (!user?.secret) return ctx.reply("❌ Пользователь не найден.");

  await DB.deleteUser(userID);
  await ctx.reply(`✅ Аккаунт пользователя ${userID} удален.`);
});

bot.command("start", (ctx) =>
  ctx.reply("👋 Добро пожаловать! Используйте /add для добавления 2FA.")
);

bot.catch((err) => console.error("Bot error:", err));

bot.start().then(() => console.log("Bot is running...."));
