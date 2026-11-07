-- Link live listings that aren't linked to a crop yet, now that the crop list
-- covers every Bicol crop and carries local names (CropType.aliases). Same
-- rule as src/lib/cropKeywords.ts: the most specific name in the listing
-- wins (short names of 4 letters or fewer must stand alone as words), and a
-- tie links nothing, for a person to decide.
WITH m AS (
  SELECT p.id AS pid, c.id AS cid, max(length(a)) AS len
  FROM "Product" p
  CROSS JOIN "CropType" c
  CROSS JOIN LATERAL unnest(array_append(coalesce(c."aliases", ARRAY[]::text[]), lower(c."name"))) AS a
  WHERE p."cropTypeId" IS NULL AND NOT p."notACrop" AND p."archivedAt" IS NULL
    AND (
      (length(a) > 4 AND position(a IN lower(p."name")) > 0)
      OR (length(a) <= 4 AND lower(p."name") ~ ('(^|[^a-z])' || a || '([^a-z]|$)'))
    )
  GROUP BY p.id, c.id
), best AS (
  SELECT pid, cid,
         rank() OVER (PARTITION BY pid ORDER BY len DESC) AS r,
         count(*) OVER (PARTITION BY pid, len) AS tied
  FROM m
)
UPDATE "Product" p SET "cropTypeId" = b.cid
FROM best b
WHERE b.pid = p.id AND b.r = 1 AND b.tied = 1;
