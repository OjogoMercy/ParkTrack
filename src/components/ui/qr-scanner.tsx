"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input } from "./field";

/**
 * Camera QR scanner (html5-qrcode), used by agents to scan booking QRs and
 * manifest QRs. The library is loaded only when a scanner mounts. A
 * "type the code instead" fallback is always available, and becomes the main
 * path when the camera is unavailable (no permission, no camera, or the page
 * is not on HTTPS).
 *
 * The scanner returns the raw text it read. Interpreting it (booking id,
 * manifest token, URL) is the caller's job.
 */

type Status =
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "unavailable"; reason: string };

type ScannerInstance = {
  start: (
    camera: MediaTrackConstraints,
    config: { fps: number; aspectRatio?: number },
    onSuccess: (text: string) => void,
    onError: (message: string) => void,
  ) => Promise<unknown>;
  stop: () => Promise<void>;
  clear: () => void;
  isScanning: boolean;
};

function describeCameraError(err: unknown): string {
  const text =
    err instanceof Error ? `${err.name} ${err.message}` : String(err);
  if (/NotAllowed|Permission/i.test(text))
    return "Camera permission was refused. Allow the camera in your browser settings, or type the code.";
  if (/NotFound|Requested device not found|OverconstrainedError/i.test(text))
    return "No camera was found on this device. Type the code instead.";
  if (/NotReadable|in use/i.test(text))
    return "The camera is being used by another app. Close it, or type the code.";
  return "The camera couldn't start. Type the code instead.";
}

export function QRScanner({
  onResult,
  paused = false,
  hint = "Point at the QR. Details load the moment it's read.",
  manualLabel = "Type the parcel code instead",
  manualPlaceholder = "PT-7K3Q",
  className,
}: {
  /** Called once per read; the scanner pauses itself until `paused` toggles. */
  onResult: (text: string, source: "camera" | "manual") => void;
  /** Set true while you load details; false to scan again. */
  paused?: boolean;
  hint?: React.ReactNode;
  manualLabel?: string;
  manualPlaceholder?: string;
  className?: string;
}) {
  const regionId = `qr-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const scannerRef = useRef<ScannerInstance | null>(null);
  const handledRef = useRef(false);
  const onResultRef = useRef(onResult);
  const [status, setStatus] = useState<Status>({ kind: "starting" });
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState("");

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (paused) return;
    handledRef.current = false;
    let cancelled = false;

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus({
          kind: "unavailable",
          reason: "The camera only works over HTTPS. Type the code instead.",
        });
        setManualOpen(true);
        return;
      }
      setStatus({ kind: "starting" });
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } =
          await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(regionId, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        }) as unknown as ScannerInstance;
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, aspectRatio: 1 },
          (text) => {
            if (handledRef.current) return;
            handledRef.current = true;
            navigator.vibrate?.(60);
            onResultRef.current(text.trim(), "camera");
          },
          () => {
            // Called for every frame without a QR; nothing to do.
          },
        );
        if (cancelled) {
          await scanner.stop().catch(() => {});
          return;
        }
        setStatus({ kind: "scanning" });
      } catch (err) {
        if (cancelled) return;
        setStatus({ kind: "unavailable", reason: describeCameraError(err) });
        setManualOpen(true);
      }
    }

    void start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner?.isScanning) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      }
    };
  }, [paused, regionId]);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const value = manualValue.trim().toUpperCase();
    if (value) onResult(value, "manual");
  };

  const cameraVisible = status.kind !== "unavailable";

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {cameraVisible ? (
        <div className="relative aspect-square w-full overflow-hidden rounded-card bg-[#0b0b0d]">
          <div
            id={regionId}
            className="absolute inset-0 [&_canvas]:hidden [&_video]:!h-full [&_video]:!w-full [&_video]:object-cover"
          />
          {/* Volt frame: the scanner is one of the few places Volt is used. */}
          <div aria-hidden className="pointer-events-none absolute inset-[15%]">
            {[
              "top-0 left-0 border-t-4 border-l-4 rounded-tl-card",
              "top-0 right-0 border-t-4 border-r-4 rounded-tr-card",
              "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-card",
              "bottom-0 right-0 border-r-4 border-b-4 rounded-br-card",
            ].map((corner) => (
              <span
                key={corner}
                className={cn("absolute size-10 border-volt", corner)}
              />
            ))}
          </div>
          {paused || status.kind !== "scanning" ? (
            <div className="absolute inset-x-0 bottom-4 text-center text-small text-white/80">
              {paused ? "Paused" : "Starting camera…"}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          role="alert"
          className="rounded-control bg-amber-bg p-3 text-small text-amber-fg"
        >
          {status.reason}
        </div>
      )}

      {cameraVisible ? (
        <p className="text-center text-small text-fg-3">{hint}</p>
      ) : null}

      {manualOpen ? (
        <form onSubmit={submitManual} className="flex gap-2">
          <Input
            aria-label={manualLabel}
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder={manualPlaceholder}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="font-mono uppercase"
          />
          <Button type="submit" disabled={!manualValue.trim()}>
            Open
          </Button>
        </form>
      ) : (
        <Button variant="ghost" onClick={() => setManualOpen(true)}>
          {manualLabel}
        </Button>
      )}
    </div>
  );
}
