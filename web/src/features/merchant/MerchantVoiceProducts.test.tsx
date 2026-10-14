import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MerchantVoiceProducts from "./MerchantVoiceProducts";

vi.mock("./api", () => ({
  createMerchantProducts: vi.fn(),
  extractMerchantVoiceProducts: vi.fn(),
}));

afterEach(cleanup);

describe("MerchantVoiceProducts", () => {
  it("requires consent and keeps manual entry available when recording is unsupported", () => {
    const onManualEntry = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MerchantVoiceProducts onManualEntry={onManualEntry} />
      </QueryClientProvider>,
    );

    const recordButton = screen.getByRole("button", { name: "Start recording" });
    expect(recordButton).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(recordButton).toBeEnabled();
    fireEvent.click(recordButton);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Voice recording is not supported in this browser.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Prefer typing? Add products manually" }));
    expect(onManualEntry).toHaveBeenCalledOnce();
  });
});
