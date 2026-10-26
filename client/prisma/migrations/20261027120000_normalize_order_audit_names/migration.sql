-- Order audit entries were written under two entity names ("Order" from
-- customer actions and checkout, "ORDER" from staff and farmers), which
-- split them in the audit-log filter. Use "ORDER" throughout, and name the
-- checkout entry CREATE_ORDER like the other CREATE_* actions.
UPDATE "AuditLog" SET "action" = 'CREATE_ORDER' WHERE "entityType" = 'Order' AND "action" = 'CREATE';
UPDATE "AuditLog" SET "entityType" = 'ORDER' WHERE "entityType" = 'Order';
