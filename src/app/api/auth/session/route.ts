import { NextRequest, NextResponse } from "next/server";
import { isAuthConfigured, isAuthenticatedRequest } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const authenticated = await isAuthenticatedRequest(request);
  const authConfigured = isAuthConfigured();

  return NextResponse.json(
    {
      authenticated,
      authConfigured,
    },
    { status: 200 },
  );
}
