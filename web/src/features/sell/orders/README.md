# Merchant orders

List only the caller's vendor-order parts, grouped by status and ready
deadline. A basket spanning shops is one separate part per merchant; do not
show other vendors' private order details. A verified-paid order is actionable:
merchant may mark READY or reject/cannot-fill within the ready window, with
reason and customer notification path. Show rider name/vehicle after
assignment, but never show the customer delivery code. Server status and
ownership checks are authoritative. Idempotently submit actions and refresh
from committed response.
