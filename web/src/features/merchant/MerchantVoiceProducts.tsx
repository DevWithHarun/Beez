import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mic, MicOff, Plus, Trash2, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./merchant-voice.css";
import {
  createMerchantProducts,
  extractMerchantVoiceProducts,
  type MerchantProductInput,
  type VoiceProductDraft,
} from "./api";

type ReviewedProduct = VoiceProductDraft & { id: number };
const RECORDING_LIMIT_SECONDS = 60;

export default function MerchantVoiceProducts({ onManualEntry }: { onManualEntry: () => void }) {
  const queryClient = useQueryClient();
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recordingStartedAt = useRef(0);
  const mounted = useRef(true);
  const [consent, setConsent] = useState(false);
  const [language, setLanguage] = useState<"en" | "sw">("sw");
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [reading, setReading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [draft, setDraft] = useState<{
    transcript: string;
    products: ReviewedProduct[];
    unparsedPhrases: string[];
  } | null>(null);
  const [error, setError] = useState("");

  const publishMutation = useMutation({
    mutationFn: (products: MerchantProductInput[]) => createMerchantProducts(products),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["merchant", "products"] });
      setDraft(null);
      setError("");
    },
    onError: (cause: Error) => setError(cause.message),
  });

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartedAt.current) / 1000);
      setSeconds(Math.min(elapsed, RECORDING_LIMIT_SECONDS));
      if (elapsed >= RECORDING_LIMIT_SECONDS) recorder.current?.stop();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      window.speechSynthesis?.cancel();
    };
  }, []);

  async function startRecording() {
    setError("");
    setDraft(null);
    if (!consent) {
      setError("Please review and agree to the voice-processing consent before recording.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not supported in this browser. Add products manually instead.");
      return;
    }
    setStarting(true);
    try {
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        microphone.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = microphone;
      const supportedType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const activeRecorder = new MediaRecorder(
        microphone,
        supportedType ? { mimeType: supportedType } : undefined,
      );
      recorder.current = activeRecorder;
      chunks.current = [];
      recordingStartedAt.current = Date.now();
      setSeconds(0);
      activeRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      activeRecorder.onstop = () => {
        microphone.getTracks().forEach((track) => track.stop());
        stream.current = null;
        if (!mounted.current) return;
        setRecording(false);
        const audio = new Blob(chunks.current, {
          type: activeRecorder.mimeType || "audio/webm",
        });
        chunks.current = [];
        if (audio.size === 0) {
          setProcessing(false);
          setError("No audio was captured. Please try recording again.");
          return;
        }
        setProcessing(true);
        void extractMerchantVoiceProducts(audio, language)
          .then(
            (result) =>
              mounted.current &&
              setDraft({
                transcript: result.transcript,
                products: result.products.map((product, id) => ({ ...product, id })),
                unparsedPhrases: result.unparsedPhrases,
              }),
          )
          .catch(
            (cause: unknown) =>
              mounted.current &&
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Voice processing failed. Try again or enter products manually.",
              ),
          )
          .finally(() => mounted.current && setProcessing(false));
      };
      activeRecorder.start();
      setStarting(false);
      setRecording(true);
    } catch {
      setStarting(false);
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      setError(
        "Microphone access was unavailable. Allow microphone access or add products manually.",
      );
    }
  }

  function stopRecording() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function updateProduct(id: number, changes: Partial<ReviewedProduct>) {
    setDraft((value) =>
      value
        ? {
            ...value,
            products: value.products.map((product) =>
              product.id === id ? { ...product, ...changes } : product,
            ),
          }
        : value,
    );
  }

  function confirmProducts() {
    if (!draft || draft.products.length === 0) return;
    setError("");
    publishMutation.mutate(
      draft.products.map((product) => ({
        name: product.name.trim(),
        unit: product.unit?.trim() || null,
        priceKes: product.priceKes,
        inStock: true,
      })),
    );
  }

  function readDrafts() {
    if (!draft || !("speechSynthesis" in window)) return;
    if (reading) {
      window.speechSynthesis.cancel();
      setReading(false);
      return;
    }
    const speech = new SpeechSynthesisUtterance(
      draft.products
        .map(
          (product) =>
            `${product.name}, ${product.priceKes} Kenya shillings${product.unit ? ` per ${product.unit}` : ""}.`,
        )
        .join(" "),
    );
    speech.lang = language === "sw" ? "sw-KE" : "en-KE";
    speech.onend = () => setReading(false);
    speech.onerror = () => setReading(false);
    window.speechSynthesis.speak(speech);
    setReading(true);
  }

  const invalidDraft =
    !draft ||
    draft.products.length === 0 ||
    draft.products.some(
      (product) =>
        !product.name.trim() || !Number.isSafeInteger(product.priceKes) || product.priceKes < 0,
    );

  return (
    <section className="role-dashboard merchant-voice">
      <span className="role-workspace-eyebrow">VOICE CATALOGUE</span>
      <h1>Add products by voice</h1>
      <p className="role-dashboard-intro">
        Speak product names and prices in English or Swahili. Review every draft before anything
        appears in your shop.
      </p>

      <div className="merchant-voice-consent">
        <label>
          <input
            checked={consent}
            disabled={recording || starting || processing}
            onChange={(event) => setConsent(event.target.checked)}
            type="checkbox"
          />
          <span>
            I agree to send this recording to Beez and OpenAI to transcribe and prepare product
            drafts. Beez does not retain the audio after processing.
          </span>
        </label>
      </div>

      <div className="merchant-voice-controls">
        <label>
          Recording language
          <select
            disabled={recording || starting || processing}
            onChange={(event) => setLanguage(event.target.value as "en" | "sw")}
            value={language}
          >
            <option value="sw">Swahili</option>
            <option value="en">English</option>
          </select>
        </label>
        <p aria-live="polite" className="merchant-voice-timer">
          {recording
            ? `Recording · ${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")} / 01:00`
            : "Maximum recording length: 60 seconds"}
        </p>
        <button
          className="role-dashboard-action"
          disabled={starting || processing || (!consent && !recording)}
          onClick={() => (recording ? stopRecording() : void startRecording())}
          type="button"
        >
          {recording ? (
            <MicOff size={17} aria-hidden="true" />
          ) : (
            <Mic size={17} aria-hidden="true" />
          )}
          {starting
            ? "Opening microphone…"
            : processing
              ? "Preparing your product drafts…"
              : recording
                ? "Stop and review"
                : "Start recording"}
        </button>
      </div>

      {error && (
        <p className="role-workspace-error" role="alert">
          {error}
        </p>
      )}
      {draft && (
        <div className="merchant-voice-review">
          <h2>Review your recording</h2>
          <label className="merchant-voice-transcript">
            Transcript
            <textarea readOnly rows={3} value={draft.transcript} />
          </label>
          {"speechSynthesis" in window && draft.products.length > 0 && (
            <button className="merchant-voice-secondary" onClick={readDrafts} type="button">
              <Volume2 size={16} aria-hidden="true" />
              {reading ? "Stop reading drafts" : "Read drafts aloud"}
            </button>
          )}
          {draft.unparsedPhrases.length > 0 && (
            <aside className="merchant-voice-unparsed">
              <strong>Could not confidently prepare these details</strong>
              <ul>
                {draft.unparsedPhrases.map((phrase, index) => (
                  <li key={`${index}-${phrase}`}>{phrase}</li>
                ))}
              </ul>
              <button className="merchant-dashboard-retry" onClick={onManualEntry} type="button">
                Add unclear products manually
              </button>
            </aside>
          )}
          <div className="merchant-voice-product-list">
            {draft.products.map((product) => (
              <article className="merchant-voice-product" key={product.id}>
                <div className="merchant-voice-product-heading">
                  <strong>
                    {product.confidence < 0.75 ? "Review carefully" : "Product draft"}
                  </strong>
                  <button
                    aria-label={`Remove ${product.name || "product"}`}
                    onClick={() =>
                      setDraft((value) =>
                        value
                          ? {
                              ...value,
                              products: value.products.filter((item) => item.id !== product.id),
                            }
                          : value,
                      )
                    }
                    type="button"
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </div>
                <label>
                  Product name
                  <input
                    maxLength={120}
                    onChange={(event) => updateProduct(product.id, { name: event.target.value })}
                    required
                    value={product.name}
                  />
                </label>
                <div className="merchant-voice-product-fields">
                  <label>
                    Unit (optional)
                    <input
                      maxLength={40}
                      onChange={(event) =>
                        updateProduct(product.id, { unit: event.target.value || null })
                      }
                      value={product.unit ?? ""}
                    />
                  </label>
                  <label>
                    Price (KES)
                    <input
                      min={0}
                      onChange={(event) =>
                        updateProduct(product.id, {
                          priceKes:
                            event.target.value === "" ? Number.NaN : Number(event.target.value),
                        })
                      }
                      required
                      type="number"
                      value={Number.isNaN(product.priceKes) ? "" : product.priceKes}
                    />
                  </label>
                </div>
                <small>
                  Heard: “{product.sourcePhrase}” · {Math.round(product.confidence * 100)}%
                  confidence
                </small>
              </article>
            ))}
          </div>
          <div className="merchant-voice-review-actions">
            <button
              className="merchant-voice-secondary"
              onClick={() =>
                setDraft((value) =>
                  value
                    ? {
                        ...value,
                        products: [
                          ...value.products,
                          {
                            id: Math.max(-1, ...value.products.map((product) => product.id)) + 1,
                            name: "",
                            unit: null,
                            priceKes: Number.NaN,
                            confidence: 1,
                            sourcePhrase: "Added manually",
                          },
                        ],
                      }
                    : value,
                )
              }
              type="button"
            >
              <Plus size={16} aria-hidden="true" /> Add another product
            </button>
            <button
              className="role-dashboard-action"
              disabled={invalidDraft || publishMutation.isPending}
              onClick={confirmProducts}
              type="button"
            >
              {publishMutation.isPending
                ? "Adding products…"
                : `Confirm and add ${draft.products.length} products`}
            </button>
          </div>
        </div>
      )}

      <button className="merchant-voice-manual" onClick={onManualEntry} type="button">
        Prefer typing? Add products manually
      </button>
    </section>
  );
}
