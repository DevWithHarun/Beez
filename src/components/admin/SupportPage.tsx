import { useMemo, useState, type FormEvent } from "react";
import { PageTitle } from "@/components/admin/AdminShell";
import {
  createAdminTicket,
  exportCsv,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  updateAdminTicket,
  useTable,
  type AdminTicketInput,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/admin-data";

const EMPTY_TICKET: AdminTicketInput = {
  subject: "",
  customer_name: "",
  customer_phone: "",
  order_id: "",
  priority: "Medium",
};

export function SupportPage() {
  const { rows, loaded, error, reload } = useTable<Ticket>("support_tickets");
  const [draft, setDraft] = useState<AdminTicketInput>(EMPTY_TICKET);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TicketPriority>("all");
  const [busy, setBusy] = useState(false);
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const tickets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((ticket) => {
      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
      const searchable = [
        ticket.ticket_no,
        ticket.subject,
        ticket.customer_name,
        ticket.customer_phone,
        ticket.order_id,
        ticket.notes,
      ]
        .join(" ")
        .toLowerCase();
      return matchesStatus && matchesPriority && (!query || searchable.includes(query));
    });
  }, [rows, search, statusFilter, priorityFilter]);

  const updateTicket = async (
    ticket: Ticket,
    patch: Partial<Pick<Ticket, "status" | "notes">>,
    successMessage: string,
  ) => {
    setBusyTicketId(ticket.id);
    setActionError(null);
    setNotice(null);
    try {
      await updateAdminTicket(ticket.id, patch);
      await reload();
      setNotice(successMessage);
      if (patch.notes !== undefined) {
        setNotesDrafts((current) => {
          const next = { ...current };
          delete next[ticket.id];
          return next;
        });
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not update this support ticket.",
      );
    } finally {
      setBusyTicketId(null);
    }
  };

  const submitTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await createAdminTicket({
        ...draft,
        subject: draft.subject.trim(),
        customer_name: draft.customer_name.trim(),
        customer_phone: draft.customer_phone.trim(),
        order_id: draft.order_id?.trim() || null,
      });
      setDraft(EMPTY_TICKET);
      await reload();
      setNotice("Support ticket created.");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not create the support ticket.",
      );
    } finally {
      setBusy(false);
    }
  };

  const exportTickets = () =>
    exportCsv(
      "support-tickets.csv",
      tickets.map((ticket) => ({
        ticket_no: `TKT-${ticket.ticket_no}`,
        subject: ticket.subject,
        customer_name: ticket.customer_name,
        customer_phone: ticket.customer_phone,
        order_id: ticket.order_id ?? "",
        priority: ticket.priority,
        status: ticket.status,
        notes: ticket.notes,
        created_at: ticket.created_at,
      })),
    );

  const openCount = rows.filter((ticket) => ticket.status === "Open").length;

  return (
    <div className="ad-page">
      <PageTitle
        title="Support"
        sub={`${openCount} open tickets · ${rows.length} total`}
        action={
          <button className="ad-btn ghost" onClick={exportTickets} disabled={!tickets.length}>
            Export CSV
          </button>
        }
      />

      {actionError && (
        <p className="ad-msg" role="alert">
          {actionError}
        </p>
      )}
      {notice && (
        <p className="ad-muted" role="status">
          {notice}
        </p>
      )}

      <form className="ad-card ad-form" onSubmit={submitTicket}>
        <h2>Open a support ticket</h2>
        <label>
          Subject
          <input
            className="ad-input"
            required
            maxLength={200}
            value={draft.subject}
            onChange={(event) =>
              setDraft((current) => ({ ...current, subject: event.target.value }))
            }
          />
        </label>
        <label>
          Customer
          <input
            className="ad-input"
            maxLength={160}
            value={draft.customer_name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, customer_name: event.target.value }))
            }
          />
        </label>
        <label>
          Phone
          <input
            className="ad-input"
            type="tel"
            maxLength={40}
            value={draft.customer_phone}
            onChange={(event) =>
              setDraft((current) => ({ ...current, customer_phone: event.target.value }))
            }
          />
        </label>
        <label>
          Order ID
          <input
            className="ad-input"
            maxLength={100}
            value={draft.order_id ?? ""}
            onChange={(event) =>
              setDraft((current) => ({ ...current, order_id: event.target.value }))
            }
          />
        </label>
        <label>
          Priority
          <select
            className="ad-input"
            value={draft.priority}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                priority: event.target.value as TicketPriority,
              }))
            }
          >
            {TICKET_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
        <button className="ad-btn" disabled={busy}>
          {busy ? "Creating…" : "Open ticket"}
        </button>
      </form>

      <div className="ad-card">
        <div className="ad-toolbar">
          <input
            className="ad-input"
            type="search"
            placeholder="Search ticket, customer, order, notes"
            aria-label="Search support tickets"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="ad-input"
            aria-label="Filter tickets by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | TicketStatus)}
          >
            <option value="all">All statuses</option>
            {TICKET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            className="ad-input"
            aria-label="Filter tickets by priority"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as "all" | TicketPriority)}
          >
            <option value="all">All priorities</option>
            {TICKET_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
          <button className="ad-btn ghost" onClick={() => void reload()} disabled={!loaded}>
            Refresh
          </button>
        </div>

        {error && (
          <p className="ad-msg" role="alert">
            Could not load support tickets: {error}
          </p>
        )}
        {!loaded && (
          <p className="ad-muted" role="status">
            Loading support tickets…
          </p>
        )}
        {loaded && !error && tickets.length === 0 && (
          <p className="ad-muted">No support tickets match the current filters.</p>
        )}
        {tickets.length > 0 && (
          <table className="ad-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Subject</th>
                <th>Customer</th>
                <th>Order</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => {
                const notes = notesDrafts[ticket.id] ?? ticket.notes;
                const isBusy = busyTicketId === ticket.id;
                return (
                  <tr key={ticket.id}>
                    <td>TKT-{ticket.ticket_no}</td>
                    <td>{ticket.subject}</td>
                    <td>
                      {ticket.customer_name || "Guest"}
                      <br />
                      <span className="ad-muted">{ticket.customer_phone}</span>
                    </td>
                    <td>{ticket.order_id ? `#${ticket.order_id}` : "—"}</td>
                    <td>{ticket.priority}</td>
                    <td>
                      <select
                        className="ad-input"
                        aria-label={`Status for ticket TKT-${ticket.ticket_no}`}
                        value={ticket.status}
                        disabled={isBusy}
                        onChange={(event) =>
                          void updateTicket(
                            ticket,
                            { status: event.target.value as TicketStatus },
                            `Ticket TKT-${ticket.ticket_no} updated.`,
                          )
                        }
                      >
                        {TICKET_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="ad-input"
                        aria-label={`Notes for ticket TKT-${ticket.ticket_no}`}
                        value={notes}
                        maxLength={2000}
                        disabled={isBusy}
                        onChange={(event) =>
                          setNotesDrafts((current) => ({
                            ...current,
                            [ticket.id]: event.target.value,
                          }))
                        }
                      />
                      <button
                        className="ad-btn ghost"
                        disabled={isBusy || notes === ticket.notes}
                        onClick={() =>
                          void updateTicket(
                            ticket,
                            { notes: notes.trim() },
                            `Notes saved for ticket TKT-${ticket.ticket_no}.`,
                          )
                        }
                      >
                        Save notes
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
