// Pure, browser-safe logic for the Beez order assistant: intent rules,
// countdown phases and spoken replies in English and Kiswahili.

export type AgentLanguage = "en" | "sw";
export type AgentIntent =
  | "accept"
  | "decline"
  | "repeat"
  | "time_left"
  | "list"
  | "confirm_yes"
  | "confirm_no"
  | "unknown";

export interface AgentOrderItem {
  product_name: string;
  quantity: number;
  unit_price_kes: number;
}

export interface AgentOrder {
  id: string;
  total_kes: number;
  payment_status: string;
  customer_name: string;
  customer_area: string;
  is_guest: boolean;
  items_summary: string;
  items: AgentOrderItem[];
  deadline_at: string;
  created_at: string;
}

export interface ParsedCommand {
  intent: AgentIntent;
  orderId: string | null;
  /** Explicit reference made in the utterance (number, ordinal or product). */
  explicitReference: boolean;
}

const WORDS: Record<Exclude<AgentIntent, "unknown" | "confirm_yes" | "confirm_no">, string[]> = {
  accept: [
    "accept", "accepted", "approve", "take it", "take the order", "go ahead",
    "kubali", "nakubali", "ikubali", "kubaliana", "pokea", "ipokee", "chukua", "thibitisha",
  ],
  decline: [
    "decline", "reject", "refuse", "cancel", "not available", "out of stock", "sold out",
    "kataa", "nakataa", "ikatae", "ghairi", "sitaki", "haipo", "imeisha", "sina",
  ],
  repeat: ["repeat", "say again", "say that again", "again", "what was", "rudia", "sema tena", "tena"],
  time_left: ["how much time", "how long", "time left", "time remaining", "muda", "dakika ngapi", "zimebaki"],
  list: ["what orders", "which orders", "show orders", "my orders", "orders waiting", "oda gani", "oda zangu", "maagizo"],
};
const YES = ["yes", "yeah", "yep", "sure", "ok", "okay", "correct", "right", "ndiyo", "ndio", "sawa", "naam", "kweli"];
const NO = ["no", "nope", "not now", "stop", "hapana", "la", "acha", "wacha"];
const NEGATORS = ["don't", "dont", "do not", "never", "usi", "si"];
const ORDINALS: Array<[string[], number]> = [
  [["first", "one", "1st", "kwanza", "ya kwanza", "moja"], 0],
  [["second", "two", "2nd", "pili", "ya pili", "mbili"], 1],
  [["third", "three", "3rd", "tatu", "ya tatu"], 2],
  [["fourth", "four", "4th", "nne", "ya nne"], 3],
];

export function normalize(text: string) {
  return ` ${text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function hasPhrase(text: string, phrases: string[]) {
  return phrases.some((p) => text.includes(` ${p} `));
}

function negatedAccept(text: string) {
  // "don't accept", "do not accept", "usikubali", "usiikubali"
  if (/ usi+(kubali|pokee|chukue) /.test(text)) return true;
  return NEGATORS.filter((n) => n.length > 2).some((n) =>
    WORDS.accept.some((a) => text.includes(` ${n} ${a} `)),
  );
}

export function shortRef(orderId: string) {
  const digits = orderId.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : orderId;
}

function findReference(text: string, orders: AgentOrder[]): string | null {
  // Order number spoken ("order 7657" or full id)
  const numbers = text.match(/\d{3,}/g) ?? [];
  for (const n of numbers) {
    const hit = orders.find((o) => o.id.replace(/\D/g, "").endsWith(n));
    if (hit) return hit.id;
  }
  const compact = text.replace(/\s/g, "");
  const byId = orders.find((o) => compact.includes(o.id.toLowerCase()));
  if (byId) return byId.id;
  // Product name ("the jacket one")
  const productHits = orders.filter((o) =>
    o.items.some((i) =>
      normalize(i.product_name)
        .trim()
        .split(" ")
        .filter((w) => w.length > 3)
        .some((w) => text.includes(` ${w} `) || text.includes(` ${w}s `)),
    ),
  );
  const [onlyHit] = productHits;
  if (productHits.length === 1 && onlyHit) return onlyHit.id;
  if (orders.length > 1) {
    for (const [words, index] of ORDINALS) {
      if (hasPhrase(text, words.map((w) => `${w} order`).concat(words.map((w) => `order ${w}`), words.map((w) => `oda ${w}`), words.map((w) => `the ${w}`)))) {
        return orders[index]?.id ?? null;
      }
    }
  }
  return null;
}

/** Rule-based understanding for the clear, common commands in English and Kiswahili. */
export function parseCommand(transcript: string, orders: AgentOrder[]): ParsedCommand {
  const text = normalize(transcript);
  const reference = findReference(text, orders);
  const base = { orderId: reference, explicitReference: reference !== null };
  if (!text.trim()) return { intent: "unknown", ...base };

  const acceptHit = hasPhrase(text, WORDS.accept) || / (ni)?mekubali /.test(text);
  const declineHit = hasPhrase(text, WORDS.decline);
  if (negatedAccept(text)) return { intent: "decline", ...base };
  if (acceptHit && !declineHit) return { intent: "accept", ...base };
  if (declineHit && !acceptHit) return { intent: "decline", ...base };
  if (acceptHit && declineHit) return { intent: "unknown", ...base };

  if (hasPhrase(text, WORDS.time_left)) return { intent: "time_left", ...base };
  if (hasPhrase(text, WORDS.repeat)) return { intent: "repeat", ...base };
  if (hasPhrase(text, WORDS.list)) return { intent: "list", ...base };
  const yes = hasPhrase(text, YES);
  const no = hasPhrase(text, NO);
  if (yes && !no) return { intent: "confirm_yes", ...base };
  if (no && !yes) return { intent: "confirm_no", ...base };
  return { intent: "unknown", ...base };
}

export type Resolution =
  | { kind: "execute"; orderId: string }
  | { kind: "ask_which" }
  | { kind: "none_waiting" }
  | { kind: "unknown_order" };

/**
 * Decide which order a consequential command targets. With several orders
 * waiting and no explicit reference, Beez must ask which one.
 */
export function resolveTarget(
  parsed: Pick<ParsedCommand, "orderId">,
  orders: AgentOrder[],
): Resolution {
  if (!orders.length) return { kind: "none_waiting" };
  if (parsed.orderId) {
    return orders.some((o) => o.id === parsed.orderId)
      ? { kind: "execute", orderId: parsed.orderId }
      : { kind: "unknown_order" };
  }
  const [only] = orders;
  if (orders.length === 1 && only) return { kind: "execute", orderId: only.id };
  return { kind: "ask_which" };
}

export type CountdownPhase = "initial" | "midway" | "urgent" | "expired";
export const URGENT_SECONDS = 20;

export function countdownPhase(remainingMs: number, totalMs: number): CountdownPhase {
  if (remainingMs <= 0) return "expired";
  if (remainingMs <= URGENT_SECONDS * 1000) return "urgent";
  if (remainingMs <= totalMs / 2) return "midway";
  return "initial";
}

export function formatCountdown(remainingMs: number) {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function itemsPhrase(order: AgentOrder, lang: AgentLanguage) {
  const items = order.items.length
    ? order.items.map((i) => `${i.quantity} ${i.product_name}`)
    : [order.items_summary || (lang === "sw" ? "bidhaa" : "items")];
  if (items.length <= 1) return items.join("");
  const joiner = lang === "sw" ? " na " : " and ";
  return `${items.slice(0, -1).join(", ")}${joiner}${items[items.length - 1]}`;
}

function secondsPhrase(remainingMs: number, lang: AgentLanguage) {
  const secs = Math.max(0, Math.ceil(remainingMs / 1000));
  if (secs >= 60) {
    const mins = Math.floor(secs / 60);
    const rest = secs % 60;
    if (lang === "sw") return rest ? `dakika ${mins} na sekunde ${rest}` : `dakika ${mins}`;
    const m = `${mins} minute${mins === 1 ? "" : "s"}`;
    return rest ? `${m} and ${rest} seconds` : m;
  }
  return lang === "sw" ? `sekunde ${secs}` : `${secs} seconds`;
}

const paid = (o: AgentOrder) => o.payment_status === "Paid";

export const say = {
  newOrder(o: AgentOrder, remainingMs: number, lang: AgentLanguage) {
    const ref = shortRef(o.id);
    return lang === "sw"
      ? `Una oda mpya${paid(o) ? " iliyolipwa" : ""}, namba ${ref}: ${itemsPhrase(o, lang)}, shilingi ${o.total_kes}. Una ${secondsPhrase(remainingMs, lang)} kujibu. Nikubali oda hii kwa niaba yako?`
      : `You have a new${paid(o) ? " paid" : ""} order, number ${ref}: ${itemsPhrase(o, lang)}, worth ${o.total_kes} shillings. You have ${secondsPhrase(remainingMs, lang)} to respond. Would you like me to accept this order for you?`;
  },
  reminder(o: AgentOrder, remainingMs: number, lang: AgentLanguage) {
    const ref = shortRef(o.id);
    return lang === "sw"
      ? `Ukumbusho: oda ${ref} bado inasubiri jibu lako. Zimebaki ${secondsPhrase(remainingMs, lang)}. Sema kubali au kataa.`
      : `Reminder: order ${ref} is still waiting for you. ${secondsPhrase(remainingMs, lang)} left. Say accept or decline.`;
  },
  urgent(o: AgentOrder, remainingMs: number, lang: AgentLanguage) {
    const ref = shortRef(o.id);
    return lang === "sw"
      ? `Haraka! Oda ${ref} itaisha baada ya ${secondsPhrase(remainingMs, lang)}.`
      : `Hurry! Order ${ref} expires in ${secondsPhrase(remainingMs, lang)}.`;
  },
  accepted(o: AgentOrder | undefined, orderId: string, lang: AgentLanguage) {
    const ref = shortRef(orderId);
    const what = o ? itemsPhrase(o, lang) : lang === "sw" ? "bidhaa" : "the items";
    return lang === "sw"
      ? `Tayari! Nimekubali oda ${ref}. Tafadhali andaa ${what}. Nitakujulisha mpeleka mzigo atakapopatikana.`
      : `Done! I have accepted order ${ref} for you. Please prepare ${what}. I will let you know when a rider is assigned.`;
  },
  declined(orderId: string, lang: AgentLanguage) {
    const ref = shortRef(orderId);
    return lang === "sw" ? `Sawa. Nimekataa oda ${ref}. Mteja atajulishwa.` : `Okay. I have declined order ${ref}. The customer will be told.`;
  },
  expired(orderId: string, lang: AgentLanguage) {
    const ref = shortRef(orderId);
    return lang === "sw"
      ? `Muda wa oda ${ref} umeisha, kwa hivyo siwezi kuikubali tena. Oda imefungwa na mteja atajulishwa.`
      : `Time ran out for order ${ref}, so it can no longer be accepted. The order has been closed and the customer will be told.`;
  },
  notAwaiting(orderId: string, lang: AgentLanguage) {
    const ref = shortRef(orderId);
    return lang === "sw" ? `Oda ${ref} haisubiri jibu tena.` : `Order ${ref} is no longer waiting for a response.`;
  },
  askWhich(orders: AgentOrder[], lang: AgentLanguage) {
    const refs = orders.map((o) => shortRef(o.id)).join(lang === "sw" ? ", " : ", ");
    return lang === "sw"
      ? `Kuna oda ${orders.length} zinazosubiri: ${refs}. Ni ipi? Taja namba ya oda.`
      : `There are ${orders.length} orders waiting: ${refs}. Which one? Say the order number.`;
  },
  confirm(intent: "accept" | "decline", orderId: string, lang: AgentLanguage) {
    const ref = shortRef(orderId);
    if (lang === "sw") return intent === "accept" ? `Nikubali oda ${ref}? Sema ndiyo au hapana.` : `Nikatae oda ${ref}? Sema ndiyo au hapana.`;
    return intent === "accept" ? `Should I accept order ${ref}? Say yes or no.` : `Should I decline order ${ref}? Say yes or no.`;
  },
  cancelled(lang: AgentLanguage) {
    return lang === "sw" ? "Sawa, sijafanya chochote." : "Okay, I have not changed anything.";
  },
  timeLeft(o: AgentOrder, remainingMs: number, lang: AgentLanguage) {
    const ref = shortRef(o.id);
    return lang === "sw" ? `Oda ${ref}: zimebaki ${secondsPhrase(remainingMs, lang)}.` : `Order ${ref}: ${secondsPhrase(remainingMs, lang)} left.`;
  },
  list(orders: AgentOrder[], lang: AgentLanguage) {
    if (!orders.length) return say.noneWaiting(lang);
    const parts = orders.map((o) => `${shortRef(o.id)}, ${itemsPhrase(o, lang)}`);
    return lang === "sw"
      ? `Una oda ${orders.length} zinazosubiri: ${parts.join("; ")}.`
      : `You have ${orders.length} order${orders.length === 1 ? "" : "s"} waiting: ${parts.join("; ")}.`;
  },
  noneWaiting(lang: AgentLanguage) {
    return lang === "sw" ? "Hakuna oda inayosubiri jibu sasa hivi." : "No orders are waiting for you right now.";
  },
  unknownOrder(lang: AgentLanguage) {
    return lang === "sw" ? "Sikupata oda hiyo kati ya zinazosubiri." : "I couldn't find that order among the ones waiting.";
  },
  didNotUnderstand(lang: AgentLanguage) {
    return lang === "sw" ? "Samahani, sikuelewa. Sema kubali au kataa." : "Sorry, I didn't catch that. Say accept or decline.";
  },
  failed(lang: AgentLanguage) {
    return lang === "sw" ? "Samahani, sikuweza kukamilisha hilo. Hakuna kilichobadilika. Jaribu tena." : "Sorry, I couldn't complete that, so nothing was changed. Please try again.";
  },
  welcome(count: number, lang: AgentLanguage) {
    if (lang === "sw") return count ? `Karibu tena! Una oda ${count} zinazosubiri jibu lako.` : "Karibu tena! Hakuna oda inayosubiri sasa hivi.";
    return count
      ? `Welcome back! You have ${count} order${count === 1 ? "" : "s"} waiting for your attention.`
      : "Welcome back! No orders are waiting right now.";
  },
};
