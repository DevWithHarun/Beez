import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const upload = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
const registerProductPhoto = vi.hoisted(() => vi.fn());
const analyseProductPhoto = vi.hoisted(() => vi.fn());
const createPhotoVersion = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ upload, remove }) } },
}));
vi.mock("@/lib/photo-studio.functions", () => ({
  registerProductPhoto,
  analyseProductPhoto,
  createPhotoVersion,
  transcribeStudioRequest: vi.fn(),
}));

import { ProductPhotoStudio } from "@/components/photo-studio/ProductPhotoStudio";

const merchantId = "7b1c2f4e-0000-4000-8000-000000000001";
const original = { id: "11111111-1111-4111-8111-111111111111", kind: "original", origin: "photo", url: "https://x/o.jpg", instruction: null, sourceMediaId: null };
const enhanced = { id: "22222222-2222-4222-8222-222222222222", kind: "enhanced", origin: "ai_enhanced", url: "https://x/e.jpg", instruction: null, sourceMediaId: original.id };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AI photo studio panel", () => {
  it("uploads into the merchant's own folder, keeps the real photo selected and only switches when the merchant picks a version", async () => {
    upload.mockResolvedValue({ error: null });
    registerProductPhoto.mockResolvedValue(original);
    analyseProductPhoto.mockResolvedValue({ name: "Tomatoes", category: "Vegetables", description: "Fresh", attributes: [], condition: "unclear" });
    createPhotoVersion.mockResolvedValue(enhanced);
    const onSelect = vi.fn();
    const onAnalysis = vi.fn();
    render(<ProductPhotoStudio merchantId={merchantId} onSelect={onSelect} onAnalysis={onAnalysis} />);

    const file = new File(["img"], "t.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Product photo"), { target: { files: [file] } });

    await screen.findByAltText("Enhanced version");
    expect(upload.mock.calls[0]?.[0]).toMatch(new RegExp(`^${merchantId}/originals/[0-9a-f-]+\\.jpg$`));
    expect(createPhotoVersion).toHaveBeenCalledWith({ data: { sourceMediaId: original.id, mode: "enhanced", instruction: null } });
    await waitFor(() => expect(onAnalysis).toHaveBeenCalledWith(expect.objectContaining({ name: "Tomatoes" })));
    // The AI version is offered, but the real photo stays chosen until the merchant decides.
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: original.id, origin: "photo" }));

    fireEvent.click(screen.getByAltText("Enhanced version"));
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: enhanced.id, origin: "ai_enhanced" }));
  });

  it("sends the merchant's change request for the chosen version", async () => {
    upload.mockResolvedValue({ error: null });
    registerProductPhoto.mockResolvedValue(original);
    createPhotoVersion
      .mockResolvedValueOnce(enhanced)
      .mockResolvedValueOnce({ ...enhanced, id: "33333333-3333-4333-8333-333333333333", instruction: "make the background white" });
    render(<ProductPhotoStudio merchantId={merchantId} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Product photo"), { target: { files: [new File(["img"], "t.png", { type: "image/png" })] } });
    fireEvent.click(await screen.findByAltText("Enhanced version"));

    fireEvent.change(screen.getByLabelText("Ask for a change"), { target: { value: "make the background white" } });
    fireEvent.click(screen.getByRole("button", { name: "Make it" }));
    await waitFor(() =>
      expect(createPhotoVersion).toHaveBeenLastCalledWith({ data: { sourceMediaId: original.id, mode: "enhanced", instruction: "make the background white" } }),
    );
  });

  it("rejects photos that are too large before uploading", () => {
    render(<ProductPhotoStudio merchantId={merchantId} onSelect={vi.fn()} />);
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Product photo"), { target: { files: [big] } });
    expect(screen.getByRole("alert").textContent).toMatch(/5 MB/);
    expect(upload).not.toHaveBeenCalled();
  });
});
