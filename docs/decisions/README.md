# Product and architecture decisions

The architecture v1.0 suggests initial values but labels several as
placeholders/open. Do not turn examples into production constants before an
owner records a decision here.

Open decisions with one file each:

- [`fees.md`](./fees.md): commission, delivery fee formula and transfer charge.
- [`zones.md`](./zones.md): market boundary, one-zone basket rule and who
  maintains boundaries.
- [`hold-period.md`](./hold-period.md): when delivered earnings become
  withdrawable and what events pause/release a hold.

Other open items tracked in the architecture: legal entity/M-Pesa account;
one-zone radius and pilot discovery; dispatch only after all shops ready vs
rolling dispatch; tracking route alias; thresholds for two-person payouts;
provider selection and legal/privacy retention. A decision entry should state
date, status, owner, context, selected option, alternatives, consequences,
effective scope and any migration/rollout impact. Update architecture and
configs from the decision rather than forking policy across READMEs.
