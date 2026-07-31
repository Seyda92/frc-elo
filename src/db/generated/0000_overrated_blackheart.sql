-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "event" (
	"event_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "event_event_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"club_id" integer
);
--> statement-breakpoint
CREATE TABLE "rating_model" (
	"model_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rating_model_model_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text DEFAULT 'v3' NOT NULL,
	"description" text DEFAULT 'v3: nullsummen-neutral, Gleichverteilung P/n' NOT NULL,
	"start_rating" numeric(10, 4) DEFAULT '200' NOT NULL,
	"size_factor_offset" numeric(10, 4) DEFAULT '7.0' NOT NULL,
	"is_zero_sum" integer DEFAULT 1 NOT NULL,
	"distribution" text DEFAULT 'equal' NOT NULL,
	"provisional_games" integer DEFAULT 15 NOT NULL,
	"provisional_k_boost" numeric(10, 4) DEFAULT '3.0' NOT NULL,
	CONSTRAINT "rating_model_code_key" UNIQUE("code"),
	CONSTRAINT "rating_model_code_check" CHECK (code = 'v3'::text)
);
--> statement-breakpoint
CREATE TABLE "match" (
	"match_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "match_match_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"event_id" integer,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL,
	"k_factor" integer NOT NULL,
	"can_diff" integer DEFAULT 0 NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "match_referee" (
	"match_id" integer PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_team" (
	"match_team_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "match_team_match_team_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"match_id" integer NOT NULL,
	"side" text NOT NULL,
	"team_size" integer NOT NULL,
	"score" numeric(2, 1) NOT NULL,
	CONSTRAINT "match_team_match_id_side_key" UNIQUE("match_id","side"),
	CONSTRAINT "match_team_side_check" CHECK (side = ANY (ARRAY['A'::text, 'B'::text])),
	CONSTRAINT "match_team_score_check" CHECK (score = ANY (ARRAY[(0)::numeric, (1)::numeric])),
	CONSTRAINT "match_team_team_size_check" CHECK ((team_size >= 1) AND (team_size <= 20))
);
--> statement-breakpoint
CREATE TABLE "player_referee_stats" (
	"player_id" integer PRIMARY KEY NOT NULL,
	"matches_reffed" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_history" (
	"history_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rating_history_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"match_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"model_id" integer NOT NULL,
	"rating_before" numeric(10, 4) NOT NULL,
	"delta" numeric(10, 4) NOT NULL,
	"rating_after" numeric(10, 4) NOT NULL,
	"games_played" integer NOT NULL,
	CONSTRAINT "rating_history_match_id_player_id_model_id_key" UNIQUE("match_id","player_id","model_id")
);
--> statement-breakpoint
CREATE TABLE "club" (
	"club_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "club_club_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"city" text
);
--> statement-breakpoint
CREATE TABLE "player" (
	"player_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "player_player_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"club_id" integer,
	"display_name" text NOT NULL,
	"jersey_number" integer,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "player_club_id_jersey_number_key" UNIQUE("club_id","jersey_number")
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"user_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_user_user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"player_id" integer,
	CONSTRAINT "app_user_username_key" UNIQUE("username"),
	CONSTRAINT "app_user_role_check" CHECK (role = ANY (ARRAY['admin'::text, 'user'::text]))
);
--> statement-breakpoint
CREATE TABLE "team_factor" (
	"model_id" integer NOT NULL,
	"size_diff" integer NOT NULL,
	"factor" numeric(10, 6) NOT NULL,
	CONSTRAINT "team_factor_pkey" PRIMARY KEY("model_id","size_diff")
);
--> statement-breakpoint
CREATE TABLE "match_participation" (
	"match_team_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"bonus_beer" integer DEFAULT 0 NOT NULL,
	"throws" integer,
	"hits" integer,
	CONSTRAINT "match_participation_pkey" PRIMARY KEY("match_team_id","player_id"),
	CONSTRAINT "match_participation_bonus_beer_check" CHECK ((bonus_beer >= 0) AND (bonus_beer <= 10)),
	CONSTRAINT "match_participation_check" CHECK ((hits IS NULL) OR (throws IS NULL) OR (hits <= throws))
);
--> statement-breakpoint
CREATE TABLE "player_rating_current" (
	"player_id" integer NOT NULL,
	"model_id" integer NOT NULL,
	"rating" numeric(10, 4) NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_rating_current_pkey" PRIMARY KEY("player_id","model_id")
);
--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."club"("club_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."event"("event_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_referee" ADD CONSTRAINT "match_referee_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."match"("match_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_referee" ADD CONSTRAINT "match_referee_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player"("player_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_team" ADD CONSTRAINT "match_team_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."match"("match_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_referee_stats" ADD CONSTRAINT "player_referee_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player"("player_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."match"("match_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player"("player_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."rating_model"("model_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player" ADD CONSTRAINT "player_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "public"."club"("club_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player"("player_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_factor" ADD CONSTRAINT "team_factor_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."rating_model"("model_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participation" ADD CONSTRAINT "match_participation_match_team_id_fkey" FOREIGN KEY ("match_team_id") REFERENCES "public"."match_team"("match_team_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participation" ADD CONSTRAINT "match_participation_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player"("player_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_rating_current" ADD CONSTRAINT "player_rating_current_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player"("player_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_rating_current" ADD CONSTRAINT "player_rating_current_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "public"."rating_model"("model_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_match_event" ON "match" USING btree ("event_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_history_match" ON "rating_history" USING btree ("match_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_history_player_model" ON "rating_history" USING btree ("player_id" int4_ops,"model_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_player_club" ON "player" USING btree ("club_id" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_participation_player" ON "match_participation" USING btree ("player_id" int4_ops);
*/