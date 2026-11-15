export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.21-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47a9.4 9.4 0 0 1 6.7 2.78 9.41 9.41 0 0 1 2.77 6.7c0 5.22-4.25 9.47-9.47 9.47zm8.06-17.53A11.33 11.33 0 0 0 12.04.63C5.76.63.65 5.74.65 12.02c0 2 .52 3.96 1.52 5.69L.55 23.6l6.04-1.58a11.37 11.37 0 0 0 5.44 1.39h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.18-5.9-3.33-8.05z" />
    </svg>
  );
}

/** Phone with an M-PESA screen and a red arrow, used for Mobile Money. */
export function MpesaPhone({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 64" aria-hidden="true" className={className}>
      <rect x="4" y="1" width="36" height="62" rx="7" className="fill-icon-blue" />
      <rect x="8" y="8" width="28" height="44" rx="2" className="fill-card" />
      <rect x="17" y="3.5" width="10" height="2" rx="1" className="fill-card" />
      <circle cx="22" cy="57.5" r="2.6" className="fill-card" />
      <rect x="15" y="12" width="14" height="10" rx="2" className="fill-icon-mpesa" opacity="0.35" />
      <path d="M9 34 C 15 27, 28 26, 35 31 M35 31 L 33.5 26.5 M35 31 L 30.5 32" className="fill-none stroke-destructive" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <text x="22" y="46" textAnchor="middle" fontSize="6" fontWeight="800" letterSpacing="-0.2" className="fill-icon-mpesa">M-PESA</text>
    </svg>
  );
}

/** Green phone with a red arrow, the M-Pesa mark used on the shop pages. */
export function MobileMoneyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 40" aria-hidden="true" className={className}>
      <rect x="6" y="2" width="20" height="36" rx="4" className="fill-none stroke-icon-mpesa" strokeWidth="3" />
      <rect x="13" y="32" width="6" height="2" rx="1" className="fill-icon-mpesa" />
      <path d="M2 21 C 8 14, 20 12, 29 17 M29 17 L 27.5 12.5 M29 17 L 24.5 18.5" className="fill-none stroke-destructive" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
