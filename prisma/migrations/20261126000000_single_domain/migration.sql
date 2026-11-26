-- One domain, one account type (docs/reference/open-questions.md Q45).
-- Every person is a USER; sending or receiving is what they do with a parcel.
ALTER TYPE "Role" RENAME VALUE 'SENDER' TO 'USER';
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';
