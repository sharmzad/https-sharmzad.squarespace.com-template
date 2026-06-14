CREATE TABLE "affiliate_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer,
	"affiliate_source" varchar(100),
	"commission_amount" numeric(10, 2),
	"commission_currency" varchar(10) DEFAULT 'USD',
	"travelpayouts_booking_id" varchar(255),
	"status" varchar(50) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agency_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"company_description" text,
	"location" varchar(255),
	"operating_areas" text,
	"services" text,
	"specialties" text,
	"license_number" varchar(100),
	"years_in_business" integer,
	"logo_url" varchar(500),
	"website_url" varchar(500),
	"whatsapp" varchar(50),
	"contact_email" varchar(255),
	"facebook" varchar(255),
	"instagram" varchar(255),
	"is_verified" boolean DEFAULT false,
	"is_featured" boolean DEFAULT false,
	"approval_status" varchar(50) DEFAULT 'pending',
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "agency_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "agency_profiles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"expert_id" integer,
	"package_name" varchar(255) NOT NULL,
	"package_type" varchar(100),
	"guest_name" varchar(255) NOT NULL,
	"guest_email" varchar(255) NOT NULL,
	"guest_phone" varchar(50),
	"guest_country" varchar(100),
	"adults" integer DEFAULT 1,
	"children" integer DEFAULT 0,
	"pickup_location" text,
	"special_requests" text,
	"total_amount" numeric(10, 2),
	"currency" varchar(10) DEFAULT 'USD',
	"booking_date" date,
	"status" varchar(50) DEFAULT 'pending',
	"payment_status" varchar(50) DEFAULT 'pending',
	"payment_intent_id" varchar(255),
	"checkout_session_id" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contact_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"message" text NOT NULL,
	"subject" varchar(255),
	"status" varchar(50) DEFAULT 'new',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dive_center_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"center_name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"center_description" text,
	"location" varchar(255),
	"dive_sites" text,
	"services" text,
	"specialties" text,
	"padi_center_number" varchar(100),
	"ssi_center_number" varchar(100),
	"other_certifications" text,
	"years_in_business" integer,
	"max_daily_divers" integer,
	"logo_url" varchar(500),
	"website_url" varchar(500),
	"whatsapp" varchar(50),
	"contact_email" varchar(255),
	"facebook" varchar(255),
	"instagram" varchar(255),
	"is_verified" boolean DEFAULT false,
	"is_featured" boolean DEFAULT false,
	"approval_status" varchar(50) DEFAULT 'pending',
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dive_center_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "dive_center_profiles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "expert_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expert_type" varchar(50) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"bio" text,
	"location" varchar(255),
	"languages" text,
	"specialties" text,
	"certifications" text,
	"experience_years" integer,
	"profile_photo" varchar(500),
	"cover_photo" varchar(500),
	"hourly_rate" numeric(10, 2),
	"daily_rate" numeric(10, 2),
	"currency" varchar(10) DEFAULT 'USD',
	"whatsapp" varchar(50),
	"instagram" varchar(255),
	"facebook" varchar(255),
	"website" varchar(255),
	"availability" varchar(50) DEFAULT 'available',
	"rating" numeric(3, 2) DEFAULT '0',
	"total_reviews" integer DEFAULT 0,
	"total_bookings" integer DEFAULT 0,
	"is_verified" boolean DEFAULT false,
	"is_featured" boolean DEFAULT false,
	"view_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "expert_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "expert_profiles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "flash_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"badge" varchar(100),
	"title" varchar(255) NOT NULL,
	"description" text,
	"link" varchar(500),
	"deadline" timestamp NOT NULL,
	"discount_percentage" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"expert_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"cover_message" text,
	"status" varchar(50) DEFAULT 'applied',
	"viewed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"posted_by" integer NOT NULL,
	"poster_type" varchar(50) NOT NULL,
	"job_type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"location" varchar(255) NOT NULL,
	"employment_type" varchar(50),
	"salary_min" numeric(10, 2),
	"salary_max" numeric(10, 2),
	"currency" varchar(10) DEFAULT 'USD',
	"salary_period" varchar(50),
	"requirements" text,
	"benefits" text,
	"start_date" date,
	"duration" varchar(100),
	"contact_whatsapp" varchar(50),
	"contact_email" varchar(255),
	"application_deadline" date,
	"status" varchar(50) DEFAULT 'active',
	"approval_status" varchar(50) DEFAULT 'pending',
	"rejection_reason" text,
	"view_count" integer DEFAULT 0,
	"application_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'USD',
	"payment_method" varchar(50),
	"stripe_payment_id" varchar(255),
	"status" varchar(50) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"full_name" varchar(255) NOT NULL,
	"phone" varchar(50),
	"country" varchar(100),
	"user_type" varchar(50) DEFAULT 'customer',
	"approval_status" varchar(50) DEFAULT 'approved',
	"is_active" boolean DEFAULT true,
	"email_verified" boolean DEFAULT false,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_clicks" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_name" varchar(255) NOT NULL,
	"whatsapp_number" varchar(50) NOT NULL,
	"page_source" varchar(100) NOT NULL,
	"user_ip" varchar(50),
	"user_agent" text,
	"referrer" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "affiliate_tracking" ADD CONSTRAINT "affiliate_tracking_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_profiles" ADD CONSTRAINT "agency_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_expert_id_expert_profiles_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."expert_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dive_center_profiles" ADD CONSTRAINT "dive_center_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_profiles" ADD CONSTRAINT "expert_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_expert_id_expert_profiles_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."expert_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agency_slug" ON "agency_profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_agency_location" ON "agency_profiles" USING btree ("location");--> statement-breakpoint
CREATE INDEX "idx_agency_approval" ON "agency_profiles" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "idx_bookings_email" ON "bookings" USING btree ("guest_email");--> statement-breakpoint
CREATE INDEX "idx_bookings_status" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bookings_date" ON "bookings" USING btree ("booking_date");--> statement-breakpoint
CREATE INDEX "idx_divecenter_slug" ON "dive_center_profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_divecenter_location" ON "dive_center_profiles" USING btree ("location");--> statement-breakpoint
CREATE INDEX "idx_divecenter_approval" ON "dive_center_profiles" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "idx_expert_slug" ON "expert_profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_expert_type" ON "expert_profiles" USING btree ("expert_type");--> statement-breakpoint
CREATE INDEX "idx_expert_location" ON "expert_profiles" USING btree ("location");--> statement-breakpoint
CREATE INDEX "idx_flash_offers_active" ON "flash_offers" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_applications_job" ON "job_applications" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "idx_applications_expert" ON "job_applications" USING btree ("expert_id");--> statement-breakpoint
CREATE INDEX "idx_applications_status" ON "job_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_unique_application" ON "job_applications" USING btree ("job_id","expert_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_posted_by" ON "jobs" USING btree ("posted_by");--> statement-breakpoint
CREATE INDEX "idx_jobs_type" ON "jobs" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "idx_jobs_location" ON "jobs" USING btree ("location");--> statement-breakpoint
CREATE INDEX "idx_jobs_approval" ON "jobs" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "idx_jobs_status" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_transactions_booking" ON "transactions" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_type" ON "users" USING btree ("user_type");--> statement-breakpoint
CREATE INDEX "idx_whatsapp_service" ON "whatsapp_clicks" USING btree ("service_name");--> statement-breakpoint
CREATE INDEX "idx_whatsapp_page" ON "whatsapp_clicks" USING btree ("page_source");--> statement-breakpoint
CREATE INDEX "idx_whatsapp_date" ON "whatsapp_clicks" USING btree ("created_at");