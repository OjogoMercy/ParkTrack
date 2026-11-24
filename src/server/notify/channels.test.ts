import { afterEach, describe, expect, it, vi } from "vitest";
import { deliver, type ChannelAdapter, type LiveChannel } from "./channels";

const ok: ChannelAdapter = { send: async () => {} };
const fails = (msg: string): ChannelAdapter => ({
  send: async () => {
    throw new Error(msg);
  },
});
const adapters = (w: ChannelAdapter, s: ChannelAdapter) =>
  ({ WHATSAPP: w, SMS: s }) as Record<LiveChannel, ChannelAdapter>;

describe("deliver", () => {
  afterEach(() => vi.restoreAllMocks());

  it("console mode prints the message and logs CONSOLE", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const attempts = await deliver(
      "+2340000000201",
      "Code 482913 for PT-7K3Q",
      "WHATSAPP",
      { mode: "console", production: false },
    );
    expect(attempts).toEqual([{ channel: "CONSOLE", ok: true }]);
    expect(log.mock.calls[0][0]).toContain("482913");
  });

  it("blanks codes out of printed text in production", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await deliver("+2340000000201", "Code 482913 for PT-7K3Q", "SMS", {
      mode: "console",
      production: true,
    });
    expect(log.mock.calls[0][0]).not.toContain("482913");
    expect(log.mock.calls[0][0]).toContain("PT-7K3Q");
  });

  it("live: preferred channel first", async () => {
    expect(
      await deliver("p", "t", "WHATSAPP", {
        mode: "live",
        production: true,
        adapters: adapters(ok, ok),
      }),
    ).toEqual([{ channel: "WHATSAPP", ok: true }]);
    expect(
      await deliver("p", "t", "SMS", {
        mode: "live",
        production: true,
        adapters: adapters(ok, ok),
      }),
    ).toEqual([{ channel: "SMS", ok: true }]);
  });

  it("live: falls back to the other channel and reports both attempts", async () => {
    expect(
      await deliver("p", "t", "WHATSAPP", {
        mode: "live",
        production: true,
        adapters: adapters(fails("template not approved"), ok),
      }),
    ).toEqual([
      { channel: "WHATSAPP", ok: false, error: "template not approved" },
      { channel: "SMS", ok: true },
    ]);
  });

  it("live: both failing is reported, not thrown", async () => {
    const attempts = await deliver("p", "t", "SMS", {
      mode: "live",
      production: true,
      adapters: adapters(fails("w down"), fails("s down")),
    });
    expect(attempts.map((a) => [a.channel, a.ok])).toEqual([
      ["SMS", false],
      ["WHATSAPP", false],
    ]);
  });
});
