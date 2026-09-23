import { NextResponse } from "next/server";
import { readJsonStorage, writeJsonStorage } from "@/lib/storage";
import { findOrCreateGoogleUser } from "@/lib/users";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const origin = new URL(request.url).origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/calendar?gcal_error=no_code`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/calendar?gcal_error=missing_credentials`);
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.redirect(`${origin}/calendar?gcal_error=token_failed`);
    }

    const accessToken = tokenData.access_token;

    // 2. Fetch User Profile Email & Name
    let userEmail = "Google User";
    let userName = "Google User";
    try {
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (userRes.ok) {
        const userInfo = await userRes.json();
        if (userInfo.email) userEmail = userInfo.email;
        if (userInfo.name) userName = userInfo.name;
      }
    } catch {}

    // 3. Fetch Google Calendar Events from Primary Calendar
    const calRes = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=100&orderBy=startTime&singleEvents=true",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!calRes.ok) {
      return NextResponse.redirect(`${origin}/calendar?gcal_error=calendar_fetch_failed`);
    }

    const calData = await calRes.json();
    const items: any[] = calData.items || [];

    const existingEvents = await readJsonStorage<any[]>("calendar", "events.json", []);

    const nonGcalEvents = existingEvents.filter(e => e.category !== "Google Calendar");

    const newGcalEvents = items.map((item) => {
      const dateStr = item.start?.date || item.start?.dateTime?.split("T")[0] || new Date().toISOString().split("T")[0];
      return {
        id: `gcal-oauth-${item.id || crypto.randomUUID()}`,
        title: item.summary || "Google Calendar Event",
        date: dateStr,
        category: "Google Calendar",
        description: item.description || `Synced via Google Account (${userEmail})`,
        createdAt: new Date().toISOString()
      };
    });

    const updated = [...newGcalEvents, ...nonGcalEvents];
    await writeJsonStorage("calendar", "events.json", updated);

    // Save settings
    const settings = {
      connectedAccount: userEmail,
      lastSyncedAt: new Date().toISOString()
    };
    await writeJsonStorage("calendar", "settings.json", settings);

    // 4. Create LifeOS user session
    const sessionUser = await findOrCreateGoogleUser(userName, userEmail);
    const sessionToken = await createSessionToken(sessionUser);

    const response = NextResponse.redirect(`${origin}/calendar?gcal_success=true&account=${encodeURIComponent(userEmail)}`);
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response;
  } catch (err) {
    return NextResponse.redirect(`${origin}/calendar?gcal_error=unknown`);
  }
}

