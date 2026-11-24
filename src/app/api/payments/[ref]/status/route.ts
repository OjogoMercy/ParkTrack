import { PaymentStatusRoute } from "@/contracts/api";
import type { ApiError } from "@/contracts/primitives";
import { paymentStatus, PaymentError, requery } from "@/server/payments";

/**
 * GET /api/payments/:ref/status — polled by "Confirming your payment" (S05).
 * While a payment isn't settled it asks Interswitch again, so a payer who is
 * watching sees the result as soon as Interswitch has it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ref: string }> },
): Promise<Response> {
  const { ref } = await params;
  try {
    const current = await paymentStatus(ref);
    if (!current) {
      throw new PaymentError("payment_not_found", "Payment not found.", 404);
    }
    const view = current.status === "VERIFIED" ? current : await requery(ref);
    return Response.json(PaymentStatusRoute.response.parse(view), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PaymentError) return error.toResponse();
    console.error("[payments] status", error);
    const body: ApiError = {
      error: {
        code: "server_error",
        message: "Couldn't check the payment. Try again in a moment.",
      },
    };
    return Response.json(body, { status: 500 });
  }
}
