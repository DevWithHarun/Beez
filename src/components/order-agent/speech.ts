// Browser speech helpers for the Beez order assistant: a prioritised speaking
// queue (one message at a time, no duplicates) and one-shot listening.
import type { AgentLanguage } from "@/lib/order-agent";

export type SpeechPriority = 0 | 1 | 2; // 2 critical, 1 action required, 0 info

interface QueuedSpeech {
  key: string;
  text: string;
  priority: SpeechPriority;
}

const voiceLang = (lang: AgentLanguage) => (lang === "sw" ? "sw-KE" : "en-KE");

function pickVoice(lang: AgentLanguage) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  const prefix = lang === "sw" ? "sw" : "en";
  return (
    voices.find((v) => v.lang.toLowerCase() === voiceLang(lang).toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ??
    undefined
  );
}

export function speechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export class SpeechQueue {
  private queue: QueuedSpeech[] = [];
  private current: QueuedSpeech | null = null;
  private recent = new Map<string, number>();
  constructor(
    private getLang: () => AgentLanguage,
    private getRate: () => number,
    private onIdle: () => void,
    private onSpeaking: (text: string | null) => void,
  ) {}

  enqueue(item: QueuedSpeech) {
    if (!speechSupported()) {
      this.onSpeaking(item.text);
      this.onIdle();
      return;
    }
    const last = this.recent.get(item.key);
    if (last && Date.now() - last < 4000) return;
    if (this.current?.key === item.key || this.queue.some((q) => q.key === item.key)) return;
    if (this.current && item.priority > this.current.priority) {
      // Interrupt lower-priority speech; it is not repeated.
      this.current = null;
      window.speechSynthesis.cancel();
    }
    this.queue.push(item);
    this.queue.sort((a, b) => b.priority - a.priority);
    if (!this.current) this.next();
  }

  clear() {
    this.queue = [];
    this.current = null;
    if (speechSupported()) window.speechSynthesis.cancel();
    this.onSpeaking(null);
  }

  get busy() {
    return Boolean(this.current) || this.queue.length > 0;
  }

  private next() {
    const item = this.queue.shift();
    if (!item) {
      this.current = null;
      this.onIdle();
      return;
    }
    this.current = item;
    this.recent.set(item.key, Date.now());
    this.onSpeaking(item.text);
    const lang = this.getLang();
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.lang = voiceLang(lang);
    const voice = pickVoice(lang);
    if (voice) utterance.voice = voice;
    utterance.rate = this.getRate();
    const done = () => {
      if (this.current !== item) return;
      this.current = null;
      this.next();
    };
    utterance.onend = done;
    utterance.onerror = done;
    window.speechSynthesis.speak(utterance);
  }
}

type RecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

export function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function recordingSupported() {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Listen once with the browser's speech recognition. Resolves with the transcript ("" on silence). */
export function listenOnce(lang: AgentLanguage, register: (abort: () => void) => void): Promise<string> {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return Promise.reject(new Error("unsupported"));
  return new Promise((resolve, reject) => {
    const rec = new Ctor();
    rec.lang = voiceLang(lang);
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    let heard = "";
    rec.onresult = (event) => {
      heard = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
    };
    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") resolve("");
      else reject(new Error(event.error));
    };
    rec.onend = () => resolve(heard);
    register(() => rec.abort());
    rec.start();
  });
}

/** Record a short clip for server transcription on browsers without speech recognition. */
export async function recordClip(register: (stop: () => void) => void, maxMs = 7000): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => recorder.state !== "inactive" && recorder.stop(), maxMs);
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onerror = () => reject(new Error("Recording failed"));
    recorder.onstop = () => {
      window.clearTimeout(timer);
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
    };
    register(() => recorder.state !== "inactive" && recorder.stop());
    recorder.start();
  });
}

export function playChime(urgent = false) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = urgent ? [880, 660, 880] : [660, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
    window.setTimeout(() => void ctx.close(), 1200);
  } catch {
    // Audio cues are optional.
  }
}
