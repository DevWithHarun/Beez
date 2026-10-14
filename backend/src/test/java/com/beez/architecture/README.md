# Architecture tests

Use ArchUnit (or equivalent) to enforce the modular-monolith boundary:
controllers call their own application services; cross-module access is only
through published service interfaces/events; repositories/entities are
package-private/module-owned; no module imports another module's repository,
table mapping or controller. Adapters implement business-owned SPIs and
framework wiring stays in `config`.

Add checks alongside the first domain feature and run in PR CI. These rules
prevent accidental shared-database coupling even though deployment is one
Spring Boot process. No rules/library are active yet.
