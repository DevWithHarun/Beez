import { useEffect, useRef, useState } from "react";
import { Camera, Check, LoaderCircle, Mic, Sparkles, Square, Volume2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  analyseProductPhoto,
  createPhotoVersion,
  registerProductPhoto,
  transcribeStudioRequest,
  type StudioMedia,
} from "@/lib/photo-studio.functions";
import {
  MODE_LABELS,
  PHOTO_TYPES,
  explainOptions,
  normaliseInstruction,
  photoFileProblem,
  type PhotoAnalysis,
  type StudioLanguage,
  type StudioMode,
} from "@/lib/photo-studio";
import "./photo-studio.css";

export type StudioSelection = Pick<StudioMedia, "id" | "url" | "kind" | "origin">;

type Props = {
  merchantId: string;
  productName?: string | null;
  currentImageUrl?: string | null;
  onSelect: (selection: StudioSelection | null) => void;
  onAnalysis?: (analysis: PhotoAnalysis) => void;
};

const MODE_HELP: Record<StudioMode, string> = {
  enhanced: "Better light, colour and sharpness",
  studio: "Same item on a clean white background",
  promotional: "Styled scene for marketing",
};

function speak(text: string, lang: StudioLanguage) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === "sw" ? "sw-KE" : "en-KE";
  window.speechSynthesis.speak(utterance);
}

export function ProductPhotoStudio({ merchantId, productName, currentImageUrl, onSelect, onAnalysis }: Props) {
  const [lang, setLang] = useState<StudioLanguage>("en");
  const [original, setOriginal] = useState<StudioMedia | null>(null);
  const [versions, setVersions] = useState<StudioMedia[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [working, setWorking] = useState<StudioMode | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const versionsRef = useRef<StudioMedia[]>([]);

  useEffect(() => () => {
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  const all = original ? [original, ...versions] : [];
  const selected = all.find((m) => m.id === selectedId) ?? null;

  const choose = (media: StudioMedia) => {
    setSelectedId(media.id);
    onSelect({ id: media.id, url: media.url, kind: media.kind, origin: media.origin });
  };

  const announce = (items: StudioMedia[]) => {
    const text = explainOptions(items.map((m) => m.kind), productName ?? null, lang);
    setMessage(text);
    speak(text, lang);
  };

  const makeVersion = async (mode: StudioMode, change?: string | null, source = original) => {
    if (!source || working) return;
    setWorking(mode);
    setError("");
    try {
      const media = await createPhotoVersion({ data: { sourceMediaId: source.id, mode, instruction: change ?? null } });
      versionsRef.current = [...versionsRef.current, media];
      setVersions(versionsRef.current);
      announce([source, ...versionsRef.current]);
      setInstruction("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beez couldn't create this version.");
    } finally {
      setWorking(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = photoFileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setUploading(true);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${merchantId}/originals/${crypto.randomUUID()}.${ext}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
      if (uploadError) throw new Error("Your photo could not be uploaded. Please try again.");
      let media: StudioMedia;
      try {
        media = await registerProductPhoto({ data: { path } });
      } catch (e) {
        await supabase.storage.from("product-images").remove([path]);
        throw e;
      }
      setOriginal(media);
      versionsRef.current = [];
      setVersions([]);
      choose(media);
      setUploading(false);
      if (onAnalysis) {
        setAnalysing(true);
        analyseProductPhoto({ data: { mediaId: media.id, language: lang } })
          .then((analysis) => onAnalysis(analysis))
          .catch((e) => setError(e instanceof Error ? e.message : "Beez couldn't read this photo."))
          .finally(() => setAnalysing(false));
      }
      void makeVersion("enhanced", null, media);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your photo could not be uploaded.");
      setUploading(false);
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice input isn't available in this browser. Please type your change.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const audio = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (!audio.size) return;
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", audio, "change.webm");
          form.append("language", lang);
          const { transcript } = await transcribeStudioRequest({ data: form });
          if (transcript) setInstruction(transcript);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Beez couldn't hear that.");
        } finally {
          setTranscribing(false);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setError("");
      window.setTimeout(() => recorder.state === "recording" && recorder.stop(), 12_000);
    } catch {
      setError("Allow microphone access to speak your change, or type it instead.");
    }
  };

  const applyChange = () => {
    const change = normaliseInstruction(instruction);
    if (!change) return;
    const mode: StudioMode = selected && selected.kind !== "original" ? selected.kind : "enhanced";
    void makeVersion(mode, change);
  };

  return (
    <section className="photo-studio" aria-label="AI photo studio">
      <div className="photo-studio-head">
        <div>
          <strong><Sparkles aria-hidden /> AI photo studio</strong>
          <small>Take a photo of the real item. Beez improves it — you choose what customers see.</small>
        </div>
        <div className="photo-studio-lang" role="group" aria-label="Studio language">
          {(["en", "sw"] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>
              {l === "en" ? "English" : "Kiswahili"}
            </button>
          ))}
        </div>
      </div>

      {!original && (
        <button type="button" className="photo-studio-drop" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {currentImageUrl ? <img src={currentImageUrl} alt="Current product" /> : <Camera aria-hidden />}
          <span>
            {uploading ? "Uploading your photo…" : currentImageUrl ? "Take or choose a new photo" : "Take or choose a product photo"}
            <small>JPG, PNG or WebP · up to 5 MB</small>
          </span>
          {uploading && <LoaderCircle className="photo-studio-spin" aria-hidden />}
        </button>
      )}
      <input
        ref={fileRef}
        className="photo-studio-file"
        type="file"
        accept={PHOTO_TYPES.join(",")}
        capture="environment"
        aria-label="Product photo"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {original && (
        <>
          <div className="photo-studio-grid" role="radiogroup" aria-label="Photo versions">
            {all.map((media) => (
              <button
                key={media.id}
                type="button"
                role="radio"
                aria-checked={media.id === selectedId}
                className="photo-studio-option"
                onClick={() => choose(media)}
              >
                <img src={media.url} alt={`${MODE_LABELS[media.kind].en} version`} />
                <span className="photo-studio-tag">
                  {MODE_LABELS[media.kind][lang]}
                  {media.origin === "ai_presentation" && <em>AI scene</em>}
                </span>
                {media.instruction && <small className="photo-studio-note">“{media.instruction}”</small>}
                {media.id === selectedId && <Check className="photo-studio-check" aria-hidden />}
              </button>
            ))}
            {working && (
              <div className="photo-studio-option is-working" aria-live="polite">
                <LoaderCircle className="photo-studio-spin" aria-hidden />
                <span>Creating {MODE_LABELS[working].en.toLowerCase()}… this takes about a minute</span>
              </div>
            )}
          </div>

          <div className="photo-studio-modes">
            {(["enhanced", "studio", "promotional"] as const).map((mode) => (
              <button key={mode} type="button" disabled={!!working} onClick={() => void makeVersion(mode)}>
                <Wand2 aria-hidden />
                <span>{MODE_LABELS[mode][lang]}<small>{MODE_HELP[mode]}</small></span>
              </button>
            ))}
          </div>

          <label className="photo-studio-label" htmlFor="photo-studio-change">Ask for a change</label>
          <div className="photo-studio-change">
            <input
              id="photo-studio-change"
              placeholder={lang === "sw" ? "mf. Weka mandhari nyeupe" : "e.g. Make the background white"}
              value={instruction}
              maxLength={200}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyChange())}
            />
            <button
              type="button"
              className={recording ? "is-recording" : ""}
              aria-label={recording ? "Stop recording" : "Speak your change"}
              disabled={transcribing || !!working}
              onClick={() => void toggleRecording()}
            >
              {transcribing ? <LoaderCircle className="photo-studio-spin" /> : recording ? <Square /> : <Mic />}
            </button>
            <button type="button" className="photo-studio-apply" disabled={!normaliseInstruction(instruction) || !!working} onClick={applyChange}>
              Make it
            </button>
          </div>

          <div className="photo-studio-foot">
            <button type="button" onClick={() => announce(all)}><Volume2 aria-hidden /> Listen to options</button>
            <button type="button" onClick={() => fileRef.current?.click()}><Camera aria-hidden /> New photo</button>
          </div>
          {analysing && <p className="photo-studio-msg" aria-live="polite">Beez is reading your photo to suggest details…</p>}
          {message && <p className="photo-studio-msg" aria-live="polite">{message}</p>}
          <p className="photo-studio-trust">
            Beez never changes the item itself. Promotional scenes are labelled “AI-styled” for customers.
          </p>
        </>
      )}
      {error && <p role="alert" className="photo-studio-error">{error}</p>}
    </section>
  );
}
