# Merchant products

List/create/edit/archive the signed-in merchant's products, integer KES price,
optional unit/photo and in-stock switch. Catalogue enforces ownership,
nonnegative price, public status and soft-delete behavior. Provide two entry
paths: direct typing and Voice draft → transcript/extraction → merchant
review/read-back → explicit publish. Draft/uncertain LLM output never appears
in the public shop. Keep product snapshots stable for existing orders after a
price/name changes.
