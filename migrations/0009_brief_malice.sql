CREATE TABLE "piece_subtypes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"piece_type_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "pieces" ADD COLUMN "piece_subtype_id" integer;--> statement-breakpoint
ALTER TABLE "piece_subtypes" ADD CONSTRAINT "piece_subtypes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piece_subtypes" ADD CONSTRAINT "piece_subtypes_piece_type_id_pieces_types_id_fk" FOREIGN KEY ("piece_type_id") REFERENCES "public"."pieces_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_subtypes_user_type_name" ON "piece_subtypes" USING btree ("user_id","piece_type_id","name");--> statement-breakpoint
CREATE INDEX "idx_subtypes_user_type" ON "piece_subtypes" USING btree ("user_id","piece_type_id");--> statement-breakpoint
ALTER TABLE "pieces" ADD CONSTRAINT "pieces_piece_subtype_id_piece_subtypes_id_fk" FOREIGN KEY ("piece_subtype_id") REFERENCES "public"."piece_subtypes"("id") ON DELETE set null ON UPDATE no action;