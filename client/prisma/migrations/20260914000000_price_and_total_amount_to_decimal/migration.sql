-- Money fields were stored as double-precision floats, which accumulate
-- rounding error on repeated arithmetic (summing order items, computing
-- totals). Moving to a fixed-point DECIMAL(10,2) removes that class of bug.
-- Existing values are cast 1:1 (rounded to 2 decimal places, which they
-- already were in practice since every price is entered/displayed as pesos
-- and cents).
ALTER TABLE "Product" ALTER COLUMN "price" TYPE DECIMAL(10,2) USING "price"::numeric(10,2);
ALTER TABLE "Order" ALTER COLUMN "totalAmount" TYPE DECIMAL(10,2) USING "totalAmount"::numeric(10,2);
ALTER TABLE "OrderItem" ALTER COLUMN "price" TYPE DECIMAL(10,2) USING "price"::numeric(10,2);
