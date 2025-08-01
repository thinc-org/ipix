-- Custom SQL migration file, put your code below! --

-- Drop all foreign key constraints that reference user table
ALTER TABLE "account" DROP CONSTRAINT "account_user_id_user_id_fk";
ALTER TABLE "session" DROP CONSTRAINT "session_user_id_user_id_fk";

-- Convert user table id to uuid first (this is the referenced column)
ALTER TABLE "user" 
ALTER COLUMN "id" TYPE uuid USING "id"::uuid;

-- Convert all referencing columns to uuid
ALTER TABLE "account"
ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid;

ALTER TABLE "session"
ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid;

-- Also convert primary keys of other tables if needed
ALTER TABLE "account"
ALTER COLUMN "id" TYPE uuid USING "id"::uuid;

ALTER TABLE "session"
ALTER COLUMN "id" TYPE uuid USING "id"::uuid;

ALTER TABLE "verification"
ALTER COLUMN "id" TYPE uuid USING "id"::uuid;

-- Recreate foreign key constraints
ALTER TABLE "account" 
ADD CONSTRAINT "account_user_id_user_id_fk" 
FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "session" 
ADD CONSTRAINT "session_user_id_user_id_fk" 
FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;