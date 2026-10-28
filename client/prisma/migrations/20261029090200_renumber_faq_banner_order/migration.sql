-- FAQs and banners are now arranged with move up/down buttons instead of a
-- typed number, which allowed negatives and ties. Renumber the existing ones
-- 0, 1, 2... in their current order (ties by age), so the buttons start
-- from a clean sequence.
UPDATE "Faq" f SET "displayOrder" = r.pos
FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "displayOrder", "id") - 1 AS pos FROM "Faq") r
WHERE f."id" = r."id";

UPDATE "Banner" b SET "displayOrder" = r.pos
FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "displayOrder", "id") - 1 AS pos FROM "Banner") r
WHERE b."id" = r."id";
