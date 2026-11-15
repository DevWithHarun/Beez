import { describe, expect, it } from "vitest";
import {
  buildStudioPrompt,
  customerImageLabel,
  isMerchantPhotoPath,
  normaliseInstruction,
  originForKind,
  photoFileProblem,
  sanitiseAnalysis,
} from "@/lib/photo-studio";

const merchant = "7b1c2f4e-0000-4000-8000-000000000001";

describe("AI photo studio rules", () => {
  it("labels the original as a real photo, enhanced/studio as touched-up, promotional as an AI presentation", () => {
    expect(originForKind("original")).toBe("photo");
    expect(originForKind("enhanced")).toBe("ai_enhanced");
    expect(originForKind("studio")).toBe("ai_enhanced");
    expect(originForKind("promotional")).toBe("ai_presentation");
  });

  it("never shows a promotional AI scene to customers without a label", () => {
    expect(customerImageLabel("ai_presentation")).toMatch(/AI-styled/);
    expect(customerImageLabel("ai_enhanced")).toMatch(/AI/);
    expect(customerImageLabel("photo")).toBeNull();
  });

  it("always tells the AI to keep the real product unchanged and never make used items look new", () => {
    for (const mode of ["enhanced", "studio", "promotional"] as const) {
      const prompt = buildStudioPrompt(mode, "make the background white");
      expect(prompt).toContain("Keep the product itself exactly as it is");
      expect(prompt).toContain("never make a used item look new");
      expect(prompt).toContain('"make the background white"');
    }
  });

  it("limits a merchant's change request to 200 characters and drops empty ones", () => {
    expect(normaliseInstruction("  ")).toBeNull();
    expect(normaliseInstruction("x".repeat(500))).toHaveLength(200);
    expect(normaliseInstruction("make\nit\tbrighter")).toBe("make it brighter");
  });

  it("only accepts photos inside the merchant's own folder", () => {
    expect(isMerchantPhotoPath(`${merchant}/originals/abc.jpg`, merchant)).toBe(true);
    expect(isMerchantPhotoPath(`other/originals/abc.jpg`, merchant)).toBe(false);
    expect(isMerchantPhotoPath(`${merchant}/originals/../x.jpg`, merchant)).toBe(false);
    expect(isMerchantPhotoPath(`${merchant}/originals/a/b.jpg`, merchant)).toBe(false);
  });

  it("accepts JPG, PNG and WebP photos up to 5 MB", () => {
    expect(photoFileProblem({ type: "image/jpeg", size: 5 * 1024 * 1024 })).toBeNull();
    expect(photoFileProblem({ type: "image/jpeg", size: 5 * 1024 * 1024 + 1 })).not.toBeNull();
    expect(photoFileProblem({ type: "image/gif", size: 1000 })).not.toBeNull();
  });

  it("keeps only safe, bounded product details from the AI", () => {
    const result = sanitiseAnalysis({
      name: "  Blue denim jacket ",
      category: "Clothing",
      description: "d".repeat(900),
      attributes: ["blue", 3, "", "denim"],
      condition: "brand-new!!",
    });
    expect(result).toEqual({
      name: "Blue denim jacket",
      category: "Clothing",
      description: "d".repeat(600),
      attributes: ["blue", "denim"],
      condition: "unclear",
    });
  });
});
