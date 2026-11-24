"use client";

import "./globals.css";

/**
 * Last-resort screen when even the root layout fails. It replaces the whole
 * document, so it brings its own <html>/<body> and styles, and stays plain.
 */
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en-NG">
      <body className="flex min-h-dvh items-center justify-center bg-bg p-6 font-sans text-fg">
        <title>ParkTrack</title>
        <main className="flex max-w-sm flex-col gap-3">
          <p className="text-caption text-fg-3">ParkTrack</p>
          <h1 className="text-title">Something went wrong</h1>
          <p className="text-sub text-fg-2">
            It&apos;s not you. Check your data connection and try again.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-2 h-12 rounded-control bg-fg px-4 text-[15px] font-medium text-white"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
