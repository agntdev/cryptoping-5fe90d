# CryptoPing — Bot specification

**Archetype:** finance

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

Private Telegram bot that lets retail crypto traders track coins, create price and percent-change alerts with cooldowns/quiet-hours, query live prices on demand, and optionally receive a daily personal summary. Admin receives an aggregated daily usage report.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Retail crypto traders
- Crypto holders who want private price alerts
- Users who prefer lightweight, no-cost alerting

## Success criteria

- Users can add/remove tickers and create alert rules via the bot UI
- Alerts are reliably delivered to users when rules trigger, respecting user timezone, quiet hours, and cooldown settings
- /price returns current price and 24h % change for requested tickers
- Daily admin report is sent to OWNER_CHAT_ID containing total alerts triggered and top-triggered tickers
- User preferences and rules persist across sessions and restarts

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu and start onboarding
  - outputs: Main menu (inline keyboard): Add coin, My list, Alerts, Settings, /price help
- **Add coin** (button, actor: user, callback: addcoin:start) — Begin guided flow to add a coin to the private watchlist (seeded quick choices + custom ticker)
  - inputs: Choice from seeded list (Bitcoin, Ethereum, Toncoin) or 'Custom ticker' selection, If custom: typed ticker symbol (slash command not required)
  - outputs: Confirmation message on success; error and suggestions on unknown ticker
- **/price** (command, actor: user, command: /price) — Query current price: accepts a single ticker (typed) or no argument to return all tracked coins
  - inputs: Optional ticker symbol as argument or none
  - outputs: Current price and 24h % change per requested ticker
- **Create alert** (button, actor: user, callback: alert:create:start) — Guided flow to create a new alert for a tracked coin
  - inputs: Select coin (from watchlist or seeded); choose alert type; enter numeric threshold or percent; optionally set cooldown or percent window
  - outputs: Alert saved confirmation with rule summary and next eligible trigger time
- **Settings** (button, actor: user, callback: settings:open) — Open settings to set timezone, quiet hours, daily summary time, and cooldown defaults
  - inputs: Timezone selection, quiet hours start/end, daily summary toggle/time, default cooldown value
  - outputs: Acknowledgement and updated settings summary

## Flows

### Onboarding & Main Menu
_Trigger:_ /start

1. Send brief feature summary and privacy note in bot voice
2. Present inline keyboard: Add coin, My list, Alerts, Settings, /price
3. If first-time user: prompt for timezone (ForceReply) with reasonable defaults

_Data touched:_ user_profile

### Add coin (seeded or custom)
_Trigger:_ callback addcoin:start

1. Show seeded buttons: Bitcoin, Ethereum, Toncoin and 'Custom ticker'
2. If seeded selected: validate mapping to price API symbol, add watchlist item, confirm
3. If custom selected: ask user to type ticker (ForceReply); validate; on unknown show closest matches and ask to retry
4. Persist watchlist item to user_profile

_Data touched:_ watchlist_item, user_profile

### Create alert rule
_Trigger:_ callback alert:create:start

1. Choose coin (from user's watchlist) via buttons
2. Choose alert type via buttons: Price threshold or Percent-change
3. If price: ForceReply to enter target price (validate numeric and sensible)
4. If percent-change: choose window (buttons: 1h default, 24h, custom) and enter percent threshold (validate)
5. Offer per-rule cooldown (default user cooldown if unset)
6. Save rule, show summary card with rule id, next possible trigger time

_Data touched:_ alert_rule, watchlist_item, user_profile

### Price query (/price)
_Trigger:_ command /price

1. If ticker argument supplied: validate ticker and fetch real-time price + 24h % change from price API
2. If no arg: fetch prices for all user's tracked coins
3. Return compact message(s) with price and 24h % change and a button to 'Create alert' for that coin

_Data touched:_ watchlist_item, price_cache

### Alert evaluation & delivery
_Trigger:_ periodic poll / webhook from price API

1. Fetch latest prices (and historical points for percent windows) from price API with retries
2. Evaluate active alert_rules per user against latest/historical data
3. For each rule that triggers: check user's quiet hours and current time in user's timezone
4. If within quiet hours: queue notification for quiet-end; else check rule cooldown and notification_log to prevent duplicates
5. If eligible: send notification to user (inline button: View rule, Snooze, Disable), record entry in notification_log, update rule last-fired timestamp

_Data touched:_ alert_rule, notification_log, user_profile, price_cache

### Quiet hours suppression and queue delivery
_Trigger:_ alert would fire during quiet hours

1. Store queued notification with timestamp and expiry policy
2. When quiet hours end, evaluate whether queued notifications are still relevant (price condition still holds or percent change still within window)
3. Deliver if still relevant, otherwise discard and optionally notify user of suppression reason

_Data touched:_ notification_log, user_profile

### Daily summary scheduling & delivery
_Trigger:_ user enables daily summary / scheduled cron in user's timezone

1. At user-configured local time fetch current prices and recent moves
2. Assemble summary for user's tracked coins (price, 24h % change, notable triggers since last summary)
3. Send summary if user enabled; respect quiet hours by queueing if within quiet hours
4. Log delivery in notification_log

_Data touched:_ user_profile, watchlist_item, notification_log, price_cache

### Admin daily report
_Trigger:_ scheduled daily job (UTC time configurable)

1. Aggregate yesterday's counts: total alerts fired, unique active users, top-triggered tickers and top rule types
2. Send aggregated report to OWNER_CHAT_ID without exposing PII (no raw user ids unless owner explicitly requests)
3. Rotate/retain aggregated stats per retention policy

_Data touched:_ notification_log, alert_rule

### Manage watchlist & alerts
_Trigger:_ callbacks from My list or Alerts menu

1. List items with pagination buttons (if > page size)
2. Allow inline actions per item: Remove coin, View alerts, Disable alert, Edit alert (value/cooldown)
3. Confirm destructive actions with yes/no buttons

_Data touched:_ watchlist_item, alert_rule, user_profile

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Telegram chat id where the owner receives daily aggregated admin reports
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **user_profile** _(retention: persistent)_ — Per-user preferences and meta (private to user): chat id, timezone, quiet hours, daily summary time, default cooldown and preferences
  - fields: chat_id, timezone, quiet_hours_start, quiet_hours_end, daily_summary_enabled, daily_summary_time_local, default_cooldown_hours, created_at, updated_at
- **watchlist_item** _(retention: persistent)_ — A coin/ticker the user tracks (private)
  - fields: user_chat_id, ticker_symbol, display_name, mapped_price_api_id, added_at
- **alert_rule** _(retention: persistent)_ — A user-created alert rule (price-threshold or percent-change) with parameters and state
  - fields: rule_id, user_chat_id, ticker_symbol, type, threshold_value, percent_window_minutes, active, cooldown_hours, last_fired_at, created_at
- **notification_log** _(retention: persistent)_ — Record of notifications delivered or queued (used for cooldowns, reporting, and admin aggregates)
  - fields: log_id, user_chat_id (hashed for admin-only aggregates), rule_id, ticker_symbol, delivered_at, queued_until, delivery_status, payload_summary
- **price_cache** _(retention: session)_ — Short-term cached price and historical points used to compute percent-change windows and reduce API calls
  - fields: ticker_symbol, timestamp, price_usd, source, fetched_at

## Integrations

- **Telegram** (required) — Bot API messaging, inline keyboards, callbacks and slash commands
- **Public Crypto Price API** (required) — Source of real-time and recent historical prices for tickers (single configured source with retries and rate-limit handling)
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Set OWNER_CHAT_ID for admin daily report
- Pause/resume alert evaluation globally (maintenance mode)
- Adjust seeded quick-ticker list (default Bitcoin, Ethereum, Toncoin)
- View aggregated daily usage report and top-triggered tickers
- Set global defaults (default percent window, default cooldown) — optional and visible to users as defaults

## Notifications

- Immediate alert messages to user when rules trigger (unless suppressed by quiet hours or cooldown)
- Queued alerts delivered at quiet-hours end if still relevant
- Optional daily personal summary at user-selected time
- Admin aggregated daily report (total alerts, active users, top-triggered tickers)

## Permissions & privacy

- Per-user data (watchlists, alert rules, timezone, quiet hours, notification logs) is private and isolated by chat id
- Admin report is aggregated; do not include raw user identifiers in daily reports by default (owner can request more detail but must be explicit)
- Do not publish or share user watchlists or alerts publicly
- Only store minimal price_cache required for rule evaluation; respect data retention policy configured below

## Edge cases

- Unknown or ambiguous ticker symbols: present closest matches and ask user to confirm before adding
- Price API outages or rate limits: exponential backoff and graceful degradation; inform users only on major failures (avoid spam)
- User has not set timezone: default to Telegram profile timezone if available, else ask once and use sensible default
- DST changes: respect timezone library for scheduled daily summaries and quiet hours
- Queued notifications expire if condition no longer holds at quiet-end
- User deletes or blocks bot: detect and stop scheduling/delivery to that chat; retain rules for possible re-onboarding
- Overlapping alerts and cooldowns: a fired rule mutes identical rule for configured cooldown; different rules for same ticker still evaluate
- High-frequency percent-change spikes: enforce minimum evaluation interval and per-user rate limits to avoid spam
- Huge watchlist sizes or many alerts per user: enforce practical limits (missing_fields) to avoid performance issues

## Required tests

- Dialog-level acceptance: Add coin (seeded and custom), confirm it appears in My list
- Create price threshold alert and trigger it using mocked price feed; verify cooldown blocks repeated notifications for configured period
- Create percent-change alert (default 1h window) and trigger via mocked historical price points; verify correct detection and notification
- Quiet hours suppression: trigger an alert during quiet hours, verify queued delivery at quiet end only if condition still holds
- /price with ticker argument and with no arg (returns all tracked coins) including 24h % change
- Daily summary scheduling: enable summary, verify delivery at correct local time and respect quiet hours
- Admin daily report generation contains aggregated counts and top tickers and is delivered to OWNER_CHAT_ID
- Persistence tests: restart simulation and verify user_profile, watchlist_item, and alert_rule persist and behavior continues
- Ticker typo handling: enter unknown ticker and verify suggestions and retry flow

## Assumptions

- A single public crypto price API will be used; it supports symbols mapping and provides recent historical points for percent windows
- Seeded watchlist quick choices are Bitcoin, Ethereum, Toncoin as requested
- Default percent-change window is 1 hour and default threshold is 5% unless user configures otherwise
- Default quiet hours are 23:00–07:00 local time unless user changes them
- Default cooldown after a rule fires is 4 hours (configurable by user)
- No payments or premium features are included in the initial release
