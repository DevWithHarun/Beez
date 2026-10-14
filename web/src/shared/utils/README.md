# Display utilities

Use locale-aware formatting for integer KES amounts, Kenyan phone numbers,
UTC timestamps and humanized dates. Keep normalization/validation (for example
`+254`) on the server as the authority. Do not use floating point for money or
derive a spendable balance in browser code. Mask phone and capability values
before logging; formatting must not turn a masked value back into a full one.
