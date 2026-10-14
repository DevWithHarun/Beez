import { useEffect, useState, type FormEvent } from "react";
import { updateProfile, type BeezUserSession } from "@/shared/auth/session";
import "./merchant-profile.css";

export default function MerchantProfile({ user }: { user: BeezUserSession }) {
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [language, setLanguage] = useState<"en" | "sw">(user.language === "sw" ? "sw" : "en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setDisplayName(user.displayName ?? "");
    setLanguage(user.language === "sw" ? "sw" : "en");
  }, [user.displayName, user.language]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = displayName.trim();
    if (!name) {
      setError("Please enter your name.");
      setNotice("");
      return;
    }
    if (name.length > 120) {
      setError("Your name must be 120 characters or fewer.");
      setNotice("");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      await updateProfile({ displayName: name, language });
      setNotice("Your profile has been updated.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your profile could not be saved. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDisplayName(user.displayName ?? "");
    setLanguage(user.language === "sw" ? "sw" : "en");
    setError("");
    setNotice("");
  }

  const changed =
    displayName.trim() !== (user.displayName ?? "") ||
    language !== (user.language === "sw" ? "sw" : "en");

  return (
    <section className="role-profile merchant-profile">
      <span className="role-workspace-eyebrow">ACCOUNT</span>
      <h1>Your profile</h1>
      <p className="role-dashboard-intro">
        Update the name shown in your Beez account and your preferred language.
      </p>

      <form className="merchant-profile-form" onSubmit={(event) => void submit(event)}>
        <label>
          Your name
          <input
            autoComplete="name"
            maxLength={120}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setError("");
              setNotice("");
            }}
            required
            value={displayName}
          />
        </label>
        <label>
          Preferred language
          <select
            onChange={(event) => {
              setLanguage(event.target.value as "en" | "sw");
              setError("");
              setNotice("");
            }}
            value={language}
          >
            <option value="en">English</option>
            <option value="sw">Kiswahili</option>
          </select>
        </label>

        <div className="merchant-profile-readonly">
          <div>
            <span>Sign-in phone</span>
            <strong>{user.phone}</strong>
            <small>To change this number, contact Beez support so it can be verified.</small>
          </div>
          <div>
            <span>Account status</span>
            <strong>{user.onboardingStatus.replaceAll("_", " ").toLowerCase()}</strong>
          </div>
          <div>
            <span>Shop</span>
            <strong>{user.shopName ?? "Not set"}</strong>
            <small>Manage your public shop name and location in Shop &amp; Products.</small>
          </div>
        </div>

        {error && (
          <p className="role-workspace-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="merchant-profile-success" role="status">
            {notice}
          </p>
        )}

        <div className="merchant-profile-actions">
          <button className="role-dashboard-action" disabled={busy || !changed} type="submit">
            {busy ? "Saving profile…" : "Save changes"}
          </button>
          {changed && (
            <button
              className="merchant-profile-cancel"
              disabled={busy}
              onClick={reset}
              type="button"
            >
              Discard changes
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
