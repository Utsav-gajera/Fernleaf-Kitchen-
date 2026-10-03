/**
 * Shared Roles across Frontend and Backend
 */
export enum Role {
  ADMIN = 'ADMIN',
  KITCHEN = 'KITCHEN',
  DISPATCH = 'DISPATCH',
  DRIVER = 'DRIVER',
}

/**
 * Order Lifecycle Statuses
 */
export enum OrderStatus {
  DRAFT = 'DRAFT',
  PLACED = 'PLACED',
  CONFIRMED = 'CONFIRMED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

/**
 * Kitchen Prep Unit Statuses
 */
export enum PrepUnitStatus {
  PENDING = 'PENDING',
  STARTED = 'STARTED',
  DONE = 'DONE',
}

/**
 * Dispatch & Delivery Stages
 */
export enum DeliveryStage {
  KITCHEN_READY = 'KITCHEN_READY',
  DISPATCH_READY = 'DISPATCH_READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
}

/**
 * Company Invoicing Statuses
 */
export enum InvoiceStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
}

/**
 * Standard API Response Envelope
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  timestamp: string;
}

/**
 * Standard Paginated Response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Standard Pagination Query
 */
export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
