CREATE TABLE "career_saves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"save_version" integer NOT NULL,
	"name" text NOT NULL,
	"current_club_id" text,
	"current_league_id" text,
	"game_date" date NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
