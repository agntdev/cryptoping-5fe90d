import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { data } from "../crypto.js";
import { confirmKeyboard, inlineButton, inlineKeyboard, paginate, registerMainMenuItem } from "../toolkit/index.js";
registerMainMenuItem({ label: "My list", data: "watchlist:show:0", order: 20 });
const composer = new Composer<Ctx>();
async function show(ctx: Ctx, page: number) { const list = data(ctx).watchlist; if (!list.length) { await ctx.reply("No coins in your list yet — tap Add coin to start.", { reply_markup: inlineKeyboard([[inlineButton("Add coin", "addcoin:start")]]) }); return; } const pg = paginate(list, { page, perPage: 5, callbackPrefix: "watchlist" }); const rows = pg.pageItems.map((coin) => [inlineButton(`Remove ${coin.symbol}`, `watchlist:remove:${coin.symbol}`), inlineButton(`Alerts for ${coin.symbol}`, "alerts:show:0")]); const markup = inlineKeyboard([...rows, ...pg.controls.inline_keyboard, [inlineButton("Add coin", "addcoin:start"), inlineButton("Back to menu", "menu:main")]]); const text = `Your list (${list.length})\n${pg.pageItems.map((coin) => `${coin.name} (${coin.symbol})`).join("\n")}`; if (ctx.callbackQuery) await ctx.editMessageText(text, { reply_markup: markup }); else await ctx.reply(text, { reply_markup: markup }); }
composer.callbackQuery(/^watchlist:show:(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx, Number(ctx.match[1])); });
composer.callbackQuery(/^watchlist:(?:next|prev):(\d+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx, Number(ctx.match[1])); });
composer.callbackQuery(/^watchlist:remove:([A-Z0-9]+)$/, async (ctx) => { await ctx.answerCallbackQuery(); const symbol = ctx.match[1]; await ctx.editMessageText(`Remove ${symbol} from your list? Its alerts will stay available until you disable them.`, { reply_markup: confirmKeyboard(`watchlist:confirm:${symbol}`) }); });
composer.callbackQuery(/^watchlist:confirm:([A-Z0-9]+):(yes|no)$/, async (ctx) => { await ctx.answerCallbackQuery(); const [, symbol, answer] = ctx.match; if (answer === "yes") { const d = data(ctx); d.watchlist = d.watchlist.filter((coin) => coin.symbol !== symbol); await ctx.editMessageText(`${symbol} was removed from your list.`, { reply_markup: inlineKeyboard([[inlineButton("View my list", "watchlist:show:0")]]) }); } else await show(ctx, 0); });
export default composer;
