# Rider Jobs

Only ACTIVE approved riders can switch AVAILABLE and see offered work. A card
contains number of shop stops, destination/drop-off summary, distance and
delivery fee; do not expose a customer's private phone/location before
assignment unless needed for the accepted job. Offers occur after all active
vendor orders are READY. First rider acceptance is atomic on server, so handle
409/job-taken idempotently and refresh available jobs. Nearby ordering uses
fresh (<2-minute) opt-in location; initial 3 km radius widens to 6 km after
two minutes, values are configuration. Jobs are backend Dispatch data, not
simulated feed.
