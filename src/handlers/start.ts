import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard } from "../toolkit/index.js";
import { data } from "../crypto.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

const WELCOME = "Track private crypto prices and alerts from one place. Your watchlist stays private.";

composer.command("start", async (ctx) => {
  const firstVisit = !ctx.cryptoData;
  data(ctx);
  await ctx.reply(WELCOME, { reply_markup: mainMenuKeyboard() });
  if (firstVisit) {
    ctx.session.step = "timezone";
    await ctx.reply("Your timezone is set to UTC for now. Reply with an IANA timezone to adjust it, or use Settings later.", {
      reply_markup: { force_reply: true, input_field_placeholder: "For example: Europe/London" },
    });
  }
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

export default composer;
