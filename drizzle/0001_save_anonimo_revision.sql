ALTER TABLE "career_saves" ADD COLUMN "access_token_hash" text;--> statement-breakpoint
ALTER TABLE "career_saves" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "career_saves" ADD CONSTRAINT "career_saves_access_token_hash_unique" UNIQUE("access_token_hash");