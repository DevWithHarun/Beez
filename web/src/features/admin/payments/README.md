# Payment operations

Queue payment attempts by INITIATED/PENDING/FAILED/TIMEOUT/SUCCEEDED, receipt,
provider IDs, callback age and linked basket. Flag orphan or amount/phone
mismatch. "Re-check" invokes Payment's verified Daraja status query; never set
paid based only on callback JSON or admin toggle. Refund is a separate
recorded/reversed action with manual M-Pesa reference in phase 1. Sensitive
actions require MFA/audit; mask phone and credentials.
