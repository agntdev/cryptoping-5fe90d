import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { data, findCoin, resolveTicker, clearFlow, now, type Coin } from "../crypto.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "Add coin", data: "addcoin:start", order: 10 });
const composer = new Composer<Ctx>();
const choices = () => inlineKeyboard([[inlineButton("Bitcoin", "addcoin:BTC"), inlineButton("Ethereum", "addcoin:ETH")], [inlineButton("Toncoin", "addcoin:TON")], [inlineButton("Custom ticker", "addcoin:custom")], [inlineButton("Back to menu", "menu:main")]]);
async function add(ctx: Ctx, coin: Coin) { const d = data(ctx); if (d.watchlist.some((c) => c.id === coin.id)) { await ctx.reply(`${coin.name} is already in your list.`); return; } if (d.watchlist.length >= 50) { await ctx.reply("Your list is full. Remove a coin before adding another."); return; } d.watchlist.push(coin); d.profile.updatedAt = now(); clearFlow(ctx); await ctx.reply(`${coin.name} (${coin.symbol}) is now in your list.`, { reply_markup: inlineKeyboard([[inlineButton("View my list", "watchlist:show:0"), inlineButton("Create alert", "alert:create:start")]]) }); }
composer.callbackQuery("addcoin:start", async (ctx) => { await ctx.answerCallbackQuery(); clearFlow(ctx); await ctx.reply("Choose a coin to track.", { reply_markup: choices() }); });
composer.callbackQuery(/^addcoin:(BTC|ETH|TON)$/, async (ctx) => { await ctx.answerCallbackQuery(); const coin = findCoin(ctx.match[1]); if (coin) await add(ctx, coin); });
composer.callbackQuery("addcoin:custom", async (ctx) => { await ctx.answerCallbackQuery(); ctx.session.step = "ticker"; await ctx.reply("Send the ticker you want to add, such as SOL.", { reply_markup: { force_reply: true, input_field_placeholder: "Ticker symbol" } }); });
composer.on("message:text", async (ctx, next) => { if (ctx.session.step !== "ticker") return next(); const query = ctx.message.text.trim(); try { const coin = await resolveTicker(query); if (!coin) { await ctx.reply("I couldn't find that ticker. Check the spelling and try again, for example BTC or ETH."); return; } await add(ctx, coin); } catch { await ctx.reply("I couldn't verify that ticker right now. Try again shortly."); } });
export default composer;
