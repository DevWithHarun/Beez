import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const originalSecureContext = Object.getOwnPropertyDescriptor(window, "isSecureContext");
const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession },
    functions: { invoke },
  },
}));

import { VoiceProductCreator } from "@/components/VoiceProductCreator";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  if (originalSecureContext) {
    Object.defineProperty(window, "isSecureContext", originalSecureContext);
  } else {
    Reflect.deleteProperty(window, "isSecureContext");
  }
  if (originalMediaDevices) {
    Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
  } else {
    Reflect.deleteProperty(navigator, "mediaDevices");
  }
});

describe("voice product creator", () => {
  it("explains the product details to speak and offers language choices", () => {
    render(<VoiceProductCreator onClose={vi.fn()} onPublish={vi.fn()} />);

    expect(
      screen.getByText(/say the product name, category, price in shillings/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Spoken language" })).toHaveValue("auto");
    expect(screen.getByRole("button", { name: "Start recording" })).toBeInTheDocument();
  });

  it("handles unsupported or insecure microphone access with a clear fallback", async () => {
    render(<VoiceProductCreator onClose={vi.fn()} onPublish={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Voice recording is not supported here",
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it("allows leaving the flow without publishing a product", () => {
    const onClose = vi.fn();
    const onPublish = vi.fn();
    render(<VoiceProductCreator onClose={onClose} onPublish={onPublish} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel and return to products" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onPublish).not.toHaveBeenCalled();
  });

  it("transcribes a recording, creates a draft, and publishes only after confirmation", async () => {
    class FakeMediaRecorder {
      static isTypeSupported() {
        return true;
      }

      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(_stream: MediaStream) {}

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob([new Uint8Array(128)], { type: this.mimeType }) });
        this.onstop?.();
      }
    }

    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    getSession.mockResolvedValue({
      data: { session: { access_token: "test-token" } },
      error: null,
    });
    invoke
      .mockResolvedValueOnce({
        data: { transcript: "Tomatoes, KES 120, eight packets" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          draft: { name: "Tomatoes", category: "Groceries", price_kes: 120, stock: 8 },
        },
        error: null,
      });
    const onPublish = vi.fn().mockResolvedValue(undefined);
    render(<VoiceProductCreator onClose={vi.fn()} onPublish={onPublish} />);

    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    await screen.findByText("Listening…");
    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));

    await screen.findByDisplayValue("Tomatoes");
    expect(invoke).toHaveBeenCalledTimes(2);
    const firstInvoke = invoke.mock.calls[0];
    expect(firstInvoke?.[1]?.body).toBeInstanceOf(FormData);
    expect(onPublish).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Review before publishing" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish product" }));

    await waitFor(() =>
      expect(onPublish).toHaveBeenCalledWith(
        { name: "Tomatoes", category: "Groceries", price_kes: 120, stock: 8 },
        null,
      ),
    );
    expect(await screen.findByText("Product published")).toBeInTheDocument();
  });

  it("shows a clear microphone-permission denial and allows retry", async () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError")),
      },
    });
    vi.stubGlobal("MediaRecorder", class {});
    render(<VoiceProductCreator onClose={vi.fn()} onPublish={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Allow microphone access in your browser settings",
    );
    expect(screen.getByRole("button", { name: "Start recording" })).toBeEnabled();
  });
});
