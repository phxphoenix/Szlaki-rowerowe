import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST(request?: NextRequest) {
  const response = NextResponse.json({ authenticated: false }, { status: 200 });
  return clearSessionCookie(response, request);
}
