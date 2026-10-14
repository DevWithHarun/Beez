# Shared UI patterns

Reusable primitives for accessible buttons, large touch tiles, bottom tab bar,
drawers/sheets, toasts, skeletons, error states and confirmation. Product
screens compose these; shared UI contains no role/commerce policy.

Design for phone-size first, low bandwidth, keyboard and assistive technology:
visible focus, labelled controls, status announcements, large tap targets,
clear loading/empty/offline/retry states and no color-only meaning. Code and
money confirmations must be explicit. Use sheets for shared withdrawal flows
and reusable voice/listen affordances. Current shared component primitives
mostly serve the existing marketing page; target app-specific compositions
remain to be built.
