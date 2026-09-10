import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = new URL(request.url).origin;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`;

  if (!clientId) {
    // If no client ID configured yet, redirect to calendar with instructions modal
    return NextResponse.redirect(`${origin}/calendar?gcal_setup=required`);
  }

  const scope = encodeURIComponent("https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email");
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&access_type=offline&prompt=consent`;

  return NextResponse.redirect(authUrl);
}
