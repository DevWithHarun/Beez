import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth },
}));

import { OtpStep, PhoneStep } from "@/components/onboarding";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("phone verification steps", () => {
  it("explains what is needed when continuing without a valid number", async () => {
    render(
      <PhoneStep
        title="Sign in"
        desc="Enter your phone number"
        phone=""
        setPhone={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a valid Kenyan phone number");
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("sends a code and advances when the phone number is valid", async () => {
    auth.signInWithOtp.mockResolvedValueOnce({ error: null });
    const onNext = vi.fn();
    render(
      <PhoneStep
        title="Sign in"
        desc="Enter your phone number"
        phone="0712 345 678"
        setPhone={vi.fn()}
        onNext={onNext}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(auth.signInWithOtp).toHaveBeenCalledWith({ phone: "+254712345678" });
      expect(onNext).toHaveBeenCalledOnce();
    });
  });

  it("does not create an account when requesting a login code", async () => {
    auth.signInWithOtp.mockResolvedValueOnce({ error: null });
    render(
      <PhoneStep
        title="Sign in"
        desc="Enter your phone number"
        phone="0712 345 678"
        setPhone={vi.fn()}
        onNext={vi.fn()}
        shouldCreateUser={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(auth.signInWithOtp).toHaveBeenCalledWith({
        phone: "+254712345678",
        options: { shouldCreateUser: false },
      });
    });
  });

  it("sends an OTP and reports rejected requests", async () => {
    auth.signInWithOtp.mockRejectedValueOnce(new Error("Network unavailable"));
    const onNext = vi.fn();
    render(
      <PhoneStep
        title="Sign in"
        desc="Enter your phone number"
        phone="712345678"
        setPhone={vi.fn()}
        onNext={onNext}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ phone: "+254712345678" });
    expect(onNext).not.toHaveBeenCalled();
  });

  it("accepts a pasted code and verifies it", async () => {
    auth.verifyOtp.mockResolvedValueOnce({ error: null });
    const onNext = vi.fn();
    render(<OtpStep title="Verify your number" phone="0712 345 678" onNext={onNext} />);

    fireEvent.paste(screen.getByRole("textbox", { name: "Digit 1 of 6" }), {
      clipboardData: { getData: () => "123 456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(auth.verifyOtp).toHaveBeenCalledWith({
        phone: "+254712345678",
        token: "123456",
        type: "sms",
      });
    });
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("shows verification failures and allows retrying", async () => {
    auth.verifyOtp.mockRejectedValueOnce(new Error("Temporary network error"));
    render(<OtpStep title="Verify your number" phone="712345678" onNext={vi.fn()} />);

    fireEvent.paste(screen.getByRole("textbox", { name: "Digit 1 of 6" }), {
      clipboardData: { getData: () => "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Temporary network error");
    expect(screen.getByRole("button", { name: "Verify" })).toBeEnabled();
  });

  it("does not create an account when resending a login code", async () => {
    vi.useFakeTimers();
    auth.signInWithOtp.mockResolvedValueOnce({ error: null });
    render(<OtpStep title="Sign in" phone="0712 345 678" onNext={vi.fn()} shouldCreateUser={false} />);

    for (let second = 0; second < 45; second++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
    }
    fireEvent.click(screen.getByRole("button", { name: "Resend" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      phone: "+254712345678",
      options: { shouldCreateUser: false },
    });
  });
});
