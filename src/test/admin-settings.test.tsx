import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const settings = vi.hoisted(() => ({
  changeAdminPassword: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/admin-data", () => ({
  changeAdminPassword: settings.changeAdminPassword,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: settings.getUser,
    },
  },
}));

vi.mock("@/components/admin/AdminShell", () => ({
  PageTitle: ({ title, sub }: { title: string; sub?: string }) => (
    <header>
      <h1>{title}</h1>
      <p>{sub}</p>
    </header>
  ),
}));

import { SettingsPage } from "@/components/admin/SettingsPage";

beforeEach(() => {
  settings.getUser.mockResolvedValue({
    data: {
      user: {
        email: "admin@beez.example",
        email_confirmed_at: "2026-10-20T10:00:00Z",
      },
    },
    error: null,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Admin Settings tab", () => {
  it("shows the signed-in admin account", async () => {
    render(<SettingsPage />);

    expect(await screen.findByText("admin@beez.example")).toBeInTheDocument();
    expect(screen.getByText("Email status: Confirmed")).toBeInTheDocument();
  });

  it("requires matching new passwords before reauthentication", async () => {
    render(<SettingsPage />);
    await screen.findByText("admin@beez.example");

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "current-password" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-password-123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "different-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The new password and confirmation do not match.",
    );
    expect(settings.changeAdminPassword).not.toHaveBeenCalled();
  });

  it("changes the password and clears sensitive form values on success", async () => {
    settings.changeAdminPassword.mockResolvedValue(undefined);
    render(<SettingsPage />);
    await screen.findByText("admin@beez.example");

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "old-password" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-password-123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "new-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(settings.changeAdminPassword).toHaveBeenCalledWith("old-password", "new-password-123");
    expect(await screen.findByRole("status")).toHaveTextContent("Password updated successfully.");
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm new password")).toHaveValue("");
  });

  it("surfaces password change failures", async () => {
    settings.changeAdminPassword.mockRejectedValue(new Error("Invalid login credentials"));
    render(<SettingsPage />);
    await screen.findByText("admin@beez.example");

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-password-123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "new-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid login credentials");
  });
});
