import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const riderSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30),
});

// Persists the signed-in rider's profile; riders.id is the auth user id.
export const saveRider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(riderSchema)
  .handler(async ({ data, context }) => {
    const { data: rider, error } = await context.supabase
      .from("riders")
      .upsert(
        { id: context.userId, full_name: data.full_name, phone: data.phone },
        { onConflict: "id" },
      )
      .select()
      .single();
    if (error) throw new Error("Your rider details could not be saved. Please try again.");
    return rider;
  });
