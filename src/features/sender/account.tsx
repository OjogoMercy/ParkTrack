"use client";

import { ChevronRight, LogOut, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Profile } from "@/contracts/dto";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/display";
import { Field, Input, PhoneInput, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { Card, List, Notice, Section } from "@/components/ui/surface";
import { formatPhone } from "@/lib/phone";

type ApiResult = {
  ok: boolean;
  message?: string;
  fields?: Record<string, string>;
};

/** JSON call to our own API; errors come back in the shared ApiError shape. */
async function call(
  method: "POST" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return { ok: true };
    const json = (await res.json().catch(() => null)) as {
      error?: { message?: string; fields?: Record<string, string> };
    } | null;
    return {
      ok: false,
      message: json?.error?.message ?? "Something went wrong. Try again.",
      fields: json?.error?.fields,
    };
  } catch {
    return {
      ok: false,
      message: "No connection. Check your data and try again.",
    };
  }
}

// ─── Profile ────────────────────────────────────────────────────────────────

export function ProfileCard({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile.name ?? "");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = profile.name || "Add your name";

  return (
    <>
      <Card className="flex items-center gap-3 p-4">
        <Avatar name={profile.name || profile.phone.slice(-4)} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[16px] font-semibold">{shown}</span>
          <span className="text-small text-fg-3 num">
            {formatPhone(profile.phone)}
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setName(profile.name ?? "");
            setResult(null);
            setOpen(true);
          }}
        >
          Edit
        </Button>
      </Card>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Your name"
        description="Agents and your recipients see this name. Your phone number is how you sign in, so it can’t be changed here."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const r = await call("PATCH", "/api/me", { name });
            setBusy(false);
            setResult(r);
            if (r.ok) {
              setOpen(false);
              router.refresh();
            }
          }}
        >
          <Field label="Full name" error={result?.fields?.name}>
            {(ids) => (
              <Input
                {...ids}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
              />
            )}
          </Field>
          {result && !result.ok && !result.fields ? (
            <Notice tone="red">{result.message}</Notice>
          ) : null}
          <Button type="submit" size="lg" block disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </form>
      </Sheet>
    </>
  );
}

// ─── Saved recipients ───────────────────────────────────────────────────────

export type RecipientRow = {
  id: string;
  name: string;
  phone: string;
  /** "Iwo Road Park, Ibadan", "Roadside · Owode junction" or the phone. */
  where: string;
  /** Value of the "Where they collect" select. */
  choice: string;
};

export type CollectOption = {
  /** "park:{id}" or "point:{id}" */
  value: string;
  label: string;
};

function toBody(choice: string) {
  if (choice.startsWith("point:")) {
    return {
      preferredParkId: null,
      preferredRoadsidePointId: choice.slice(6),
    };
  }
  if (choice.startsWith("park:")) {
    return { preferredParkId: choice.slice(5), preferredRoadsidePointId: null };
  }
  return { preferredParkId: null, preferredRoadsidePointId: null };
}

/** "+2348035554471" → "803 555 4471" for the +234 phone field. */
function national(e164: string): string {
  return formatPhone(e164).replace(/^\+234\s*/, "");
}

export function SavedRecipients({
  recipients,
  options,
}: {
  recipients: RecipientRow[];
  options: CollectOption[];
}) {
  const [editing, setEditing] = useState<RecipientRow | "new" | null>(null);
  return (
    <Section
      title="Saved recipients"
      action={
        <Button variant="ghost" size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden />
          Add
        </Button>
      }
    >
      <div id="recipients" className="scroll-mt-20" />
      {recipients.length ? (
        <Card>
          <List>
            {recipients.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setEditing(r)}
                className="flex cursor-pointer items-center gap-3 border-t border-line px-4 py-3 text-left first:border-t-0 hover:bg-bg"
              >
                <Avatar name={r.name} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sub font-medium">
                    {r.name}
                  </span>
                  <span className="truncate text-small text-fg-3">
                    {r.where}
                  </span>
                </div>
                <ChevronRight className="size-4 text-fg-3" aria-hidden />
                <span className="sr-only">Edit {r.name}</span>
              </button>
            ))}
          </List>
        </Card>
      ) : (
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-sub font-medium">No saved recipients yet</span>
          <span className="text-small text-fg-3">
            Save the people you send to often. They show up as one-tap choices
            when you book.
          </span>
        </Card>
      )}
      <RecipientSheet
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        editing={editing}
        options={options}
        onClose={() => setEditing(null)}
      />
    </Section>
  );
}

function RecipientSheet({
  editing,
  options,
  onClose,
}: {
  editing: RecipientRow | "new" | null;
  options: CollectOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const existing = editing && editing !== "new" ? editing : null;
  const [name, setName] = useState(existing?.name ?? "");
  const [phone, setPhone] = useState(existing ? national(existing.phone) : "");
  const [choice, setChoice] = useState(existing?.choice ?? "");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const done = () => {
    onClose();
    router.refresh();
  };

  return (
    <Sheet
      open={editing !== null}
      onOpenChange={(o) => (o ? null : onClose())}
      title={existing ? `Edit ${existing.name}` : "Add a recipient"}
      description="They’ll show up as a one-tap choice when you book."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const body = { name, phone, ...toBody(choice) };
          const r = existing
            ? await call("PATCH", `/api/me/recipients/${existing.id}`, body)
            : await call("POST", "/api/me/recipients", body);
          setBusy(false);
          setResult(r);
          if (r.ok) done();
        }}
      >
        <Field label="Name" error={result?.fields?.name}>
          {(ids) => (
            <Input
              {...ids}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              required
              minLength={2}
              maxLength={80}
            />
          )}
        </Field>
        <Field label="Phone number" error={result?.fields?.phone}>
          {(ids) => (
            <PhoneInput
              {...ids}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="off"
              required
            />
          )}
        </Field>
        <Field
          label="Where they usually collect"
          hint="Optional. Picked for you when you book for them."
          error={
            result?.fields?.preferredParkId ??
            result?.fields?.preferredRoadsidePointId
          }
        >
          {(ids) => (
            <Select
              {...ids}
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              <option value="">No preference</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {result && !result.ok && !result.fields ? (
          <Notice tone="red">{result.message}</Notice>
        ) : null}
        <Button type="submit" size="lg" block disabled={busy}>
          {busy ? "Saving…" : existing ? "Save changes" : "Save recipient"}
        </Button>
        {existing ? (
          <Button
            type="button"
            variant="danger"
            size="lg"
            block
            disabled={busy}
            onClick={async () => {
              if (!confirmRemove) {
                setConfirmRemove(true);
                return;
              }
              setBusy(true);
              const r = await call(
                "DELETE",
                `/api/me/recipients/${existing.id}`,
              );
              setBusy(false);
              setResult(r);
              if (r.ok) done();
            }}
          >
            {confirmRemove ? `Yes, remove ${existing.name}` : "Remove"}
          </Button>
        ) : null}
      </form>
    </Sheet>
  );
}

// ─── Preferences ────────────────────────────────────────────────────────────

export function Preferences({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [channel, setChannel] = useState(
    profile.notifyChannel === "SMS" ? "SMS" : "WHATSAPP",
  );
  const [language, setLanguage] = useState(profile.language);
  const [status, setStatus] = useState<string | null>(null);

  const save = async (patch: Record<string, string>) => {
    setStatus("Saving…");
    const r = await call("PATCH", "/api/me", patch);
    setStatus(r.ok ? "Saved" : (r.message ?? "Couldn’t save"));
    if (r.ok) router.refresh();
  };

  return (
    <Section
      title="Preferences"
      action={
        status ? (
          <span className="text-caption text-fg-3" role="status">
            {status}
          </span>
        ) : null
      }
    >
      <Card>
        <List>
          <label className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex-1 text-sub font-medium">Notifications</span>
            <Select
              className="w-36"
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value as typeof channel);
                void save({ notifyChannel: e.target.value });
              }}
            >
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SMS">SMS</option>
            </Select>
          </label>
          <label className="flex items-center gap-3 border-t border-line px-4 py-2.5">
            <span className="flex-1 text-sub font-medium">Language</span>
            <Select
              className="w-36"
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value as typeof language);
                void save({ language: e.target.value });
              }}
            >
              <option value="EN">English</option>
              <option value="PCM">Pidgin</option>
            </Select>
          </label>
        </List>
      </Card>
    </Section>
  );
}

// ─── Sign out ───────────────────────────────────────────────────────────────

/** Signs out on every subdomain, then goes back to the park home. */
export function SignOutBlock() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      block
      className="text-red-fg"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
        router.push("/");
        router.refresh();
      }}
    >
      <LogOut className="size-4" aria-hidden />
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}
