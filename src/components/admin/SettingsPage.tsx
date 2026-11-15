import { useEffect, useState, type FormEvent } from "react";
import { PageTitle } from "@/components/admin/AdminShell";
import { changeAdminPassword } from "@/lib/admin-data";
import { supabase } from "@/integrations/supabase/client";

type AdminAccount = {
  email: string;
  emailConfirmed: boolean;
};

export function SettingsPage() {
  const [account, setAccount] = useState<AdminAccount | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(
      ({ data, error }) => {
        if (!active) return;
        if (error) {
          setAccountError(error.message);
          return;
        }
        if (!data.user?.email) {
          setAccountError("Could not find an email for the signed-in admin account.");
          return;
        }
        setAccount({
          email: data.user.email,
          emailConfirmed: Boolean(data.user.email_confirmed_at),
        });
      },
      (error: unknown) => {
        if (!active) return;
        setAccountError(
          error instanceof Error ? error.message : "Could not load your admin account.",
        );
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);
    setNotice(null);

    if (newPassword.length < 8) {
      setActionError("Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setActionError("The new password and confirmation do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setActionError("Choose a new password that differs from your current password.");
      return;
    }

    setBusy(true);
    try {
      await changeAdminPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Password updated successfully.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-page">
      <PageTitle title="Settings" sub="Your administrator account and security" />

      <section className="ad-card">
        <h2>Admin account</h2>
        {accountError && (
          <p className="ad-msg" role="alert">
            {accountError}
          </p>
        )}
        {!account && !accountError && (
          <p className="ad-muted" role="status">
            Loading account details…
          </p>
        )}
        {account && (
          <div>
            <p>
              <span className="ad-muted">Email</span>
              <br />
              <strong>{account.email}</strong>
            </p>
            <p className="ad-muted">
              Email status: {account.emailConfirmed ? "Confirmed" : "Not confirmed"}
            </p>
            <p className="ad-muted">Administrator access is managed by your Beez admin.</p>
          </div>
        )}
      </section>

      <form className="ad-card ad-login" onSubmit={submit}>
        <h2>Change password</h2>
        <p className="ad-muted">Verify your current password before saving a new one.</p>
        <label>
          Current password
          <input
            className="ad-input"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <label>
          New password
          <input
            className="ad-input"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        <label>
          Confirm new password
          <input
            className="ad-input"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>
        {actionError && (
          <p className="ad-msg" role="alert">
            {actionError}
          </p>
        )}
        {notice && (
          <p className="ad-muted" role="status">
            {notice}
          </p>
        )}
        <button className="ad-btn" disabled={busy}>
          {busy ? "Updating password…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
