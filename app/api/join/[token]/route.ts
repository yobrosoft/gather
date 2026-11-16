import { NextResponse } from "next/server";
import { isJoinToken } from "@/lib/ids";
import { fail, requireUser } from "@/lib/http";
import { eventByToken, ServiceError } from "@/lib/service";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { token } = await context.params;
    if (!isJoinToken(token)) throw new ServiceError("That link does not match a viewing.", 404);
    const store = await getStore();
    const user = await requireUser(request);
    return NextResponse.json({ event: await eventByToken(store, user, token) });
  } catch (error) {
    return fail(error);
  }
}
