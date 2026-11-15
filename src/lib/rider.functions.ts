import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { VEHICLE_TYPES, normalizePlate } from "@/lib/rider-jobs";

const riderSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30),
  vehicle_type: z.enum(VEHICLE_TYPES).nullable().optional(),
  plate: z.string().trim().max(20).nullable().optional(),
});

// Persists the signed-in rider's profile; riders.id is the auth user id.
export const saveRider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(riderSchema)
  .handler(async ({ data, context }) => {
    const row: {
      id: string;
      full_name: string;
      phone: string;
      vehicle_type?: string | null;
      plate?: string | null;
    } = {
      id: context.userId,
      full_name: data.full_name,
      phone: data.phone,
    };
    if (data.vehicle_type !== undefined) row.vehicle_type = data.vehicle_type;
    if (data.plate !== undefined) {
      const plate = data.plate ? normalizePlate(data.plate) : null;
      if (plate === undefined) throw new Error("Enter a number plate like KMFA 123B.");
      // Bicycles and walkers have no plate.
      row.plate = data.vehicle_type === "Bicycle" || data.vehicle_type === "On foot" ? null : plate;
    }
    const { data: rider, error } = await context.supabase
      .from("riders")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error("Your rider details could not be saved. Please try again.");
    return rider;
  });
