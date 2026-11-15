import { createFileRoute } from "@tanstack/react-router";

// Woken by the database when new customer messages are queued. The caller must
// present the private token kept in the database vault; the route only sends
// messages that are already queued and never accepts message content.
export const Route = createFileRoute("/api/public/order-followups")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-beez-followups-token") ?? "";
        if (token.length < 32 || token.length > 200) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: valid, error } = await supabaseAdmin.rpc("verify_followups_token", { _token: token });
        if (error || valid !== true) return new Response("Unauthorized", { status: 401 });
        const { dispatchCustomerNotifications } = await import("@/lib/followups.server");
        const result = await dispatchCustomerNotifications(25);
        return Response.json(result);
      },
    },
  },
});
