UPDATE "Tool"
SET
  "submitterName" = 'Redacted Submitter',
  "submitterEmail" = CONCAT('redacted+', "id", '@example.invalid')
WHERE "submitterEmail" IS NOT NULL AND "submitterEmail" <> '';

UPDATE "Report"
SET "userEmail" = CONCAT('redacted+', "id", '@example.invalid')
WHERE "userEmail" IS NOT NULL AND "userEmail" <> '';

UPDATE "Ad"
SET "email" = CONCAT('redacted+', "id", '@example.invalid')
WHERE "email" IS NOT NULL AND "email" <> '';
