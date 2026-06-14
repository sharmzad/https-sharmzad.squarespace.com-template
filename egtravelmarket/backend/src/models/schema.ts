import { pgTable, serial, varchar, text, integer, decimal, timestamp, boolean, date, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table - Extended for authentication with expert accounts
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  country: varchar("country", { length: 100 }),
  userType: varchar("user_type", { length: 50 }).default("customer"), // customer, guide, diver, mentor, agency, divecenter, admin
  approvalStatus: varchar("approval_status", { length: 50 }).default("approved"), // pending, approved, rejected (for agencies and experts)
  certificationStatus: varchar("certification_status", { length: 50 }).default("pending"), // pending, certified, rejected
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by", { length: 255 }),
  rejectionReason: text("rejection_reason"),
  agencyLegalConfirmation: boolean("agency_legal_confirmation").default(false),
  foreignAgencyConfirmation: boolean("foreign_agency_confirmation").default(false),
  isActive: boolean("is_active").default(true),
  emailVerified: boolean("email_verified").default(false),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  emailIdx: index("idx_users_email").on(table.email),
  userTypeIdx: index("idx_users_type").on(table.userType),
}));

// Expert profiles table for guides, divers, and mentors
export const expertProfiles = pgTable("expert_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  expertType: varchar("expert_type", { length: 50 }).notNull(), // guide, diver, mentor
  slug: varchar("slug", { length: 255 }).notNull().unique(), // URL-friendly name (e.g., ahmed-hassan)
  displayName: varchar("display_name", { length: 255 }).notNull(),
  bio: text("bio"),
  location: varchar("location", { length: 255 }),
  languages: text("languages"), // JSON array of languages
  specialties: text("specialties"), // JSON array of specialties
  certifications: text("certifications"), // JSON array of certifications
  experienceYears: integer("experience_years"),
  profilePhoto: varchar("profile_photo", { length: 500 }),
  coverPhoto: varchar("cover_photo", { length: 500 }),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("USD"),
  whatsapp: varchar("whatsapp", { length: 50 }),
  instagram: varchar("instagram", { length: 255 }),
  facebook: varchar("facebook", { length: 255 }),
  website: varchar("website", { length: 255 }),
  availability: varchar("availability", { length: 50 }).default("available"), // available, busy, unavailable
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  totalReviews: integer("total_reviews").default(0),
  totalBookings: integer("total_bookings").default(0),
  isVerified: boolean("is_verified").default(false),
  isFeatured: boolean("is_featured").default(false),
  viewCount: integer("view_count").default(0),
  licenseNumber: text("license_number"),
  licenseIssueDate: date("license_issue_date"),
  licenseExpiryDate: date("license_expiry_date"),
  ministryLicenseFrontUrl: text("ministry_license_front_url"),
  ministryLicenseBackUrl: text("ministry_license_back_url"),
  syndicateLicenseFrontUrl: text("syndicate_license_front_url"),
  syndicateLicenseBackUrl: text("syndicate_license_back_url"),
  termsAccepted: boolean("terms_accepted").default(false),
  licenseConfirmed: boolean("license_confirmed").default(false),
  verificationConsent: boolean("verification_consent").default(false),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  verificationStatus: varchar("verification_status", { length: 50 }).default("pending"),
  verifiedAt: timestamp("verified_at"),
  verificationNotes: text("verification_notes"),
  certificationDocumentUrl: text("certification_document_url"),
  insuranceDocumentUrl: text("insurance_document_url"),
  insuranceExpiryDate: date("insurance_expiry_date"),
  diverTermsAgreement: boolean("diver_terms_agreement").default(false),
  diverAccuracyConfirmation: boolean("diver_accuracy_confirmation").default(false),
  diverVerificationConsent: boolean("diver_verification_consent").default(false),
  mentorRoleAgreement: boolean("mentor_role_agreement").default(false),
  mentorTermsAgreement: boolean("mentor_terms_agreement").default(false),
  mentorAccuracyConfirmation: boolean("mentor_accuracy_confirmation").default(false),
  mentorVerificationConsent: boolean("mentor_verification_consent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  slugIdx: index("idx_expert_slug").on(table.slug),
  expertTypeIdx: index("idx_expert_type").on(table.expertType),
  locationIdx: index("idx_expert_location").on(table.location),
  verificationStatusIdx: index("idx_expert_verification_status").on(table.verificationStatus),
}));

// Bookings table for all tour/package reservations
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  expertId: integer("expert_id").references(() => expertProfiles.id),
  packageName: varchar("package_name", { length: 255 }).notNull(),
  packageType: varchar("package_type", { length: 100 }),
  guestName: varchar("guest_name", { length: 255 }).notNull(),
  guestEmail: varchar("guest_email", { length: 255 }).notNull(),
  guestPhone: varchar("guest_phone", { length: 50 }),
  guestCountry: varchar("guest_country", { length: 100 }),
  adults: integer("adults").default(1),
  children: integer("children").default(0),
  pickupLocation: text("pickup_location"),
  specialRequests: text("special_requests"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("USD"),
  bookingDate: date("booking_date"),
  status: varchar("status", { length: 50 }).default("pending"),
  paymentStatus: varchar("payment_status", { length: 50 }).default("pending"),
  paymentIntentId: varchar("payment_intent_id", { length: 255 }),
  checkoutSessionId: varchar("checkout_session_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  emailIdx: index("idx_bookings_email").on(table.guestEmail),
  statusIdx: index("idx_bookings_status").on(table.status),
  dateIdx: index("idx_bookings_date").on(table.bookingDate),
}));

// Transactions table for payment records
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD"),
  paymentMethod: varchar("payment_method", { length: 50 }),
  stripePaymentId: varchar("stripe_payment_id", { length: 255 }),
  status: varchar("status", { length: 50 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  bookingIdx: index("idx_transactions_booking").on(table.bookingId),
}));

// Flash offers table for promotional deals
export const flashOffers = pgTable("flash_offers", {
  id: serial("id").primaryKey(),
  badge: varchar("badge", { length: 100 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  link: varchar("link", { length: 500 }),
  deadline: timestamp("deadline").notNull(),
  discountPercentage: integer("discount_percentage"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  activeIdx: index("idx_flash_offers_active").on(table.isActive),
}));

// Contact submissions table
export const contactSubmissions = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  message: text("message").notNull(),
  subject: varchar("subject", { length: 255 }),
  status: varchar("status", { length: 50 }).default("new"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Affiliate tracking table for Travelpayouts integration
export const affiliateTracking = pgTable("affiliate_tracking", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.id),
  affiliateSource: varchar("affiliate_source", { length: 100 }),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }),
  commissionCurrency: varchar("commission_currency", { length: 10 }).default("USD"),
  travelpayoutsBookingId: varchar("travelpayouts_booking_id", { length: 255 }),
  status: varchar("status", { length: 50 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// WhatsApp click tracking table
export const whatsappClicks = pgTable("whatsapp_clicks", {
  id: serial("id").primaryKey(),
  serviceName: varchar("service_name", { length: 255 }).notNull(),
  whatsappNumber: varchar("whatsapp_number", { length: 50 }).notNull(),
  pageSource: varchar("page_source", { length: 100 }).notNull(),
  userIp: varchar("user_ip", { length: 50 }),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  serviceIdx: index("idx_whatsapp_service").on(table.serviceName),
  pageIdx: index("idx_whatsapp_page").on(table.pageSource),
  dateIdx: index("idx_whatsapp_date").on(table.createdAt),
}));

// ============ EXPERT TRIPS TABLES ============

// Expert Trips - Main table for expert-created trips (also used by agencies)
export const expertTrips = pgTable("expert_trips", {
  id: serial("id").primaryKey(),
  expertId: integer("expert_id").references(() => expertProfiles.id), // NULL for agency trips
  userId: integer("user_id").references(() => users.id).notNull(),
  createdByType: varchar("created_by_type", { length: 50 }).default("expert"), // 'expert' or 'agency'
  agencyId: integer("agency_id").references(() => agencyProfiles.id), // Set when created by agency
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  expertType: varchar("expert_type", { length: 50 }), // guide, diver, mentor - NULL for agency trips
  tripType: varchar("trip_type", { length: 100 }), // e.g., "Scuba Diving", "Desert Safari", "Mentorship Course"
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD"),
  location: varchar("location", { length: 255 }).notNull(),
  duration: varchar("duration", { length: 100 }), // e.g., "3 days", "Half day", "4 weeks"
  maxGroupSize: integer("max_group_size"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  image: varchar("image", { length: 500 }),
  highlights: text("highlights"), // JSON array
  requirements: text("requirements"), // JSON array
  includedServices: text("included_services"), // JSON array
  excludedServices: text("excluded_services"), // JSON array
  cancellationPolicy: text("cancellation_policy"),
  status: varchar("status", { length: 50 }).default("draft"), // draft, pending_approval, approved, published, archived
  adminNotes: text("admin_notes"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  totalReviews: integer("total_reviews").default(0),
  totalBookings: integer("total_bookings").default(0),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  expertIdx: index("idx_expert_trips_expert").on(table.expertId),
  agencyIdx: index("idx_expert_trips_agency").on(table.agencyId),
  statusIdx: index("idx_expert_trips_status").on(table.status),
  locationIdx: index("idx_expert_trips_location").on(table.location),
  expertTypeIdx: index("idx_expert_trips_expert_type").on(table.expertType),
  createdByTypeIdx: index("idx_expert_trips_created_by_type").on(table.createdByType),
}));

// Expert Trip Bookings - Guest checkout bookings
export const expertTripBookings = pgTable("expert_trip_bookings", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").references(() => expertTrips.id).notNull(),
  userId: integer("user_id").references(() => users.id), // Optional - for registered users
  travelerName: varchar("traveler_name", { length: 255 }).notNull(),
  travelerEmail: varchar("traveler_email", { length: 255 }).notNull(),
  travelerPhone: varchar("traveler_phone", { length: 50 }).notNull(),
  travelers: integer("travelers").default(1),
  specialRequests: text("special_requests"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD"),
  bookingStatus: varchar("booking_status", { length: 50 }).default("pending"), // pending, confirmed, completed, cancelled
  paymentStatus: varchar("payment_status", { length: 50 }).default("pending"), // pending, paid, escrow, refunded
  paymentIntentId: varchar("payment_intent_id", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tripIdx: index("idx_expert_trip_bookings_trip").on(table.tripId),
  emailIdx: index("idx_expert_trip_bookings_email").on(table.travelerEmail),
  statusIdx: index("idx_expert_trip_bookings_status").on(table.bookingStatus),
}));

// Expert Trip Payments - Escrow payments with commission
export const expertTripPayments = pgTable("expert_trip_payments", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => expertTripBookings.id).notNull(),
  tripId: integer("trip_id").references(() => expertTrips.id).notNull(),
  expertId: integer("expert_id").references(() => expertProfiles.id).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  platformCommission: decimal("platform_commission", { precision: 10, scale: 2 }).notNull(), // 20% of totalAmount
  expertAmount: decimal("expert_amount", { precision: 10, scale: 2 }).notNull(), // 80% of totalAmount
  currency: varchar("currency", { length: 10 }).default("USD"),
  status: varchar("status", { length: 50 }).default("escrow"), // escrow, released, refunded, disputed
  paymentMethod: varchar("payment_method", { length: 50 }), // stripe, etc.
  stripePaymentId: varchar("stripe_payment_id", { length: 255 }),
  releaseDate: timestamp("release_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  bookingIdx: index("idx_expert_trip_payments_booking").on(table.bookingId),
  expertIdx: index("idx_expert_trip_payments_expert").on(table.expertId),
  statusIdx: index("idx_expert_trip_payments_status").on(table.status),
}));

// Expert Trip Disputes - Handle cancellations and complaints
export const expertTripDisputes = pgTable("expert_trip_disputes", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => expertTripBookings.id).notNull(),
  tripId: integer("trip_id").references(() => expertTrips.id).notNull(),
  expertId: integer("expert_id").references(() => expertProfiles.id).notNull(),
  complainantType: varchar("complainant_type", { length: 50 }).notNull(), // traveler, expert
  reason: varchar("reason", { length: 100 }).notNull(), // cancellation, quality, safety, payment, other
  description: text("description").notNull(),
  status: varchar("status", { length: 50 }).default("open"), // open, under_review, resolved, closed
  resolution: text("resolution"),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => ({
  bookingIdx: index("idx_disputes_booking").on(table.bookingId),
  tripIdx: index("idx_disputes_trip").on(table.tripId),
  statusIdx: index("idx_disputes_status").on(table.status),
}));

// Define relations
export const usersRelations = relations(users, ({ one }) => ({
  expertProfile: one(expertProfiles, {
    fields: [users.id],
    references: [expertProfiles.userId],
  }),
}));

export const expertProfilesRelations = relations(expertProfiles, ({ one }) => ({
  user: one(users, {
    fields: [expertProfiles.userId],
    references: [users.id],
  }),
}));

// Agency profiles table for travel agencies
export const agencyProfiles = pgTable("agency_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  companyDescription: text("company_description"),
  location: varchar("location", { length: 255 }),
  operatingAreas: text("operating_areas"), // JSON array: ["Cairo", "Sharm El-Sheikh", "Hurghada"]
  services: text("services"), // JSON array: ["Tours", "Diving", "Hotels", "Transportation"]
  specialties: text("specialties"), // JSON array of what they specialize in
  licenseNumber: varchar("license_number", { length: 100 }),
  tourismLicenseUrl: text("tourism_license_url"),
  yearsInBusiness: integer("years_in_business"),
  logoUrl: varchar("logo_url", { length: 500 }),
  websiteUrl: varchar("website_url", { length: 500 }),
  whatsapp: varchar("whatsapp", { length: 50 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  facebook: varchar("facebook", { length: 255 }),
  instagram: varchar("instagram", { length: 255 }),
  isVerified: boolean("is_verified").default(false),
  isFeatured: boolean("is_featured").default(false),
  approvalStatus: varchar("approval_status", { length: 50 }).default("pending"), // pending, approved, rejected
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  slugIdx: index("idx_agency_slug").on(table.slug),
  locationIdx: index("idx_agency_location").on(table.location),
  approvalIdx: index("idx_agency_approval").on(table.approvalStatus),
}));

// Jobs table for agencies, dive centers and experts to post job opportunities
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  postedBy: integer("posted_by").references(() => users.id).notNull(), // Can be agency, divecenter or expert
  posterType: varchar("poster_type", { length: 50 }).notNull(), // 'agency', 'divecenter' or 'expert'
  jobType: varchar("job_type", { length: 50 }).notNull(), // 'guide', 'diver', 'mentor'
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  employmentType: varchar("employment_type", { length: 50 }), // 'full-time', 'part-time', 'contract', 'seasonal'
  salaryMin: decimal("salary_min", { precision: 10, scale: 2 }),
  salaryMax: decimal("salary_max", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("USD"),
  salaryPeriod: varchar("salary_period", { length: 50 }), // 'hourly', 'daily', 'monthly'
  requirements: text("requirements"), // JSON array or text
  benefits: text("benefits"),
  startDate: date("start_date"),
  duration: varchar("duration", { length: 100 }), // "3 months", "seasonal", "ongoing"
  contactWhatsapp: varchar("contact_whatsapp", { length: 50 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  applicationDeadline: date("application_deadline"),
  status: varchar("status", { length: 50 }).default("active"), // active, filled, expired, closed
  approvalStatus: varchar("approval_status", { length: 50 }).default("pending"), // pending, approved, rejected
  rejectionReason: text("rejection_reason"),
  viewCount: integer("view_count").default(0),
  applicationCount: integer("application_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  postedByIdx: index("idx_jobs_posted_by").on(table.postedBy),
  jobTypeIdx: index("idx_jobs_type").on(table.jobType),
  locationIdx: index("idx_jobs_location").on(table.location),
  approvalIdx: index("idx_jobs_approval").on(table.approvalStatus),
  statusIdx: index("idx_jobs_status").on(table.status),
}));

// Job applications table
export const jobApplications = pgTable("job_applications", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  expertId: integer("expert_id").references(() => expertProfiles.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  coverMessage: text("cover_message"),
  status: varchar("status", { length: 50 }).default("applied"), // applied, viewed, contacted, rejected, hired
  viewedAt: timestamp("viewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  jobIdx: index("idx_applications_job").on(table.jobId),
  expertIdx: index("idx_applications_expert").on(table.expertId),
  statusIdx: index("idx_applications_status").on(table.status),
  uniqueApplication: index("idx_unique_application").on(table.jobId, table.expertId),
}));

// Dive Center profiles table for diving centers
export const diveCenterProfiles = pgTable("dive_center_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  centerName: varchar("center_name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  centerDescription: text("center_description"),
  location: varchar("location", { length: 255 }),
  diveSites: text("dive_sites"), // JSON array: ["Ras Mohammed", "Thistlegorm", "Blue Hole"]
  services: text("services"), // JSON array: ["PADI Courses", "Equipment Rental", "Boat Trips", "Snorkeling"]
  specialties: text("specialties"), // JSON array: ["Technical Diving", "Freediving", "Wreck Diving", "Adaptive Diving"]
  padiCenterNumber: varchar("padi_center_number", { length: 100 }),
  ssiCenterNumber: varchar("ssi_center_number", { length: 100 }),
  otherCertifications: text("other_certifications"), // JSON array of other certifications
  yearsInBusiness: integer("years_in_business"),
  maxDailyDivers: integer("max_daily_divers"),
  logoUrl: varchar("logo_url", { length: 500 }),
  websiteUrl: varchar("website_url", { length: 500 }),
  whatsapp: varchar("whatsapp", { length: 50 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  facebook: varchar("facebook", { length: 255 }),
  instagram: varchar("instagram", { length: 255 }),
  isVerified: boolean("is_verified").default(false),
  isFeatured: boolean("is_featured").default(false),
  approvalStatus: varchar("approval_status", { length: 50 }).default("pending"), // pending, approved, rejected
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  slugIdx: index("idx_divecenter_slug").on(table.slug),
  locationIdx: index("idx_divecenter_location").on(table.location),
  approvalIdx: index("idx_divecenter_approval").on(table.approvalStatus),
}));

// Relations for new tables
export const agencyProfilesRelations = relations(agencyProfiles, ({ one }) => ({
  user: one(users, {
    fields: [agencyProfiles.userId],
    references: [users.id],
  }),
}));

export const diveCenterProfilesRelations = relations(diveCenterProfiles, ({ one }) => ({
  user: one(users, {
    fields: [diveCenterProfiles.userId],
    references: [users.id],
  }),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  poster: one(users, {
    fields: [jobs.postedBy],
    references: [users.id],
  }),
  applications: many(jobApplications),
}));

export const jobApplicationsRelations = relations(jobApplications, ({ one }) => ({
  job: one(jobs, {
    fields: [jobApplications.jobId],
    references: [jobs.id],
  }),
  expert: one(expertProfiles, {
    fields: [jobApplications.expertId],
    references: [expertProfiles.id],
  }),
  user: one(users, {
    fields: [jobApplications.userId],
    references: [users.id],
  }),
}));

// Expert Trips Relations
export const expertTripsRelations = relations(expertTrips, ({ one, many }) => ({
  expert: one(expertProfiles, {
    fields: [expertTrips.expertId],
    references: [expertProfiles.id],
  }),
  user: one(users, {
    fields: [expertTrips.userId],
    references: [users.id],
  }),
  bookings: many(expertTripBookings),
  payments: many(expertTripPayments),
  disputes: many(expertTripDisputes),
}));

export const expertTripBookingsRelations = relations(expertTripBookings, ({ one, many }) => ({
  trip: one(expertTrips, {
    fields: [expertTripBookings.tripId],
    references: [expertTrips.id],
  }),
  user: one(users, {
    fields: [expertTripBookings.userId],
    references: [users.id],
  }),
  payment: one(expertTripPayments),
  dispute: one(expertTripDisputes),
}));

export const expertTripPaymentsRelations = relations(expertTripPayments, ({ one }) => ({
  booking: one(expertTripBookings, {
    fields: [expertTripPayments.bookingId],
    references: [expertTripBookings.id],
  }),
  trip: one(expertTrips, {
    fields: [expertTripPayments.tripId],
    references: [expertTrips.id],
  }),
  expert: one(expertProfiles, {
    fields: [expertTripPayments.expertId],
    references: [expertProfiles.id],
  }),
}));

export const expertTripDisputesRelations = relations(expertTripDisputes, ({ one }) => ({
  booking: one(expertTripBookings, {
    fields: [expertTripDisputes.bookingId],
    references: [expertTripBookings.id],
  }),
  trip: one(expertTrips, {
    fields: [expertTripDisputes.tripId],
    references: [expertTrips.id],
  }),
  expert: one(expertProfiles, {
    fields: [expertTripDisputes.expertId],
    references: [expertProfiles.id],
  }),
}));

// Traveler Request Orders - For agency offers payment processing
export const travelerRequestOrders = pgTable("traveler_request_orders", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  offerId: integer("offer_id").notNull(),
  providerId: integer("provider_id").notNull(),
  providerType: varchar("provider_type", { length: 50 }).default("agency"),
  travelerEmail: varchar("traveler_email", { length: 255 }).notNull(),
  grossAmount: decimal("gross_amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(),
  providerAmount: decimal("provider_amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD"),
  paymentStatus: varchar("payment_status", { length: 50 }).default("pending"),
  tripDate: date("trip_date"),
  releaseDate: date("release_date"),
  stripeSessionId: varchar("stripe_session_id", { length: 255 }),
  paidAt: timestamp("paid_at"),
  releasedAt: timestamp("released_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  requestIdx: index("idx_tro_request").on(table.requestId),
  offerIdx: index("idx_tro_offer").on(table.offerId),
  providerIdx: index("idx_tro_provider").on(table.providerId),
  statusIdx: index("idx_tro_status").on(table.paymentStatus),
}));

// Action logs table for admin tracking all user actions and errors
export const actionLogs = pgTable("action_logs", {
  id: serial("id").primaryKey(),
  action: varchar("action", { length: 100 }).notNull(), // signup, login, booking, job_post, payment, etc.
  userId: integer("user_id"),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  userType: varchar("user_type", { length: 50 }),
  status: varchar("status", { length: 50 }).notNull(), // success, failed, error
  message: text("message"),
  metadata: text("metadata"), // JSON with additional details
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  actionIdx: index("idx_logs_action").on(table.action),
  statusIdx: index("idx_logs_status").on(table.status),
  userIdx: index("idx_logs_user").on(table.userEmail),
  dateIdx: index("idx_logs_date").on(table.createdAt),
}));
