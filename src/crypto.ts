import type { Ctx } from "./bot.js";

export type Coin = { symbol: string; name: string; id: string };
export type Rule = { id: string; ticker: string; type: "price" | "percent"; threshold: number; window: number; cooldown: number; active: boolean; lastFiredAt?: number; createdAt: number };
export type Notice = { id: string; ticker: string; ruleId?: string; status: "delivered" | "queued" | "summary"; at: number; queuedUntil?: number };
export type Profile = { timezone: string; quietStart: string; quietEnd: string; dailySummary: boolean; summaryTime: string; cooldown: number; createdAt: number; updatedAt: number };
export type CryptoData = { profile: Profile; watchlist: Coin[]; rules: Rule[]; notices: Notice[] };

export const COINS: Coin[] = [
  { symbol: "BTC", name: "Bitcoin", id: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", id: "ethereum" },
  { symbol: "TON", name: "Toncoin", id: "the-open-network" },
];
export const now = () => Date.now();

export function data(ctx: Ctx): CryptoData {
  if (!ctx.cryptoData) {
    const t = now();
    ctx.cryptoData = { profile: { timezone: "UTC", quietStart: "23:00", quietEnd: "07:00", dailySummary: false, summaryTime: "09:00", cooldown: 4, createdAt: t, updatedAt: t }, watchlist: [], rules: [], notices: [] };
  }
  return ctx.cryptoData;
}
export function findCoin(symbol: string): Coin | undefined { return COINS.find((c) => c.symbol === symbol.toUpperCase()); }
export function fmtPrice(value: number): string { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value < 1 ? 6 : 2 }).format(value); }
export function localTime(zone: string, at = now()): string { try { return new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at); } catch { return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at); } }
export function validZone(zone: string): boolean { try { Intl.DateTimeFormat(undefined, { timeZone: zone }); return true; } catch { return false; } }
export function isQuiet(profile: Profile, at = now()): boolean { const t = localTime(profile.timezone, at); return profile.quietStart < profile.quietEnd ? t >= profile.quietStart && t < profile.quietEnd : t >= profile.quietStart || t < profile.quietEnd; }
export function validTime(value: string): boolean { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
export function clearFlow(ctx: Ctx): void { ctx.session.step = undefined; ctx.session.pending = undefined; }

type Market = { usd: number; usd_24h_change: number };
export async function prices(coins: Coin[]): Promise<Record<string, Market>> {
  if (!coins.length) return {};
  const ids = [...new Set(coins.map((c) => c.id))].join(",");
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`);
      if (response.ok) return await response.json() as Record<string, Market>;
      last = new Error(`Price source returned ${response.status}`);
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) { last = error; }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw last instanceof Error ? last : new Error("Price source unavailable");
}
export async function resolveTicker(input: string): Promise<Coin | undefined> {
  const known = findCoin(input); if (known) return known;
  const query = input.trim().toLowerCase();
  if (!/^[a-z0-9 -]{2,24}$/.test(query)) return undefined;
  const response = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error("Ticker lookup unavailable");
  const payload = await response.json() as { coins?: Array<{ id: string; symbol: string; name: string }> };
  const match = payload.coins?.find((coin) => coin.symbol.toLowerCase() === query) ?? payload.coins?.[0];
  return match ? { id: match.id, symbol: match.symbol.toUpperCase(), name: match.name } : undefined;
}
export function ruleSummary(rule: Rule): string { return rule.type === "price" ? `${rule.ticker} at ${fmtPrice(rule.threshold)}` : `${rule.ticker} moves ${rule.threshold > 0 ? "+" : ""}${rule.threshold}% over ${rule.window === 60 ? "1h" : `${rule.window / 60}h`}`; }
