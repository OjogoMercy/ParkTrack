"use client";

import { Info } from "lucide-react";
import { useMemo, useState } from "react";
import { BookingInput } from "@/contracts/api";
import type { BySize, Quote } from "@/contracts/dto";
import {
  ITEM_CATEGORIES,
  SIZE_LABELS,
  type DeliveryMode,
  type ItemCategory,
  type SizeClass,
} from "@/contracts/enums";
import { Button } from "@/components/ui/button";
import {
  Checkbox,
  ChipGroup,
  ChoiceCards,
  SegmentedControl,
  Switch,
} from "@/components/ui/choice";
import {
  Field,
  Input,
  MoneyInput,
  PhoneInput,
  Select,
} from "@/components/ui/field";
import { BottomBar, MobileShell } from "@/components/ui/shells";
import { Card, Notice } from "@/components/ui/surface";
import { formatNaira } from "@/lib/money";
import { normalizeNgPhone } from "@/lib/phone";

export type BookingRoute = {
  id: string;
  destinationParkId: string;
  /** "Ibadan · Iwo Road Park" */
  label: string;
  /** "Iwo Road Park" */
  destinationName: string;
  fareKobo: BySize;
  points: { id: string; name: string }[];
  storage: { windowHours: number; dailyRateKobo: BySize };
};

export type BookingRecipient = {
  id: string;
  name: string;
  /** National digits for the +234 field, e.g. "802 118 9034". */
  phone: string;
  preferredParkId: string | null;
  preferredPointId: string | null;
};

const SIZES: SizeClass[] = ["S", "M", "L"];
const NEW = "new";

/** "45,000" → 4_500_000 kobo; null when it isn't a whole naira amount. */
function nairaToKobo(text: string): number | null {
  const clean = text.replace(/[,\s₦]/g, "");
  if (!/^\d{1,9}$/.test(clean)) return null;
  return Number(clean) * 100;
}

/**
 * S03 one-page booking: where to (destination, collect at park or roadside
 * drop point), recipient (saved chips or a new person), parcel (category,
 * description, size cards with prices, declared value), pay on delivery,
 * and the live total in the bottom bar. Totals come from the server's
 * quotes, so they change instantly and match what booking charges.
 * Checked with the contract's BookingInput before it is sent.
 */
export function BookingForm({
  topBar,
  intro,
  routes,
  estimates,
  recipients,
  podLimitKobo,
  initialRouteId,
  initialSize,
}: {
  routes: BookingRoute[];
  estimates: Record<string, Record<SizeClass, Quote>>;
  recipients: BookingRecipient[];
  podLimitKobo: number;
  initialRouteId: string;
  initialSize: SizeClass;
  topBar: React.ReactNode;
  /** "Sending as …" card, rendered on the server. */
  intro: React.ReactNode;
}) {
  const [routeId, setRouteId] = useState(initialRouteId);
  const [mode, setMode] = useState<DeliveryMode>("PARK");
  const [pointId, setPointId] = useState("");
  const [who, setWho] = useState<string>(NEW);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [save, setSave] = useState(true);
  const [category, setCategory] = useState<ItemCategory | "">("");
  const [description, setDescription] = useState("");
  const [size, setSize] = useState<SizeClass>(initialSize);
  const [declared, setDeclared] = useState("");
  const [pod, setPod] = useState(false);
  const [podAmount, setPodAmount] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  const route = routes.find((r) => r.id === routeId) ?? routes[0];
  const quote = estimates[route.id]?.[size];
  const hasPoints = route.points.length > 0;

  const pickRecipient = (id: string) => {
    setWho(id);
    setErrors({});
    setReady(false);
    const r = recipients.find((x) => x.id === id);
    if (!r) {
      setName("");
      setPhone("");
      return;
    }
    setName(r.name);
    setPhone(r.phone);
    // Their usual place, when this park goes there.
    const viaPoint = r.preferredPointId
      ? routes.find((x) => x.points.some((p) => p.id === r.preferredPointId))
      : undefined;
    if (viaPoint) {
      setRouteId(viaPoint.id);
      setMode("ROADSIDE");
      setPointId(r.preferredPointId!);
      return;
    }
    const toPark = routes.find(
      (x) => x.destinationParkId === r.preferredParkId,
    );
    if (toPark) {
      setRouteId(toPark.id);
      setMode("PARK");
      setPointId("");
    }
  };

  const collectNote = useMemo(() => {
    const rate = route.storage.dailyRateKobo[size];
    return `Collected at ${route.destinationName}. ${route.storage.windowHours} hours free from when they’re told it arrived, then ${formatNaira(rate)} a day.`;
  }, [route, size]);

  const review = () => {
    const found: Record<string, string> = {};
    const declaredKobo = nairaToKobo(declared);
    if (declaredKobo === null || declaredKobo <= 0) {
      found.declaredValueKobo = "Enter what it’s worth in naira, e.g. 45,000";
    }
    const podKobo = pod ? nairaToKobo(podAmount) : 0;
    if (pod && (podKobo === null || podKobo <= 0)) {
      found.podAmountKobo = "Enter the amount to collect";
    } else if (podKobo && podKobo > podLimitKobo) {
      found.podAmountKobo = `Pay on delivery is up to ${formatNaira(podLimitKobo)} per parcel`;
    }
    if (!normalizeNgPhone(phone)) {
      found["recipient.phone"] = "Enter their Nigerian phone number";
    }
    if (!category) found.category = "Choose what’s inside";

    const input = {
      destinationParkId: route.destinationParkId,
      deliveryMode: mode,
      roadsidePointId: mode === "ROADSIDE" ? pointId || undefined : undefined,
      recipient: { name, phone },
      saveRecipient: who === NEW && save,
      category: category || undefined,
      description,
      declaredValueKobo: declaredKobo ?? -1,
      sizeClass: size,
      podAmountKobo: podKobo ?? 0,
    };
    const parsed = BookingInput.safeParse(input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        found[key] ??= friendly(key, issue.message);
      }
    }
    setErrors(found);
    const ok = Object.keys(found).length === 0;
    setReady(ok);
    if (!ok) {
      // Take them to the first problem.
      const first = Object.keys(found)[0];
      document
        .querySelector<HTMLElement>(`[data-field="${first}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const err = (key: string) => errors[key];

  return (
    <MobileShell
      topBar={topBar}
      className="gap-6 p-4"
      bottomBar={
        <BottomBar className="flex-row items-center justify-between">
          <div className="flex flex-col" aria-live="polite">
            <span className="text-[18px] leading-6 font-semibold tracking-[-0.02em] num">
              {quote ? formatNaira(quote.totalKobo) : "—"}
            </span>
            {quote ? (
              <span className="text-caption text-fg-3">
                Fare {formatNaira(quote.fareKobo)} +{" "}
                {formatNaira(quote.platformFeeKobo)} fee
              </span>
            ) : null}
          </div>
          <Button className="px-6" onClick={review}>
            Review
          </Button>
        </BottomBar>
      }
    >
      {intro}
      <div className="flex flex-col gap-6">
        <section aria-label="Where to" className="flex flex-col gap-2">
          <h2 className="px-1 text-heading">Where to</h2>
          <Card className="flex flex-col gap-3.5 p-4">
            <Field label="Destination park" error={err("destinationParkId")}>
              {(ids) => (
                <Select
                  {...ids}
                  value={route.id}
                  onChange={(e) => {
                    setRouteId(e.target.value);
                    setPointId("");
                    setReady(false);
                  }}
                >
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-small font-medium text-fg-2">Delivery</span>
              <SegmentedControl
                aria-label="Delivery"
                options={[
                  { value: "PARK" as const, label: "Collect at park" },
                  {
                    value: "ROADSIDE" as const,
                    label: "Roadside drop",
                    disabled: !hasPoints,
                  },
                ]}
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setReady(false);
                }}
              />
            </div>
            {mode === "ROADSIDE" ? (
              <div data-field="roadsidePointId">
                <Field
                  label="Drop point on the route"
                  hint="Your recipient meets the bus here. We alert them about 20 minutes before it arrives."
                  error={err("roadsidePointId")}
                >
                  {(ids) => (
                    <Select
                      {...ids}
                      value={pointId}
                      onChange={(e) => setPointId(e.target.value)}
                    >
                      <option value="" disabled>
                        Choose a drop point
                      </option>
                      {route.points.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            ) : (
              <Notice icon={<Info />}>{collectNote}</Notice>
            )}
          </Card>
        </section>

        <section aria-label="Recipient" className="flex flex-col gap-2">
          <h2 className="px-1 text-heading">Recipient</h2>
          <Card className="flex flex-col gap-3.5 p-4">
            <ChipGroup
              aria-label="Choose a recipient"
              options={[
                ...recipients.map((r) => ({ value: r.id, label: r.name })),
                { value: NEW, label: "New person" },
              ]}
              value={who}
              onChange={pickRecipient}
            />
            <div data-field="recipient.name">
              <Field label="Full name" error={err("recipient.name")}>
                {(ids) => (
                  <Input
                    {...ids}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Recipient’s name"
                    autoComplete="off"
                  />
                )}
              </Field>
            </div>
            <div data-field="recipient.phone">
              <Field
                label="Phone number"
                hint="They get a tracking link once the park checks your parcel in."
                error={err("recipient.phone")}
              >
                {(ids) => (
                  <PhoneInput
                    {...ids}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="off"
                  />
                )}
              </Field>
            </div>
            {who === NEW ? (
              <Checkbox
                label="Save them for next time"
                checked={save}
                onChange={(e) => setSave(e.target.checked)}
              />
            ) : null}
          </Card>
        </section>

        <section aria-label="Parcel" className="flex flex-col gap-2">
          <h2 className="px-1 text-heading">Parcel</h2>
          <Card className="flex flex-col gap-3.5 p-4">
            <div data-field="category">
              <Field label="What’s inside" error={err("category")}>
                {(ids) => (
                  <Select
                    {...ids}
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as ItemCategory)
                    }
                  >
                    <option value="" disabled>
                      Choose one
                    </option>
                    {ITEM_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <div data-field="description">
              <Field label="Short description" error={err("description")}>
                {(ids) => (
                  <Input
                    {...ids}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. 2 bundles of ankara fabric"
                    maxLength={140}
                  />
                )}
              </Field>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-small font-medium text-fg-2">Size</span>
              <ChoiceCards
                aria-label="Size"
                options={SIZES.map((s) => ({
                  value: s,
                  label: SIZE_LABELS[s].name,
                  description: SIZE_LABELS[s].hint,
                  aside: formatNaira(route.fareKobo[s]),
                }))}
                value={size}
                onChange={(s) => {
                  setSize(s);
                  setReady(false);
                }}
              />
            </div>
            <div data-field="declaredValueKobo">
              <Field
                label="Declared value"
                hint="Used if there’s ever a dispute. Prohibited items can’t be booked."
                error={err("declaredValueKobo")}
              >
                {(ids) => (
                  <MoneyInput
                    {...ids}
                    value={declared}
                    onChange={(e) => setDeclared(e.target.value)}
                    placeholder="45,000"
                  />
                )}
              </Field>
            </div>
          </Card>
        </section>

        <Card
          className="flex flex-col gap-3.5 p-4"
          role="region"
          aria-label="Pay on delivery"
        >
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body font-medium">
                Collect payment on delivery
              </span>
              <span className="text-small text-fg-3">
                Your recipient pays through Interswitch before handover. Up to{" "}
                {formatNaira(podLimitKobo)}.
              </span>
            </div>
            <Switch
              checked={pod}
              onCheckedChange={(v) => {
                setPod(v);
                setReady(false);
              }}
              aria-label="Collect payment on delivery"
            />
          </div>
          {pod ? (
            <div data-field="podAmountKobo">
              <Field label="Amount to collect" error={err("podAmountKobo")}>
                {(ids) => (
                  <MoneyInput
                    {...ids}
                    value={podAmount}
                    onChange={(e) => setPodAmount(e.target.value)}
                    placeholder="25,000"
                  />
                )}
              </Field>
            </div>
          ) : null}
        </Card>

        {ready ? (
          <Notice tone="green">
            Everything looks right. Reviewing and paying arrive in the next
            update (Scope 05 sl4).
          </Notice>
        ) : Object.keys(errors).length ? (
          <Notice tone="red">Check the highlighted fields.</Notice>
        ) : null}
      </div>
    </MobileShell>
  );
}

/** Contract messages are for developers; these are for senders. */
function friendly(key: string, message: string): string {
  switch (key) {
    case "recipient.name":
      return "Enter their full name";
    case "recipient.phone":
      return "Enter their Nigerian phone number";
    case "description":
      return "Say briefly what it is (2 to 140 characters)";
    case "roadsidePointId":
      return "Choose a drop point on the route";
    case "category":
      return "Choose what’s inside";
    default:
      return message;
  }
}
