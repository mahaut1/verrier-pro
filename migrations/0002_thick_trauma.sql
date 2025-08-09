ALTER TABLE "pieces" ADD COLUMN "unique_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "pieces" ADD CONSTRAINT "pieces_unique_id_unique" UNIQUE("unique_id");