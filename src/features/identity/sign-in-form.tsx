"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionUser } from "@/contracts/dto";
import { Button } from "@/components/ui/button";
import { Field, PhoneInput } from "@/components/ui/field";
import { OtpInput } from "@/components/ui/otp-input";
import { BottomBar } from "@/components/ui/shells";
import { cn } from "@/lib/utils";
import { consoleHome, consolePublicPath } from "./redirects";

type Channel = "WHATSAPP" | "SMS";
type ApiErrorBody = {
  error?: { code?: string; message?: string; fields?: Record<string, string> };
  retryInSeconds?: number;
};

const CHANNEL_NAME: Record<Channel, string> = {
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
};

/**
 * S02 sign-in: phone → 6-digit code → signed in. Used on park subdomains
 * (senders) and on the console (staff, `staff` set). Talks to
 * POST /api/auth/otp and /api/auth/verify; the session cookie is set by the
 * server, then the page does a full navigation to `next` so every server
 * component re-reads the session.
 */
export function SignInForm({
  title,
  intro,
  next,
  staff = false,
  footnote,
  banner,
}: {
  title: React.ReactNode;
  intro: React.ReactNode;
  /** Safe path to open after signing in (already checked by the page). */
  next: string | null;
  /** Console sign-in: send staff to their role's home when there's no `next`. */
  staff?: boolean;
  footnote: React.ReactNode;
  /** Shown under the intro, e.g. who is already signed in. */
  banner?: React.ReactNode;
}) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<Channel>("WHATSAPP");
  const [code, setCode] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<null | "send" | "verify">(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lastSubmitted = useRef("");

  // Countdown for "Resend in 0:24".
  useEffect(() => {
    if (step !== "code") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [step]);
  const waitSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const phoneDigits = phone.replace(/\D/g, "");
  const phoneReady = phoneDigits.length >= 10;

  async function sendCode(nextChannel: Channel) {
    setBusy("send");
    setPhoneError(null);
    setCodeError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, channel: nextChannel }),
      });
      const body = (await res.json().catch(() => ({}))) as ApiErrorBody & {
        channel?: Channel;
        resendInSeconds?: number;
      };
      if (res.ok) {
        setChannel(body.channel ?? nextChannel);
        setResendAt(Date.now() + (body.resendInSeconds ?? 30) * 1000);
        setNow(Date.now());
        setCode("");
        lastSubmitted.current = "";
        if (step === "code") {
          setNotice(`New code sent by ${CHANNEL_NAME[nextChannel]}.`);
        }
        setStep("code");
        return;
      }
      if (body.error?.code === "otp_resend_too_soon") {
        // A code was sent moments ago: go on to the code boxes.
        setResendAt(Date.now() + (body.retryInSeconds ?? 30) * 1000);
        setNow(Date.now());
        setStep("code");
        return;
      }
      const message = body.error?.message ?? "Couldn't send the code.";
      if (step === "phone") setPhoneError(message);
      else setCodeError(message);
    } catch {
      const message = "No connection. Check your data and try again.";
      if (step === "phone") setPhoneError(message);
      else setCodeError(message);
    } finally {
      setBusy(null);
    }
  }

  async function verify(value: string) {
    if (value.length !== 6 || busy) return;
    lastSubmitted.current = value;
    setBusy("verify");
    setCodeError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code: value }),
      });
      const body = (await res.json().catch(() => ({}))) as ApiErrorBody & {
        user?: SessionUser;
      };
      if (res.ok && body.user) {
        const home = staff ? consoleHome(body.user.role) : null;
        window.location.assign(next ?? (home ? consolePublicPath(home) : "/"));
        return; // keep the button busy while the next page loads
      }
      setCodeError(body.error?.message ?? "Couldn't check the code.");
      if (body.error?.code === "otp_wrong") setCode("");
    } catch {
      setCodeError("No connection. Check your data and try again.");
    }
    setBusy(null);
  }

  function onCodeChange(value: string) {
    setCode(value);
    setCodeError(null);
    // Submit as soon as all six digits are in (typed, pasted or autofilled).
    if (value.length === 6 && value !== lastSubmitted.current)
      void verify(value);
  }

  function changePhone() {
    setStep("phone");
    setCode("");
    setCodeError(null);
    setNotice(null);
    lastSubmitted.current = "";
  }

  const otherChannel: Channel = channel === "WHATSAPP" ? "SMS" : "WHATSAPP";

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "phone") {
          if (phoneReady) void sendCode("WHATSAPP");
        } else {
          void verify(code);
        }
      }}
    >
      <div className="flex flex-col gap-6 px-5 pt-6 pb-8">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.02em]">
            {title}
          </h1>
          <p className="text-[15px] leading-relaxed text-fg-2">{intro}</p>
          {banner}
        </div>
        <Field label="Phone number" error={phoneError}>
          {(ids) => (
            <div className="relative">
              <PhoneInput
                {...ids}
                name="phone"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneError(null);
                }}
                readOnly={step === "code"}
                autoFocus
                className={cn("h-12 text-[17px]", step === "code" && "pr-24")}
              />
              {step === "code" ? (
                <button
                  type="button"
                  onClick={changePhone}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-control px-3 py-1.5 text-sub font-medium text-fg hover:bg-sunken"
                >
                  Change
                </button>
              ) : null}
            </div>
          )}
        </Field>

        {step === "code" ? (
          <div className="flex flex-col gap-2">
            <span className="text-small font-medium text-fg-2">
              Code sent by {CHANNEL_NAME[channel]}
            </span>
            <OtpInput
              value={code}
              onChange={onCodeChange}
              autoFocus
              disabled={busy === "verify"}
              invalid={!!codeError}
              aria-label="6-digit sign-in code"
            />
            {codeError ? (
              <p role="alert" className="text-caption font-normal text-red-fg">
                {codeError}
              </p>
            ) : notice ? (
              <p role="status" className="text-caption font-normal text-fg-2">
                {notice}
              </p>
            ) : null}
            <div className="mt-1 flex items-center justify-between gap-3 text-sub">
              {waitSeconds > 0 ? (
                <span className="text-fg-3 num" aria-live="polite">
                  Resend in {Math.floor(waitSeconds / 60)}:
                  {String(waitSeconds % 60).padStart(2, "0")}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void sendCode(channel)}
                  className="font-medium text-fg underline underline-offset-4 disabled:text-fg-3"
                >
                  Resend code
                </button>
              )}
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void sendCode(otherChannel)}
                className="font-medium text-fg underline decoration-line-strong underline-offset-[6px] disabled:text-fg-3"
              >
                Send by {CHANNEL_NAME[otherChannel]} instead
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <BottomBar className="items-center gap-3">
        <Button
          type="submit"
          size="lg"
          block
          disabled={
            busy !== null || (step === "phone" ? !phoneReady : code.length < 6)
          }
        >
          {busy === "send"
            ? "Sending code…"
            : busy === "verify"
              ? "Checking…"
              : "Continue"}
        </Button>
        <p className="text-center text-[13px] text-fg-2">{footnote}</p>
      </BottomBar>
    </form>
  );
}
