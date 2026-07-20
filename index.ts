// Supabase Edge Function: send-reapplication-alerts
// Checks the Applications log for anything due to be reapplied within 2 days,
// and sends a push notification to every subscribed device.
//
// Deploy: supabase functions deploy send-reapplication-alerts --no-verify-jwt
// Then schedule it to run periodically (see setup notes) — e.g. once an hour.

import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails(
  "mailto:turf@springlakesgolfclub.example",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

function computeNextDue(app: any): string | null {
  if (!app.reapplicationIntervalDays || !app.date) return null;
  const d = new Date(app.date + "T00:00:00");
  d.setDate(d.getDate() + Number(app.reapplicationIntervalDays));
  return d.toISOString().slice(0, 10);
}

function productsFor(app: any): string[] {
  const names: string[] = [];
  (app.tanks || []).forEach((t: any) => {
    (t.products || []).forEach((p: any) => {
      if (p.product && names.indexOf(p.product) === -1) names.push(p.product);
    });
  });
  return names;
}

Deno.serve(async (_req: Request) => {
  try {
    const headers = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    };

    const appsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/app_data?key=eq.applications&select=value`,
      { headers }
    );
    const appsRows = await appsRes.json();
    const applications: any[] = appsRows.length ? appsRows[0].value : [];

    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date();
    soon.setDate(soon.getDate() + 2);
    const soonStr = soon.toISOString().slice(0, 10);

    const dueSoon = applications.filter((a) => {
      const nextDue = computeNextDue(a);
      return nextDue && nextDue >= today && nextDue <= soonStr;
    });

    if (dueSoon.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "Nothing due soon" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?select=subscription,endpoint`,
      { headers }
    );
    const subsRows = await subsRes.json();

    let sent = 0;
    const deadEndpoints: string[] = [];

    for (const row of subsRows) {
      for (const app of dueSoon) {
        const payload = JSON.stringify({
          title: "Reapplication due soon",
          body: `${productsFor(app).join(", ") || "Application"} — due ${computeNextDue(app)}`,
          tag: "reapply-" + app.id,
        });
        try {
          await webpush.sendNotification(row.subscription, payload);
          sent++;
        } catch (err: any) {
          console.error("push failed for", row.endpoint, err?.message || err);
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            deadEndpoints.push(row.endpoint);
          }
        }
      }
    }

    // Clean up subscriptions that are no longer valid (user uninstalled, revoked, etc.)
    for (const endpoint of deadEndpoints) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
        { method: "DELETE", headers }
      );
    }

    return new Response(JSON.stringify({ sent, dueSoonCount: dueSoon.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
