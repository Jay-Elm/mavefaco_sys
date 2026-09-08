-- Renamed to reflect that this column now stores a path inside a private
-- Supabase Storage bucket, not a public URL. A plain RENAME preserves any
-- existing values (old free-text URLs from before this change become
-- unresolvable through the new signed-URL flow, but are left in place
-- rather than destroyed).
ALTER TABLE "User" RENAME COLUMN "idImageUrl" TO "idImagePath";
