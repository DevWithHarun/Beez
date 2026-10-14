import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  BusinessHours,
  MerchantAvailabilityInput,
  MerchantShop,
  saveMerchantAvailability,
} from "./api";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function initialHours(shop: MerchantShop): Record<string, BusinessHours> {
  return DAYS.reduce<Record<string, BusinessHours>>((result, day) => {
    result[day] = shop.openingHours[day] ?? { open: false, opensAt: null, closesAt: null };
    return result;
  }, {});
}

export default function MerchantAvailability({ shop }: { shop: MerchantShop }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(shop.isOpen);
  const [hours, setHours] = useState(() => initialHours(shop));
  const mutation = useMutation({
    mutationFn: (input: MerchantAvailabilityInput) => saveMerchantAvailability(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["merchant", "shop"] });
      await queryClient.invalidateQueries({ queryKey: ["merchant", "dashboard"] });
    },
  });

  function updateDay(day: (typeof DAYS)[number], update: Partial<BusinessHours>) {
    setHours((current) => ({
      ...current,
      [day]: {
        ...(current[day] ?? { open: false, opensAt: null, closesAt: null }),
        ...update,
      },
    }));
  }

  return (
    <section className="merchant-availability" aria-labelledby="merchant-availability-title">
      <h3 id="merchant-availability-title">Availability and opening hours</h3>
      <label className="merchant-availability-toggle">
        <input
          type="checkbox"
          checked={isOpen}
          onChange={(event) => setIsOpen(event.target.checked)}
        />
        Accepting orders now
      </label>
      <div className="merchant-hours-list">
        {DAYS.map((day) => {
          const value = hours[day] ?? { open: false, opensAt: null, closesAt: null };
          return (
            <div className="merchant-hours-row" key={day}>
              <label>
                <input
                  type="checkbox"
                  checked={value.open}
                  onChange={(event) =>
                    updateDay(day, {
                      open: event.target.checked,
                      opensAt: event.target.checked ? (value.opensAt ?? "09:00") : null,
                      closesAt: event.target.checked ? (value.closesAt ?? "17:00") : null,
                    })
                  }
                />
                <span>{day.charAt(0).toUpperCase() + day.slice(1)}</span>
              </label>
              {value.open ? (
                <>
                  <input
                    type="time"
                    aria-label={`${day} opens at`}
                    required
                    value={value.opensAt ?? "09:00"}
                    onChange={(event) => updateDay(day, { opensAt: event.target.value })}
                  />
                  <span>to</span>
                  <input
                    type="time"
                    aria-label={`${day} closes at`}
                    required
                    value={value.closesAt ?? "17:00"}
                    onChange={(event) => updateDay(day, { closesAt: event.target.value })}
                  />
                </>
              ) : (
                <span>Closed</span>
              )}
            </div>
          );
        })}
      </div>
      {mutation.isError && (
        <p className="form-error" role="alert">
          {mutation.error.message}
        </p>
      )}
      <button
        className="checkout-submit"
        type="button"
        disabled={mutation.isPending}
        onClick={() => {
          mutation.mutate({
            isOpen,
            openingHours: DAYS.reduce<Record<string, BusinessHours>>((result, day) => {
              const value = hours[day] ?? { open: false, opensAt: null, closesAt: null };
              result[day] = value.open ? value : { open: false, opensAt: null, closesAt: null };
              return result;
            }, {}),
          });
        }}
      >
        {mutation.isPending ? "Saving availability…" : "Save availability"}
      </button>
    </section>
  );
}
