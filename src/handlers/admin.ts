import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { data } from "../crypto.js";
import { adminChatId, inlineButton, inlineKeyboard, registerMainMenuItem, requireOwner } from "../toolkit/index.js";
registerMainMenuItem({ label: "Owner controls", data: "admin:open", order: 90 });
const composer = new Composer<Ctx>();
composer.callbackQuery("admin:open", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx))) return; const owner = adminChatId(ctx as Ctx & { env?: Record<string, unknown> }); if (!owner) return; const d = data(ctx); await ctx.reply(`Owner controls\nActive alerts: ${d.rules.filter((r) => r.active).length}\nAlert deliveries: ${d.notices.filter((n) => n.status === "delivered").length}`, { reply_markup: inlineKeyboard([[inlineButton("Daily report", "admin:report")]]) }); });
composer.callbackQuery("admin:report", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx))) return; const notices = data(ctx).notices.filter((notice) => notice.status === "delivered"); const counts = notices.reduce<Record<string, number>>((out, notice) => { out[notice.ticker] = (out[notice.ticker] ?? 0) + 1; return out; }, {}); const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([ticker, count]) => `${ticker} (${count})`).join(", ") || "None"; await ctx.reply(`Daily usage report\nAlerts fired: ${notices.filter((notice) => notice.ruleId).length}\nTop tickers: ${top}\nActive users: 1`); });
export default composer;
