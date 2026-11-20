"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { compressImage, formatBytes } from "@/lib/image";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Takes a photo with the phone camera (or picks one), compresses it to
 * ≤ 200 KB in the browser and hands back a JPEG Blob. Uploading is done by
 * the caller through Scope 03's uploads service.
 *
 * Used for the drop-off photo (code written on the parcel must be visible),
 * damage photos at tick-off, and release photos at collection.
 */
export function PhotoCapture({
  label,
  hint,
  onChange,
  maxBytes = 200_000,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  /** Called with the compressed photo, or null when it is cleared. */
  onChange: (photo: Blob | null) => void;
  maxBytes?: number;
  className?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await compressImage(file, { maxBytes });
      setPreview(URL.createObjectURL(photo));
      setSize(photo.size);
      onChange(photo);
    } catch {
      setError("That photo couldn't be used. Try taking it again.");
      onChange(null);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-small font-medium text-fg-2">{label}</span>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {preview ? (
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          <img
            src={preview}
            alt={label}
            className="aspect-[4/3] w-full rounded-control bg-[#e9e9ec] object-cover"
          />
          <div className="flex items-center justify-between">
            <span className="text-caption font-normal text-fg-3 num">
              {size != null ? `Compressed to ${formatBytes(size)}` : null}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <RotateCcw /> Retake
            </Button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={cn(
            "grid aspect-[4/3] w-full cursor-pointer place-items-center rounded-control bg-[#e9e9ec] text-[#8a8a93]",
            busy && "cursor-progress",
          )}
        >
          <span className="flex flex-col items-center gap-2 text-small font-medium">
            <Camera className="size-6" />
            {busy ? "Preparing photo…" : "Take photo"}
          </span>
        </label>
      )}
      {error ? (
        <p role="alert" className="text-caption font-normal text-red-fg">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p className="text-caption font-normal text-fg-3">{hint}</p>
      ) : null}
    </div>
  );
}
