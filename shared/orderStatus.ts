export const ORDER_STATUSES = [
  "pending",
  "processing",
  "transit",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
];

export const IN_TRANSIT_STATUSES: readonly OrderStatus[] = [
  "transit",
  "shipped",
];

export const ACTIVE_STATUS_SET = new Set<string>(ACTIVE_ORDER_STATUSES);
export const IN_TRANSIT_STATUS_SET = new Set<string>(IN_TRANSIT_STATUSES);
