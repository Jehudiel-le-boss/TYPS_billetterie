ALTER TABLE "events" ADD COLUMN "faq" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "countdown_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "countdown_units" jsonb DEFAULT '["days","hours","minutes","seconds"]'::jsonb NOT NULL;