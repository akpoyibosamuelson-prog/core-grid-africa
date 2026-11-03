CREATE TABLE "platform_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phone" text,
	"title" text DEFAULT 'Platform Administrator' NOT NULL,
	"is_platform_owner" boolean DEFAULT false NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"last_password_change_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "plan" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "billing_period" "billing_period";--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_meta" text;--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_admins_user_idx" ON "platform_admins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_status_provider_idx" ON "payments" USING btree ("status","provider");