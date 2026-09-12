import type { Ctx } from "./bot.js";
import { data, fmtPrice, isQuiet, now, ruleSummary } from "./crypto.js";
import { inlineButton, inlineKeyboard } from "./toolkit/index.js";

export type PricePoint = { price: number; at: number; change24h?: number };

/** Evaluate a user's stored rules. A scheduler may call this with a fresh market snapshot. */
export async function evaluateAlerts(ctx: Ctx, quotes: Record<string, PricePoint>, at = now()): Promise<number> {
  const d = data(ctx); let fired = 0;
  for (const rule of d.rules) {
    if (!rule.active) continue;
    const quote = quotes[rule.ticker]; if (!quote) continue;
    const triggered = rule.type === "price" ? quote.price >= rule.threshold : (quote.change24h ?? 0) >= rule.threshold;
    if (!triggered || (rule.lastFiredAt !== undefined && at - rule.lastFiredAt < rule.cooldown * 3_600_000)) continue;
    if (isQuiet(d.profile, at)) {
      d.notices.push({ id: `q${at}-${rule.id}`, ticker: rule.ticker, ruleId: rule.id, status: "queued", at, queuedUntil: at + 12 * 3_600_000 });
      continue;
    }
    try {
      await ctx.api.sendMessage(ctx.chat!.id, `Alert: ${ruleSummary(rule)}. Current price: ${fmtPrice(quote.price)}.`, { reply_markup: inlineKeyboard([[inlineButton("View rule", "alerts:show:0"), inlineButton("Disable", `alert:disable:${rule.id}`)]]) });
      rule.lastFiredAt = at; d.notices.push({ id: `n${at}-${rule.id}`, ticker: rule.ticker, ruleId: rule.id, status: "delivered", at }); fired++;
    } catch { /* A blocked chat must not prevent other scheduled work. */ }
  }
  return fired;
}

/** Deliver due quiet-hour notices only when their price condition remains true. */
export async function deliverQueuedAlerts(ctx: Ctx, quotes: Record<string, PricePoint>, at = now()): Promise<number> {
  const d = data(ctx); if (isQuiet(d.profile, at)) return 0; let delivered = 0;
  for (const notice of d.notices.filter((item) => item.status === "queued")) {
    const rule = d.rules.find((item) => item.id === notice.ruleId); const quote = quotes[notice.ticker];
    const holds = !!rule && !!quote && (rule.type === "price" ? quote.price >= rule.threshold : (quote.change24h ?? 0) >= rule.threshold);
    if (!holds || (notice.queuedUntil !== undefined && notice.queuedUntil < at)) { notice.status = "delivered"; continue; }
    try { await ctx.api.sendMessage(ctx.chat!.id, `Queued alert: ${ruleSummary(rule!)}. Current price: ${fmtPrice(quote.price)}.`); notice.status = "delivered"; rule!.lastFiredAt = at; delivered++; } catch { /* user may have blocked the bot */ }
  }
  return delivered;
}
