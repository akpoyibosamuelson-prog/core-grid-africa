ALTER TYPE "public"."notification_type" ADD VALUE 'DEBT_OVERDUE';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'SUPPLIER_DUE';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'UNUSUAL_EXPENSE';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'SALES_DECLINE';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'DEMAND_DECLINE';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'RESTOCK';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'EXPIRY';--> statement-breakpoint
CREATE TABLE "advisor_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"topic" text,
	"evidence" text,
	"source" text DEFAULT 'rules' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "safety_stock" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "supplier_lead_time_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "expiry_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "due_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "advisor_conversations" ADD CONSTRAINT "advisor_conversations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_conversations" ADD CONSTRAINT "advisor_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advisor_business_idx" ON "advisor_conversations" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "advisor_created_idx" ON "advisor_conversations" USING btree ("created_at");