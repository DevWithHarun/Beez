# Active delivery

Render the accepted delivery's ordered shop stops and final customer
drop-off. Show only route-relevant shop names, landmarks, map links and tap to
call as policy permits. Confirm each pickup; the server allows skip only for a
rejected/cancelled vendor part. When last active stop is picked up, show
ON_THE_WAY and let Track display rounded rider position. At drop-off, submit
customer's four-digit code; never store/display its HMAC, cap attempts at five
and show a lock/need-admin state after limit. "Customer not found" enters
FAILED/manual admin decision flow. State transitions are server-controlled.
