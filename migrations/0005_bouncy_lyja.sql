CREATE TABLE "stock_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"current_quantity" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL,
	"minimum_threshold" numeric(10, 2) NOT NULL,
	"supplier" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"stock_item_id" integer,
	"type" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "pieces_types" DROP CONSTRAINT "pieces_types_name_unique";--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_item_id_stock_items_id_fk" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_items_user_idx" ON "stock_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stock_items_user_type_idx" ON "stock_items" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "stock_items_user_category_idx" ON "stock_items" USING btree ("user_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_items_user_name_uq" ON "stock_items" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "stock_mov_user_idx" ON "stock_movements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stock_mov_user_item_idx" ON "stock_movements" USING btree ("user_id","stock_item_id");--> statement-breakpoint
CREATE INDEX "stock_mov_user_date_idx" ON "stock_movements" USING btree ("user_id","created_at");