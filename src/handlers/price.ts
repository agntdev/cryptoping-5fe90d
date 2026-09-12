import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { data, findCoin, fmtPrice, prices, resolveTicker, type Coin } from "../crypto.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "Price", data: "price:help", order: 50 });
const composer = new Composer<Ctx>();
async function show(ctx: Ctx, coins: Coin[]) { try { const market = await prices(coins); const lines = coins.map((coin) => { const q = market[coin.id]; return q ? `${coin.symbol}: ${fmtPrice(q.usd)} (${q.usd_24h_change >= 0 ? "+" : ""}${q.usd_24h_change.toFixed(2)}% 24h)` : `${coin.symbol}: unavailable`; }); await ctx.reply(lines.join("\n"), { reply_markup: inlineKeyboard(coins.map((coin) => [inlineButton(`Alert for ${coin.symbol}`, "alert:create:start")])) }); } catch { await ctx.reply("Live prices aren't available right now. Try again shortly."); } }
composer.command("price", async (ctx) => { const input = ctx.match?.trim(); if (!input) { const list = data(ctx).watchlist; if (!list.length) { await ctx.reply("Your list is empty. Add a coin, or use /price BTC.", { reply_markup: inlineKeyboard([[inlineButton("Add coin", "addcoin:start")]]) }); return; } await show(ctx, list); return; } try { const coin = await resolveTicker(input); if (!coin) { await ctx.reply("I couldn't find that ticker. Check the spelling and try again."); return; } await show(ctx, [coin]); } catch { await ctx.reply("I couldn't look up that ticker right now. Try again shortly."); } });
composer.callbackQuery("price:help", async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply("Send /price BTC for one coin, or /price to check your tracked coins.", { reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]) }); });
export default composer;
