CREATE TABLE "pieces_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pieces_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "pieces" DROP CONSTRAINT "pieces_unique_id_unique";--> statement-breakpoint
ALTER TABLE "pieces" ADD COLUMN "piece_type_id" integer;--> statement-breakpoint
ALTER TABLE "pieces_types" ADD CONSTRAINT "pieces_types_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_piece_types_user_name" ON "pieces_types" USING btree ("user_id","name");--> statement-breakpoint
ALTER TABLE "pieces" ADD CONSTRAINT "pieces_piece_type_id_pieces_types_id_fk" FOREIGN KEY ("piece_type_id") REFERENCES "public"."pieces_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces" DROP COLUMN "type";