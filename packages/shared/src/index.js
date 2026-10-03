"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceStatus = exports.DeliveryStage = exports.PrepUnitStatus = exports.OrderStatus = exports.Permission = exports.Role = void 0;
var Role;
(function (Role) {
    Role["ADMIN"] = "ADMIN";
    Role["KITCHEN"] = "KITCHEN";
    Role["DISPATCH"] = "DISPATCH";
    Role["DRIVER"] = "DRIVER";
})(Role || (exports.Role = Role = {}));
var Permission;
(function (Permission) {
    Permission["STAFF_MANAGE"] = "STAFF_MANAGE";
    Permission["CATALOGUE_MANAGE"] = "CATALOGUE_MANAGE";
    Permission["COMPANY_MANAGE"] = "COMPANY_MANAGE";
    Permission["EMPLOYEE_MANAGE"] = "EMPLOYEE_MANAGE";
    Permission["ORDER_CREATE"] = "ORDER_CREATE";
    Permission["ORDER_VIEW"] = "ORDER_VIEW";
    Permission["ORDER_OVERRIDE"] = "ORDER_OVERRIDE";
    Permission["KITCHEN_VIEW"] = "KITCHEN_VIEW";
    Permission["KITCHEN_UPDATE"] = "KITCHEN_UPDATE";
    Permission["DISPATCH_VIEW"] = "DISPATCH_VIEW";
    Permission["DISPATCH_UPDATE"] = "DISPATCH_UPDATE";
    Permission["DRIVER_VIEW_OWN"] = "DRIVER_VIEW_OWN";
    Permission["DRIVER_DELIVER"] = "DRIVER_DELIVER";
    Permission["BILLING_MANAGE"] = "BILLING_MANAGE";
    Permission["SETTINGS_MANAGE"] = "SETTINGS_MANAGE";
})(Permission || (exports.Permission = Permission = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["DRAFT"] = "DRAFT";
    OrderStatus["PLACED"] = "PLACED";
    OrderStatus["CONFIRMED"] = "CONFIRMED";
    OrderStatus["DELIVERED"] = "DELIVERED";
    OrderStatus["CANCELLED"] = "CANCELLED";
    OrderStatus["REJECTED"] = "REJECTED";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
var PrepUnitStatus;
(function (PrepUnitStatus) {
    PrepUnitStatus["PENDING"] = "PENDING";
    PrepUnitStatus["STARTED"] = "STARTED";
    PrepUnitStatus["DONE"] = "DONE";
})(PrepUnitStatus || (exports.PrepUnitStatus = PrepUnitStatus = {}));
var DeliveryStage;
(function (DeliveryStage) {
    DeliveryStage["KITCHEN_READY"] = "KITCHEN_READY";
    DeliveryStage["DISPATCH_READY"] = "DISPATCH_READY";
    DeliveryStage["OUT_FOR_DELIVERY"] = "OUT_FOR_DELIVERY";
    DeliveryStage["DELIVERED"] = "DELIVERED";
})(DeliveryStage || (exports.DeliveryStage = DeliveryStage = {}));
var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["PENDING"] = "PENDING";
    InvoiceStatus["PAID"] = "PAID";
})(InvoiceStatus || (exports.InvoiceStatus = InvoiceStatus = {}));
//# sourceMappingURL=index.js.map