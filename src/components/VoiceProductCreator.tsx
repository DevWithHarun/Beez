import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Mic, Pause, Square, Upload, Volume2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import "./VoiceProductCreator.css";
import {
  mergeVoiceProductUpdates,
  missingVoiceProductFields,
  type VoiceProductDraft,
} from "@/lib/voice-product";

type VoiceLanguage = "auto" | "en" | "sw";
type Props = {
  onClose: () => void;
  onPublish: (draft: VoiceProductDraft, image: File | null) => Promise<void>;
};
type RequestState =
  | "ready"
  | "recording"
  | "transcribing"
  | "extracting"
  | "reviewing"
  | "refining"
  | "confirming"
  | "publishing"
  | "success";
type RefineResponse = {
  updates: VoiceProductDraft;
  clarification_question: string | null;
};

const MAX_RECORDING_MS = 60_000;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const fieldLabels: Record<keyof VoiceProductDraft, string> = {
  name: "Product name",
  category: "Category",
  price_kes: "Price",
  stock: "Quantity",
};

async function invokeVoiceFunction<T>(
  body: FormData | Record<string, unknown>,
  signal?: AbortSignal,
) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) throw new Error("Please sign in again to continue.");
  const { data, error } = await supabase.functions.invoke<T>("voice-product", {
    body,
    ...(signal ? { signal } : {}),
  });
  if (error) {
    if ("context" in error && error.context instanceof Response) {
      const result = await error.context.json().catch(() => null);
      if (typeof result?.error === "string") throw new Error(result.error);
    }
    throw new Error("Voice product creation is unavailable. Please try again.");
  }
  if (!data) throw new Error("Voice product creation returned no result.");
  return data;
}

export function VoiceProductCreator({ onClose, onPublish }: Props) {
  const [state, setState] = useState<RequestState>("ready");
  const [language, setLanguage] = useState<VoiceLanguage>("auto");
  const [playbackLanguage, setPlaybackLanguage] = useState<"en" | "sw">("en");
  const [draft, setDraft] = useState<VoiceProductDraft | null>(null);
  const [transcript, setTranscript] = useState("");
  const [changedFields, setChangedFields] = useState<(keyof VoiceProductDraft)[]>([]);
  const [clarification, setClarification] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [error, setError] = useState("");
  const [playbackMessage, setPlaybackMessage] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const recordingStartRef = useRef(false);
  const recordingPurposeRef = useRef<"new" | "refine">("new");
  const mountedRef = useRef(true);
  const pendingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const latestDraftRef = useRef<VoiceProductDraft | null>(null);

  useEffect(() => {
    latestDraftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!image) {
      setImagePreview("");
      return;
    }
    const preview = URL.createObjectURL(image);
    setImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [image]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      window.speechSynthesis?.cancel();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.onerror = null;
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const updateDraft = (next: VoiceProductDraft) => {
    latestDraftRef.current = next;
    setDraft(next);
  };

  const processRecording = async (blob: Blob, purpose: "new" | "refine") => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setError("");
    try {
      const form = new FormData();
      form.set("action", "transcribe");
      form.set("language", language);
      form.set("audio", blob, "product-voice");
      setState("transcribing");
      const { transcript: spokenWords } = await invokeVoiceFunction<{ transcript: string }>(
        form,
        controller.signal,
      );
      setTranscript(spokenWords);
      if (purpose === "new") {
        setState("extracting");
        const result = await invokeVoiceFunction<{ draft: VoiceProductDraft }>(
          {
            action: "extract",
            transcript: spokenWords,
          },
          controller.signal,
        );
        updateDraft(result.draft);
        setChangedFields([]);
        setClarification("");
      } else {
        const current = latestDraftRef.current;
        if (!current) throw new Error("Start a product draft before making a change.");
        setState("refining");
        const result = await invokeVoiceFunction<RefineResponse>(
          {
            action: "refine",
            transcript: spokenWords,
            draft: current,
          },
          controller.signal,
        );
        const merged = mergeVoiceProductUpdates(current, result.updates);
        updateDraft(merged.draft);
        setChangedFields(merged.changedFields);
        setClarification(result.clarification_question ?? "");
        speakSummary(merged.draft);
      }
      setState("reviewing");
    } catch (requestError) {
      if (mountedRef.current && !controller.signal.aborted) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Voice request failed. Please try again.",
        );
        setState(latestDraftRef.current ? "reviewing" : "ready");
      }
    } finally {
      pendingRef.current = false;
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (recorder?.state === "recording") recorder.stop();
  };

  const startRecording = async (purpose: "new" | "refine") => {
    if (state === "recording" || pendingRef.current || recordingStartRef.current) return;
    recordingStartRef.current = true;
    setError("");
    setPlaybackMessage("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(
        "Voice recording is not supported here. Use HTTPS on a supported browser, or add the product manually.",
      );
      recordingStartRef.current = false;
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const mimeType =
        typeof MediaRecorder.isTypeSupported === "function"
          ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((candidate) =>
              MediaRecorder.isTypeSupported(candidate),
            )
          : undefined;
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recordingPurposeRef.current = purpose;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setError("Recording stopped unexpectedly. Please try again.");
        setState(latestDraftRef.current ? "reviewing" : "ready");
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 100) {
          setError(
            "We did not hear enough. Hold the microphone and speak clearly, then try again.",
          );
          setState(latestDraftRef.current ? "reviewing" : "ready");
          return;
        }
        void processRecording(blob, recordingPurposeRef.current);
      };
      recorder.start();
      setState("recording");
      recordingStartRef.current = false;
      timerRef.current = window.setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch (recordingError) {
      recordingStartRef.current = false;
      if (!mountedRef.current) return;
      const permissionDenied =
        recordingError instanceof DOMException &&
        (recordingError.name === "NotAllowedError" ||
          recordingError.name === "PermissionDeniedError");
      setError(
        permissionDenied
          ? "Beez needs microphone permission to hear the product. Allow microphone access in your browser settings, or add the product manually."
          : "The microphone could not be started. Check that it is connected and try again.",
      );
      setState(latestDraftRef.current ? "reviewing" : "ready");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const generateDraftFromTranscript = async () => {
    if (!transcript.trim()) {
      setError("Add or record the product details first.");
      return;
    }
    setError("");
    setState("extracting");
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const result = await invokeVoiceFunction<{ draft: VoiceProductDraft }>(
        {
          action: "extract",
          transcript: transcript.trim(),
        },
        controller.signal,
      );
      updateDraft(result.draft);
      setChangedFields([]);
      setClarification("");
      setPlaybackLanguage(language === "sw" ? "sw" : "en");
      speakSummary(result.draft, language === "sw" ? "sw" : "en");
      setState("reviewing");
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "The product details could not be understood.",
        );
        setState("reviewing");
      }
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  };

  const speakSummary = (targetDraft = draft, targetLanguage: "en" | "sw" = playbackLanguage) => {
    if (!targetDraft) return;
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setPlaybackMessage(
        "Audio playback is not available in this browser. You can still review the details on screen.",
      );
      return;
    }
    window.speechSynthesis.cancel();
    const parts =
      targetLanguage === "sw"
        ? [
            targetDraft.name ? `Bidhaa: ${targetDraft.name}.` : "Jina la bidhaa linahitajika.",
            targetDraft.category ? `Aina: ${targetDraft.category}.` : "Aina ya bidhaa inahitajika.",
            targetDraft.price_kes !== null
              ? `Bei ni shilingi ${targetDraft.price_kes}.`
              : "Bei inahitajika.",
            targetDraft.stock !== null
              ? `Idadi iliyopo ni ${targetDraft.stock}.`
              : "Idadi ya bidhaa inahitajika.",
          ]
        : [
            targetDraft.name ? `Product: ${targetDraft.name}.` : "Product name still needed.",
            targetDraft.category ? `Category: ${targetDraft.category}.` : "Category still needed.",
            targetDraft.price_kes !== null
              ? `Price: ${targetDraft.price_kes} Kenyan shillings.`
              : "Price still needed.",
            targetDraft.stock !== null
              ? `Quantity available: ${targetDraft.stock}.`
              : "Quantity still needed.",
          ];
    try {
      const utterance = new SpeechSynthesisUtterance(parts.join(" "));
      utterance.lang = targetLanguage === "sw" ? "sw-KE" : "en-KE";
      utterance.onerror = () =>
        setPlaybackMessage(
          "Audio playback failed. Your product details are still saved in this draft.",
        );
      setPlaybackMessage("");
      window.speechSynthesis.speak(utterance);
    } catch {
      setPlaybackMessage(
        "Audio playback failed. Your product details are still saved in this draft.",
      );
    }
  };

  const editField = (field: keyof VoiceProductDraft, value: string) => {
    if (!draft) return;
    const next: VoiceProductDraft = {
      ...draft,
      ...(field === "name" ? { name: value || null } : {}),
      ...(field === "category" ? { category: value || null } : {}),
      ...(field === "price_kes" ? { price_kes: value === "" ? null : Number(value) } : {}),
      ...(field === "stock" ? { stock: value === "" ? null : Number(value) } : {}),
    };
    updateDraft(next);
    setChangedFields([]);
  };

  const cancelWorkflow = () => {
    abortControllerRef.current?.abort();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      recorderRef.current.onerror = null;
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    window.speechSynthesis?.cancel();
    onClose();
  };

  const publish = async () => {
    if (!draft || missingVoiceProductFields(draft).length || pendingRef.current) return;
    pendingRef.current = true;
    setState("publishing");
    setError("");
    try {
      await onPublish(draft, image);
      setState("success");
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Product could not be published. Your draft is still here.",
      );
      setState("reviewing");
    } finally {
      pendingRef.current = false;
    }
  };

  const busy = ["transcribing", "extracting", "refining", "publishing"].includes(state);
  const missingFields = draft ? missingVoiceProductFields(draft) : [];
  const invalidNumbers =
    draft !== null &&
    [draft.price_kes, draft.stock].some(
      (value) => value !== null && (!Number.isSafeInteger(value) || value < 0),
    );

  return (
    <div
      className="voice-product-backdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget && state !== "publishing" && cancelWorkflow()
      }
    >
      <section
        className="voice-product-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-product-title"
      >
        <button
          className="voice-product-close"
          onClick={cancelWorkflow}
          disabled={state === "publishing"}
          aria-label="Close voice product creation"
        >
          <X />
        </button>
        <div className="voice-product-heading">
          <span className="voice-product-icon">
            <Mic />
          </span>
          <div>
            <h2 id="voice-product-title">Create a product with your voice</h2>
            <p>Speak naturally. Check every detail before publishing.</p>
          </div>
          {transcript && state !== "recording" && (
            <details className="voice-product-transcript">
              <summary>Check or correct what Beez heard</summary>
              <textarea
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                maxLength={4000}
                rows={3}
                aria-label="Transcript"
              />
              <button
                className="voice-product-secondary"
                onClick={() => void generateDraftFromTranscript()}
                disabled={busy}
              >
                Create details from these words
              </button>
            </details>
          )}
        </div>

        {state === "success" ? (
          <div className="voice-product-success" role="status">
            <Check />
            <h3>Product published</h3>
            <p>Your product is now in your catalogue.</p>
            <button className="voice-product-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : !draft ? (
          <div className="voice-product-body">
            <p className="voice-product-instructions">
              Tell Beez what you are selling. Say the product name, category, price in shillings,
              and how many you have. Speak naturally in English or Kiswahili.
            </p>
            <label className="voice-product-label" htmlFor="voice-product-language">
              Spoken language
            </label>
            <select
              id="voice-product-language"
              value={language}
              onChange={(event) => setLanguage(event.target.value as VoiceLanguage)}
            >
              <option value="auto">English and Kiswahili / mixed</option>
              <option value="sw">Kiswahili</option>
              <option value="en">English</option>
            </select>
            <div className="voice-product-actions">
              <button
                className={`voice-product-mic ${state === "recording" ? "is-recording" : ""}`}
                onClick={() =>
                  state === "recording" ? stopRecording() : void startRecording("new")
                }
                disabled={busy}
                aria-label={state === "recording" ? "Stop recording" : "Start recording"}
              >
                {state === "recording" ? <Square /> : <Mic />}
              </button>
              <div>
                <strong>
                  {state === "recording"
                    ? "Listening…"
                    : state === "transcribing"
                      ? "Writing down your words…"
                      : state === "extracting"
                        ? "Preparing your product details…"
                        : "Tap the microphone to begin"}
                </strong>
                <small>
                  {state === "recording"
                    ? "Tap again when you are finished. Recording stops after one minute."
                    : "Your recording is sent securely for transcription."}
                </small>
              </div>
            </div>
          </div>
        ) : (
          <div className="voice-product-body">
            <div className="voice-product-step">Review your product details</div>
            <p className="voice-product-instructions">
              Listen, read, or correct anything that needs changing.
            </p>
            <label className="voice-product-label" htmlFor="voice-product-review-language">
              Spoken language for corrections
            </label>
            <select
              id="voice-product-review-language"
              value={language}
              onChange={(event) => setLanguage(event.target.value as VoiceLanguage)}
            >
              <option value="auto">English and Kiswahili / mixed</option>
              <option value="sw">Kiswahili</option>
              <option value="en">English</option>
            </select>
            <div className="voice-product-review">
              <label>
                Product name
                <input
                  value={draft.name ?? ""}
                  onChange={(event) => editField("name", event.target.value)}
                  maxLength={120}
                />
              </label>
              <label>
                Category
                <input
                  value={draft.category ?? ""}
                  onChange={(event) => editField("category", event.target.value)}
                  maxLength={100}
                />
              </label>
              <label>
                Price (KES)
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={draft.price_kes ?? ""}
                  onChange={(event) => editField("price_kes", event.target.value)}
                />
              </label>
              <label>
                Quantity
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={draft.stock ?? ""}
                  onChange={(event) => editField("stock", event.target.value)}
                />
              </label>
            </div>
            {missingFields.length > 0 && (
              <p className="voice-product-warning" role="status">
                Please confirm: {missingFields.map((field) => fieldLabels[field]).join(", ")}.
              </p>
            )}
            {invalidNumbers && (
              <p className="voice-product-warning" role="alert">
                Price and quantity must be whole numbers zero or higher.
              </p>
            )}
            {clarification && (
              <p className="voice-product-warning" role="status">
                {clarification}
              </p>
            )}
            {changedFields.length > 0 && (
              <p className="voice-product-changes" role="status">
                Updated: {changedFields.map((field) => fieldLabels[field]).join(", ")}
              </p>
            )}

            <details className="voice-product-transcript">
              <summary>Check or correct what Beez heard</summary>
              <textarea
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                maxLength={4000}
                rows={3}
                aria-label="Transcript"
              />
              <button
                className="voice-product-secondary"
                onClick={() => void generateDraftFromTranscript()}
                disabled={busy}
              >
                Update details from these words
              </button>
            </details>

            <div className="voice-product-listen">
              <label className="voice-product-audio-language">
                Read aloud in
                <select
                  value={playbackLanguage}
                  onChange={(event) => setPlaybackLanguage(event.target.value as "en" | "sw")}
                >
                  <option value="en">English</option>
                  <option value="sw">Kiswahili</option>
                </select>
              </label>
              <button className="voice-product-secondary" onClick={() => speakSummary()}>
                <Volume2 /> Read details aloud
              </button>
              <button
                className="voice-product-secondary"
                onClick={() => window.speechSynthesis?.cancel()}
              >
                <Pause /> Stop audio
              </button>
              {playbackMessage && <p role="status">{playbackMessage}</p>}
            </div>

            <div className="voice-product-correction">
              <p>Want to change something? Tap and say the correction.</p>
              <button
                className="voice-product-secondary"
                onClick={() =>
                  state === "recording" ? stopRecording() : void startRecording("refine")
                }
                disabled={busy}
              >
                {state === "recording" ? (
                  <>
                    <Square /> Stop recording
                  </>
                ) : state === "refining" || state === "transcribing" ? (
                  <>
                    <LoaderCircle className="voice-product-spin" /> Working…
                  </>
                ) : (
                  <>
                    <Mic /> Speak a change
                  </>
                )}
              </button>
            </div>

            <div className="voice-product-image">
              <label htmlFor="voice-product-image">
                <Upload /> Add a real product photo (optional)
              </label>
              <input
                id="voice-product-image"
                type="file"
                accept={allowedImageTypes.join(",")}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (!allowedImageTypes.includes(file.type) || file.size > MAX_IMAGE_SIZE) {
                    setError("Choose a JPG, PNG, WebP, or AVIF photo up to 5 MB.");
                    event.target.value = "";
                    return;
                  }
                  setError("");
                  setImage(file);
                  event.target.value = "";
                }}
              />
              {image && (
                <div className="voice-product-image-preview">
                  <img src={imagePreview} alt="Product photo preview" />
                  <span>{image.name}</span>
                  <button onClick={() => setImage(null)} aria-label="Remove product photo">
                    <X />
                  </button>
                </div>
              )}
              <small>
                AI product-image generation is not configured. You can upload a real photo or skip
                this.
              </small>
            </div>

            <div className="voice-product-footer">
              <button
                className="voice-product-secondary"
                onClick={() => {
                  updateDraft({ name: null, category: null, price_kes: null, stock: null });
                  setTranscript("");
                  setChangedFields([]);
                  setClarification("");
                  setImage(null);
                  setError("");
                  setState("ready");
                }}
              >
                Start over
              </button>
              <button
                className="voice-product-primary"
                onClick={() => {
                  speakSummary();
                  setState("confirming");
                }}
                disabled={missingFields.length > 0 || invalidNumbers}
              >
                Review before publishing
              </button>
            </div>
          </div>
        )}

        {state === "confirming" && draft && (
          <div
            className="voice-product-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="voice-product-confirm-title"
          >
            <h3 id="voice-product-confirm-title">Is everything correct?</h3>
            <p>
              {draft.name}, {draft.category}. KES {draft.price_kes}, quantity {draft.stock}.
            </p>
            <p>Publishing makes this product visible to customers.</p>
            <div className="voice-product-footer">
              <button className="voice-product-secondary" onClick={() => setState("reviewing")}>
                Make more changes
              </button>
              <button
                className="voice-product-primary"
                onClick={() => void publish()}
                disabled={busy}
              >
                <Check /> Publish product
              </button>
            </div>
          </div>
        )}
        {error && (
          <p className="voice-product-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="voice-product-cancel"
          onClick={cancelWorkflow}
          disabled={state === "publishing"}
        >
          Cancel and return to products
        </button>
      </section>
    </div>
  );
}
