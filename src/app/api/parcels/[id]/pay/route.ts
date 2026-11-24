import { StartPayment } from "@/contracts/api";
import type { ApiError } from "@/contracts/primitives";
import {
  AuthError,
  getSession,
  invalidInputResponse,
  verifyRecipientLink,
} from "@/server/auth";
import { PaymentError, startPayment, type Payer } from "@/server/payments";

/**
 * POST /api/parcels/:id/pay — starts an Interswitch Web Checkout for a
 * parcel (PAY-1). Body: { purpose, trackingLink? }. The amount is worked
 * out on the server from the parcel; the browser only says what it's paying
 * for. The payer is the signed-in person, or the recipient's tracking link
 * for pay-on-delivery and storage.
 *
 * Returns { paymentId, txnRef, amountKobo, checkout: { url, fields } }:
 * POST the fields to the URL. Errors: 400 invalid_input, 401 signed_out,
 * 403 payer_not_allowed, 404 parcel_not_found, 409 payment_not_allowed,
 * 503 payments_unavailable.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const parsed = StartPayment.body.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidInputResponse(parsed.error);
  const { id } = await params;

  try {
    let payer: Payer;
    if (parsed.data.trackingLink) {
      const link = await verifyRecipientLink(parsed.data.trackingLink);
      if (!link) {
        throw new AuthError(
          "link_invalid",
          "This link has expired. Ask the sender for a new one.",
          401,
        );
      }
      payer = { kind: "recipient_link", parcelId: link.parcelId };
    } else {
      const user = await getSession();
      if (!user) throw new AuthError("signed_out", "Sign in to pay.", 401);
      payer = { kind: "user", userId: user.id };
    }
    const started = await startPayment(id, parsed.data.purpose, payer);
    return Response.json(StartPayment.response.parse(started), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AuthError || error instanceof PaymentError) {
      return error.toResponse();
    }
    console.error("[pay] start failed", error);
    const body: ApiError = {
      error: {
        code: "server_error",
        message: "Something went wrong on our side. Try again in a moment.",
      },
    };
    return Response.json(body, { status: 500 });
  }
}
