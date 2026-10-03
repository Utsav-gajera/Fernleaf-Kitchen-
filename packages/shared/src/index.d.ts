export declare enum Role {
    ADMIN = "ADMIN",
    KITCHEN = "KITCHEN",
    DISPATCH = "DISPATCH",
    DRIVER = "DRIVER"
}
export declare enum Permission {
    STAFF_MANAGE = "STAFF_MANAGE",
    CATALOGUE_MANAGE = "CATALOGUE_MANAGE",
    COMPANY_MANAGE = "COMPANY_MANAGE",
    EMPLOYEE_MANAGE = "EMPLOYEE_MANAGE",
    ORDER_CREATE = "ORDER_CREATE",
    ORDER_VIEW = "ORDER_VIEW",
    ORDER_OVERRIDE = "ORDER_OVERRIDE",
    KITCHEN_VIEW = "KITCHEN_VIEW",
    KITCHEN_UPDATE = "KITCHEN_UPDATE",
    DISPATCH_VIEW = "DISPATCH_VIEW",
    DISPATCH_UPDATE = "DISPATCH_UPDATE",
    DRIVER_VIEW_OWN = "DRIVER_VIEW_OWN",
    DRIVER_DELIVER = "DRIVER_DELIVER",
    BILLING_MANAGE = "BILLING_MANAGE",
    SETTINGS_MANAGE = "SETTINGS_MANAGE"
}
export declare enum OrderStatus {
    DRAFT = "DRAFT",
    PLACED = "PLACED",
    CONFIRMED = "CONFIRMED",
    DELIVERED = "DELIVERED",
    CANCELLED = "CANCELLED",
    REJECTED = "REJECTED"
}
export declare enum PrepUnitStatus {
    PENDING = "PENDING",
    STARTED = "STARTED",
    DONE = "DONE"
}
export declare enum DeliveryStage {
    KITCHEN_READY = "KITCHEN_READY",
    DISPATCH_READY = "DISPATCH_READY",
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
    DELIVERED = "DELIVERED"
}
export declare enum InvoiceStatus {
    PENDING = "PENDING",
    PAID = "PAID"
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    data?: T;
    timestamp: string;
}
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export interface PaginationQuery {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
