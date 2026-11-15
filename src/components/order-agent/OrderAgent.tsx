import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, Mic, MicOff, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import {
  countdownPhase,
  formatCountdown,
  parseCommand,
  say,
  shortRef,
  type AgentLanguage,
  type AgentOrder,
} from "@/lib/order-agent";
import {
  getOrderAgentState,
  interpretOrderCommand,
  respondToOrder,
  transcribeOrderCommand,
} from "@/lib/order-agent.functions";
import {
  SpeechQueue,
  getRecognitionCtor,
  listenOnce,
  playChime,
  recordClip,
  recordingSupported,
  speechSupported,
  type SpeechPriority,
} from "./speech";
import "./order-agent.css";

export const orderAgentQuery = queryOptions({
  queryKey: ["order-agent"],
  queryFn: () => getOrderAgentState(),
  staleTime: 0,
  // Backstop for missed live updates; live changes also refresh this immediately.
  refetchInterval: 30_000,
});

type ListenState = "idle" | "listening" | "thinking" | "acting";
type Pending = { intent: "accept" | "decline"; orderId: string } | null;

const LANG_KEY = "beez-agent-lang";
const VOICE_KEY = "beez-agent-voice";
const SLOW_KEY = "beez-agent-slow";

export function OrderAgent({ onChanged }: { onChanged?: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery(orderAgentQuery);
  const [lang, setLang] = useState<AgentLanguage>("en");
  const [voiceOn, setVoiceOn] = useState(false);
  const [slow, setSlow] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [offset, setOffset] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [beezText, setBeezText] = useState("");
  const [heard, setHeard] = useState("");
  const [listen, setListen] = useState<ListenState>("idle");
  const [pending, setPending] = useState<Pending>(null);
  const [collapsed, setCollapsed] = useState(false);

  const langRef = useRef(lang);
  langRef.current = lang;
  const slowRef = useRef(slow);
  slowRef.current = slow;
  const voiceRef = useRef(voiceOn);
  voiceRef.current = voiceOn;
  const announced = useRef(new Map<string, Set<string>>());
  const wantsAnswer = useRef(false);
  const abortListen = useRef<(() => void) | null>(null);
  const startListeningRef = useRef<() => void>(() => {});

  const queue = useMemo(
    () =>
      new SpeechQueue(
        () => langRef.current,
        () => (slowRef.current ? 0.82 : 1),
        () => {
          if (wantsAnswer.current && voiceRef.current) {
            wantsAnswer.current = false;
            window.setTimeout(() => startListeningRef.current(), 250);
          }
        },
        (text) => text && setBeezText(text),
      ),
    [],
  );

  useEffect(() => {
    const storedLang = window.localStorage.getItem(LANG_KEY);
    if (storedLang === "sw" || storedLang === "en") setLang(storedLang);
    setVoiceOn(window.localStorage.getItem(VOICE_KEY) === "on");
    setSlow(window.localStorage.getItem(SLOW_KEY) === "on");
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => {
      window.clearInterval(id);
      queue.clear();
      abortListen.current?.();
    };
  }, [queue]);

  useEffect(() => {
    if (data?.serverNow) setOffset(Date.parse(data.serverNow) - Date.now());
  }, [data?.serverNow]);

  const orders = data?.orders ?? [];
  const serverNow = now + offset;
  const totalMs = (data?.responseSeconds ?? 120) * 1000;
  const remainingOf = useCallback((o: AgentOrder) => Date.parse(o.deadline_at) - serverNow, [serverNow]);
  const live = orders.filter((o) => remainingOf(o) > -5000);
  const focus = live.find((o) => o.id === focusId) ?? live[0] ?? null;

  const speak = useCallback(
    (key: string, text: string, priority: SpeechPriority, expectAnswer = false) => {
      setBeezText(text);
      if (expectAnswer) wantsAnswer.current = true;
      if (voiceRef.current) queue.enqueue({ key, text, priority });
      else if (expectAnswer) wantsAnswer.current = false;
    },
    [queue],
  );

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: orderAgentQuery.queryKey });
    onChanged?.();
  }, [qc, onChanged]);

  // Announcements driven by the server deadline.
  useEffect(() => {
    for (const o of orders) {
      const done = announced.current.get(o.id) ?? new Set<string>();
      announced.current.set(o.id, done);
      const remaining = remainingOf(o);
      const phase = countdownPhase(remaining, totalMs);
      if (!done.has("initial")) {
        done.add("initial");
        if (phase !== "expired") {
          setCollapsed(false);
          if (voiceRef.current) playChime();
          speak(`new-${o.id}`, say.newOrder(o, remaining, langRef.current), 1, true);
          if (phase === "midway") done.add("midway");
          if (phase === "urgent") done.add("midway").add("urgent");
        }
      }
      if (phase === "midway" && !done.has("midway")) {
        done.add("midway");
        speak(`mid-${o.id}`, say.reminder(o, remaining, langRef.current), 1, true);
      }
      if (phase === "urgent" && !done.has("urgent")) {
        done.add("midway").add("urgent");
        if (voiceRef.current) playChime(true);
        speak(`urgent-${o.id}`, say.urgent(o, remaining, langRef.current), 2, true);
      }
      if (phase === "expired" && !done.has("expired")) {
        done.add("expired");
        speak(`expired-${o.id}`, say.expired(o.id, langRef.current), 2);
        window.setTimeout(() => void refresh(), 1200);
      }
    }
  }, [orders, remainingOf, totalMs, speak, refresh]);

  const execute = useCallback(
    async (decision: "accept" | "decline", orderId: string, channel: "voice" | "touch", transcript?: string) => {
      setListen("acting");
      setPending(null);
      const order = orders.find((o) => o.id === orderId);
      try {
        const result = await respondToOrder({
          data: { orderId, decision, channel, requestId: crypto.randomUUID(), transcript },
        });
        const l = langRef.current;
        const text =
          result.outcome === "accepted"
            ? say.accepted(order, orderId, l)
            : result.outcome === "declined"
              ? say.declined(orderId, l)
              : result.outcome === "expired"
                ? say.expired(orderId, l)
                : say.notAwaiting(orderId, l);
        announced.current.get(orderId)?.add("expired");
        speak(`result-${orderId}-${result.outcome}`, text, 2);
        await refresh();
      } catch {
        speak(`failed-${orderId}-${Date.now()}`, say.failed(langRef.current), 2);
      } finally {
        setListen("idle");
      }
    },
    [orders, speak, refresh],
  );

  const handleTranscript = useCallback(
    async (transcript: string) => {
      setHeard(transcript);
      const l = langRef.current;
      if (!transcript) {
        setListen("idle");
        return;
      }
      if (pending) {
        const local = parseCommand(transcript, orders);
        if (local.intent === "confirm_yes" || local.intent === pending.intent) {
          await execute(pending.intent, pending.orderId, "voice", transcript);
          return;
        }
        if (local.intent === "confirm_no" || (local.intent !== "unknown" && local.intent !== pending.intent)) {
          setPending(null);
          speak(`cancel-${Date.now()}`, say.cancelled(l), 1);
          setListen("idle");
          return;
        }
      }
      setListen("thinking");
      try {
        const result = await interpretOrderCommand({ data: { transcript, language: l } });
        const target = orders.find((o) => o.id === (result.orderId ?? focus?.id));
        if (result.intent === "accept" || result.intent === "decline") {
          if (result.resolution === "execute" && result.orderId) {
            if (result.needsConfirmation) {
              setPending({ intent: result.intent, orderId: result.orderId });
              setFocusId(result.orderId);
              speak(`confirm-${result.orderId}-${Date.now()}`, say.confirm(result.intent, result.orderId, l), 1, true);
              setListen("idle");
              return;
            }
            await execute(result.intent, result.orderId, "voice", transcript);
            return;
          }
          const text =
            result.resolution === "ask_which"
              ? say.askWhich(orders, l)
              : result.resolution === "none_waiting"
                ? say.noneWaiting(l)
                : say.unknownOrder(l);
          speak(`resolve-${Date.now()}`, text, 1, result.resolution === "ask_which");
        } else if (result.intent === "repeat" && target) {
          speak(`repeat-${Date.now()}`, say.newOrder(target, remainingOf(target), l), 1, true);
        } else if (result.intent === "time_left" && target) {
          speak(`time-${Date.now()}`, say.timeLeft(target, remainingOf(target), l), 1);
        } else if (result.intent === "list") {
          speak(`list-${Date.now()}`, say.list(orders, l), 1);
        } else if ((result.intent === "confirm_yes" || result.intent === "confirm_no") && !orders.length) {
          speak(`none-${Date.now()}`, say.noneWaiting(l), 0);
        } else {
          speak(`unknown-${Date.now()}`, say.didNotUnderstand(l), 1);
        }
      } catch {
        speak(`failed-${Date.now()}`, say.failed(l), 2);
      }
      setListen("idle");
    },
    [pending, orders, focus, execute, speak, remainingOf],
  );

  const startListening = useCallback(async () => {
    if (listen === "listening") {
      abortListen.current?.();
      return;
    }
    queue.clear();
    setHeard("");
    setListen("listening");
    try {
      if (getRecognitionCtor()) {
        const transcript = await listenOnce(langRef.current, (abort) => (abortListen.current = abort));
        await handleTranscript(transcript);
      } else if (recordingSupported()) {
        const clip = await recordClip((stop) => (abortListen.current = stop));
        setListen("thinking");
        const form = new FormData();
        form.set("audio", clip, "command.webm");
        form.set("language", langRef.current);
        const { transcript } = await transcribeOrderCommand({ data: form });
        await handleTranscript(transcript);
      } else {
        setBeezText(
          langRef.current === "sw"
            ? "Kifaa hiki hakiwezi kusikiliza. Tumia vitufe."
            : "This device can't listen for speech. Please use the buttons.",
        );
        setListen("idle");
      }
    } catch {
      setBeezText(
        langRef.current === "sw"
          ? "Siwezi kutumia maikrofoni. Ruhusu maikrofoni au tumia vitufe."
          : "I can't use the microphone. Allow microphone access or use the buttons.",
      );
      setListen("idle");
    } finally {
      abortListen.current = null;
    }
  }, [listen, queue, handleTranscript]);
  startListeningRef.current = () => void startListening();

  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    voiceRef.current = next;
    window.localStorage.setItem(VOICE_KEY, next ? "on" : "off");
    if (next) {
      playChime();
      speak(`welcome-${Date.now()}`, say.welcome(live.length, langRef.current), 0, live.length > 0);
    } else {
      queue.clear();
      abortListen.current?.();
    }
  };
  const changeLang = (next: AgentLanguage) => {
    setLang(next);
    langRef.current = next;
    window.localStorage.setItem(LANG_KEY, next);
    queue.clear();
    if (focus) speak(`lang-${focus.id}-${next}`, say.newOrder(focus, remainingOf(focus), next), 1, true);
  };
  const toggleSlow = () => {
    const next = !slow;
    setSlow(next);
    window.localStorage.setItem(SLOW_KEY, next ? "on" : "off");
  };

  if (!data?.merchantId) return null;
  const t = (en: string, sw: string) => (lang === "sw" ? sw : en);
  const remaining = focus ? remainingOf(focus) : 0;
  const phase = focus ? countdownPhase(remaining, totalMs) : "initial";
  const progress = focus ? Math.max(0, Math.min(1, remaining / totalMs)) : 0;
  const canListen = Boolean(getRecognitionCtor()) || recordingSupported();
  const busy = listen === "thinking" || listen === "acting";

  const controls = (
    <div className="oa-controls">
      <div className="oa-lang" role="group" aria-label={t("Language", "Lugha")}>
        {(["en", "sw"] as const).map((l) => (
          <button key={l} aria-pressed={lang === l} className={lang === l ? "on" : ""} onClick={() => changeLang(l)}>
            {l === "en" ? "English" : "Kiswahili"}
          </button>
        ))}
      </div>
      <button className={`oa-chip ${voiceOn ? "on" : ""}`} onClick={toggleVoice} aria-pressed={voiceOn}>
        {voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
        {voiceOn ? t("Voice on", "Sauti imewashwa") : t("Turn on voice", "Washa sauti")}
      </button>
      {voiceOn && (
        <button className={`oa-chip ${slow ? "on" : ""}`} onClick={toggleSlow} aria-pressed={slow}>
          {t("Slow speech", "Polepole")}
        </button>
      )}
    </div>
  );

  if (!focus || collapsed) {
    return (
      <div className="oa-dock">
        <div className="oa-pill">
          <span className="oa-bee" aria-hidden>
            🐝
          </span>
          <div className="oa-pill-text">
            <b>{t("Beez assistant", "Msaidizi wa Beez")}</b>
            <small>
              {live.length
                ? t(`${live.length} order${live.length === 1 ? "" : "s"} waiting`, `Oda ${live.length} zinasubiri`)
                : t("No orders waiting", "Hakuna oda inayosubiri")}
            </small>
          </div>
          {live.length > 0 && (
            <button className="oa-chip on" onClick={() => setCollapsed(false)}>
              {t("Respond", "Jibu")}
            </button>
          )}
        </div>
        {!live.length && controls}
      </div>
    );
  }

  return (
    <div className="oa-dock">
      <section className={`oa-card phase-${phase}`} aria-label={t("Incoming order", "Oda mpya")}>
        <header className="oa-head">
          <div>
            <span className="oa-kicker">{t("Incoming order · action required", "Oda mpya · jibu linahitajika")}</span>
            <h2>#{focus.id}</h2>
          </div>
          <button className="oa-icon" onClick={() => setCollapsed(true)} aria-label={t("Minimise", "Punguza")}>
            <X size={18} />
          </button>
        </header>

        {live.length > 1 && (
          <div className="oa-tabs" role="tablist">
            {live.map((o) => (
              <button
                key={o.id}
                role="tab"
                aria-selected={o.id === focus.id}
                className={o.id === focus.id ? "on" : ""}
                onClick={() => setFocusId(o.id)}
              >
                {shortRef(o.id)} · {formatCountdown(remainingOf(o))}
              </button>
            ))}
          </div>
        )}

        <div className="oa-body">
          <div
            className="oa-ring"
            style={{ ["--p" as string]: progress }}
            role="timer"
            aria-label={t(`${formatCountdown(remaining)} left to respond`, `Zimebaki ${formatCountdown(remaining)}`)}
          >
            <div>
              <Clock3 size={14} />
              <strong>{formatCountdown(remaining)}</strong>
              <small>{phase === "expired" ? t("Expired", "Imeisha") : t("to respond", "kujibu")}</small>
            </div>
          </div>
          <ul className="oa-facts">
            <li>
              <span>{t("Items", "Bidhaa")}</span>
              <b>
                {focus.items.length
                  ? focus.items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ")
                  : focus.items_summary || "—"}
              </b>
            </li>
            <li>
              <span>{t("Amount", "Kiasi")}</span>
              <b>KES {focus.total_kes.toLocaleString("en-KE")}</b>
            </li>
            <li>
              <span>{t("Payment", "Malipo")}</span>
              <b className={focus.payment_status === "Paid" ? "paid" : ""}>
                {focus.payment_status === "Paid" ? t("Paid", "Imelipwa") : t("Not paid yet", "Bado haijalipwa")}
              </b>
            </li>
            <li>
              <span>{t("Customer", "Mteja")}</span>
              <b>
                {focus.is_guest ? t("Guest customer", "Mteja mgeni") : focus.customer_name || "—"}
                {focus.customer_area ? ` · ${focus.customer_area}` : ""}
              </b>
            </li>
          </ul>
        </div>

        <div className="oa-says" aria-live="polite">
          <span>{t("Beez says", "Beez anasema")}</span>
          <p>{beezText || say.newOrder(focus, remaining, lang)}</p>
          {focus && voiceOn && (
            <button
              className="oa-replay"
              onClick={() => speak(`replay-${Date.now()}`, say.newOrder(focus, remainingOf(focus), lang), 1, true)}
            >
              <RotateCcw size={13} /> {t("Replay", "Rudia")}
            </button>
          )}
          {heard && (
            <p className="oa-heard">
              {t("You said", "Umesema")}: “{heard}”
            </p>
          )}
        </div>

        <div className="oa-actions">
          {canListen && (
            <button
              className={`oa-mic ${listen === "listening" ? "live" : ""}`}
              onClick={() => void startListening()}
              disabled={busy || phase === "expired"}
              aria-label={listen === "listening" ? t("Stop listening", "Acha kusikiliza") : t("Answer by voice", "Jibu kwa sauti")}
            >
              {listen === "listening" ? <MicOff size={22} /> : <Mic size={22} />}
              <span>
                {listen === "listening"
                  ? t("Listening…", "Nasikiliza…")
                  : listen === "thinking"
                    ? t("Understanding…", "Naelewa…")
                    : listen === "acting"
                      ? t("Saving…", "Nahifadhi…")
                      : t("Speak", "Ongea")}
              </span>
            </button>
          )}
          <button
            className="oa-accept"
            disabled={busy || phase === "expired"}
            onClick={() => void execute("accept", focus.id, "touch")}
          >
            <Check size={18} /> {t("Accept", "Kubali")}
          </button>
          <button
            className="oa-decline"
            disabled={busy || phase === "expired"}
            onClick={() => void execute("decline", focus.id, "touch")}
          >
            <X size={18} /> {t("Decline", "Kataa")}
          </button>
        </div>
        {pending && (
          <p className="oa-pending">
            {say.confirm(pending.intent, pending.orderId, lang)}
          </p>
        )}
        {!speechSupported() && voiceOn && (
          <p className="oa-note">{t("Spoken alerts aren't available on this device.", "Arifa za sauti hazipatikani kwenye kifaa hiki.")}</p>
        )}
        {controls}
      </section>
    </div>
  );
}
