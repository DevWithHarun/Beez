import { requestAdmin } from "./session";

export type PendingRider = {
  userId: string;
  displayName: string | null;
  phoneMasked: string | null;
  area: string | null;
  createdAt: string;
};

export type PendingRefund = {
  id: string;
  orderId: string;
  basketNo: string;
  merchantName: string;
  customerPhoneMasked: string | null;
  amountKes: number;
  reason: string;
  requestedAt: string;
};

export type QueuePage<T> = { items: T[] };

export type OperationsSummary = {
  ordersToday: number;
  paidTodayKes: number;
  activeMerchants: number;
  activeRiders: number;
  averageDeliveryMinutes: number | null;
  openDeliveries: number;
  failedDeliveries: number;
  pendingMerchantApprovals: number;
  pendingRiderApprovals: number;
  paymentIssues: number;
  pendingWithdrawals: number;
  pendingRefunds: number;
  attentionItems: number;
  asOf: string;
};

export type MerchantApplicant = {
  merchantId: string;
  userId: string;
  businessName: string;
  category: string;
  zoneName: string;
  locationText: string;
  ownerName: string | null;
  ownerPhoneMasked: string | null;
  createdAt: string;
};

export type AdminOrder = {
  id: string;
  basketNo: string;
  merchantName: string;
  customerPhoneMasked: string | null;
  status: string;
  deliveryStatus: string | null;
  subtotalKes: number;
  createdAt: string;
  paidAt: string | null;
};

export type OrderEvent = {
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  detail: string;
  createdAt: string;
};

export type AdminPayment = {
  id: string;
  basketNo: string;
  phoneMasked: string;
  amountKes: number;
  provider: string;
  status: string;
  receipt: string | null;
  callbackStatus: string | null;
  createdAt: string;
  completedAt: string | null;
  resultDescription: string | null;
};

export type AdminException = {
  id: string;
  type: string;
  basketNo: string | null;
  status: string;
  detail: string;
  occurredAt: string;
};

export type AdminLedgerEntry = {
  id: string;
  accountType: string;
  accountOwner: string;
  referenceType: string;
  description: string;
  amountKes: number;
  createdAt: string;
  basketNo: string | null;
};

export type AdminUser = {
  id: string;
  role: string;
  name: string;
  phoneMasked: string | null;
  status: string;
  merchantStatus: string | null;
  riderStatus: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AuditEvent = {
  id: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: string;
  createdAt: string;
};

export type PendingWithdrawal = {
  id: string;
  merchantUserId: string;
  merchantName: string | null;
  businessName: string;
  payoutPhone: string;
  amountKes: number;
  status: "REQUESTED" | "PROCESSING";
  requestedAt: string;
  processingAt: string | null;
  processingBy: string | null;
  providerReference: string | null;
};

export function getPendingRiders() {
  return requestAdmin<QueuePage<PendingRider>>("/api/v1/operations/riders/pending");
}

export function getOperationsSummary() {
  return requestAdmin<OperationsSummary>("/api/v1/operations/dashboard");
}

export function getPendingMerchants() {
  return requestAdmin<QueuePage<MerchantApplicant>>("/api/v1/operations/merchants/pending");
}

export function reviewMerchant(merchantId: string, approve: boolean, reason: string) {
  const action = approve ? "approve" : "reject";
  return requestAdmin<void>(
    `/api/v1/operations/merchants/${encodeURIComponent(merchantId)}/${action}`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

export function getOrders() {
  return requestAdmin<QueuePage<AdminOrder>>("/api/v1/operations/orders");
}

export function getOrderTimeline(orderId: string) {
  return requestAdmin<QueuePage<OrderEvent>>(
    `/api/v1/operations/orders/${encodeURIComponent(orderId)}/timeline`,
  );
}

export function getPayments() {
  return requestAdmin<QueuePage<AdminPayment>>("/api/v1/operations/payments");
}

export function getExceptions() {
  return requestAdmin<QueuePage<AdminException>>("/api/v1/operations/exceptions");
}

export function getAdminLedger() {
  return requestAdmin<QueuePage<AdminLedgerEntry>>("/api/v1/operations/ledger");
}

export function getAdminUsers(query = "") {
  const suffix = query ? `?query=${encodeURIComponent(query)}` : "";
  return requestAdmin<QueuePage<AdminUser>>(`/api/v1/operations/users${suffix}`);
}

export function getAdminAudit(query = "") {
  const suffix = query ? `?query=${encodeURIComponent(query)}` : "";
  return requestAdmin<QueuePage<AuditEvent>>(`/api/v1/operations/audit${suffix}`);
}

export function getPendingWithdrawals() {
  return requestAdmin<QueuePage<PendingWithdrawal>>("/api/v1/operations/withdrawals/pending");
}

export function reviewWithdrawal(requestId: string) {
  return requestAdmin<void>(
    `/api/v1/operations/withdrawals/${encodeURIComponent(requestId)}/start`,
    { method: "POST" },
  );
}

export function confirmWithdrawal(requestId: string, providerReference: string) {
  return requestAdmin<void>(
    `/api/v1/operations/withdrawals/${encodeURIComponent(requestId)}/confirm`,
    { method: "POST", body: JSON.stringify({ providerReference }) },
  );
}

export function rejectWithdrawal(requestId: string, note: string, transferNotSent = false) {
  return requestAdmin<void>(
    `/api/v1/operations/withdrawals/${encodeURIComponent(requestId)}/fail`,
    { method: "POST", body: JSON.stringify({ note, transferNotSent }) },
  );
}

export function changeUserStatus(
  userId: string,
  action: "suspend" | "restore" | "logout-all",
  reason: string,
) {
  return requestAdmin<void>(`/api/v1/operations/users/${encodeURIComponent(userId)}/${action}`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function getPendingRefunds() {
  return requestAdmin<QueuePage<PendingRefund>>("/api/v1/operations/refunds/pending");
}

export function approveRider(userId: string) {
  return requestAdmin<void>(`/api/v1/operations/riders/${encodeURIComponent(userId)}/approve`, {
    method: "PATCH",
  });
}

export function confirmRefund(requestId: string, providerReference: string) {
  return requestAdmin<void>(`/api/v1/operations/refunds/${encodeURIComponent(requestId)}/confirm`, {
    method: "POST",
    body: JSON.stringify({ providerReference }),
  });
}

export function failRefund(requestId: string, note: string) {
  return requestAdmin<void>(`/api/v1/operations/refunds/${encodeURIComponent(requestId)}/fail`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}
