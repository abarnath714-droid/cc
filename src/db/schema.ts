import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('donor'), // 'donor' | 'ngo' | 'admin'
  organizationName: text('organization_name'),
  phone: text('phone'),
  address: text('address'),
  status: text('status').notNull().default('active'), // 'active' | 'suspended'
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const donations = pgTable('donations', {
  id: serial('id').primaryKey(),
  donorId: integer('donor_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  foodName: text('food_name').notNull(),
  category: text('category').notNull(),
  quantity: text('quantity').notNull(),
  location: text('location').notNull(),
  expiryDate: text('expiry_date').notNull(),
  description: text('description').notNull(),
  imageUrl: text('image_url'),
  status: text('status').notNull().default('Available'), // 'Available' | 'Accepted' | 'Completed'
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const donationRequests = pgTable('donation_requests', {
  id: serial('id').primaryKey(),
  donationId: integer('donation_id')
    .references(() => donations.id, { onDelete: 'cascade' })
    .notNull(),
  ngoId: integer('ngo_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  donorId: integer('donor_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  message: text('message').notNull(),
  pickupTime: text('pickup_time').notNull(),
  status: text('status').notNull().default('Pending'), // 'Pending' | 'Accepted' | 'Rejected' | 'Completed'
  deliveryStage: text('delivery_stage').notNull().default('Pending'), // 'Pending' | 'Accepted' | 'Ready for Pickup' | 'In Transit' | 'Completed' | 'Rejected'
  deliveryContact: text('delivery_contact'),
  trackingNote: text('tracking_note'),
  dispatchedAt: timestamp('dispatched_at'),
  deliveredAt: timestamp('delivered_at'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const receiverRequests = pgTable('receiver_requests', {
  id: serial('id').primaryKey(),
  ngoId: integer('ngo_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  donorId: integer('donor_id').references(() => users.id, { onDelete: 'set null' }),
  foodName: text('food_name').notNull(),
  category: text('category').notNull(),
  quantityNeeded: text('quantity_needed').notNull(),
  deliveryAddress: text('delivery_address').notNull(),
  neededByDate: text('needed_by_date').notNull(),
  urgency: text('urgency').notNull().default('Standard'), // 'Standard' | 'Urgent'
  notes: text('notes').notNull(),
  imageUrl: text('image_url'),
  status: text('status').notNull().default('Open'), // 'Open' | 'Pledged' | 'In Transit' | 'Delivered'
  deliveryContact: text('delivery_contact'),
  trackingNote: text('tracking_note'),
  pledgedAt: timestamp('pledged_at'),
  dispatchedAt: timestamp('dispatched_at'),
  deliveredAt: timestamp('delivered_at'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const contactMessages = pgTable('contact_messages', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  donations: many(donations),
  ngoRequests: many(donationRequests, { relationName: 'ngoRequests' }),
  donorRequests: many(donationRequests, { relationName: 'donorRequests' }),
  receiverRequestsAsNgo: many(receiverRequests, { relationName: 'receiverNgo' }),
  receiverRequestsAsDonor: many(receiverRequests, { relationName: 'receiverDonor' }),
}));

export const donationsRelations = relations(donations, ({ one, many }) => ({
  donor: one(users, {
    fields: [donations.donorId],
    references: [users.id],
  }),
  requests: many(donationRequests),
}));

export const donationRequestsRelations = relations(donationRequests, ({ one }) => ({
  donation: one(donations, {
    fields: [donationRequests.donationId],
    references: [donations.id],
  }),
  ngo: one(users, {
    fields: [donationRequests.ngoId],
    references: [users.id],
    relationName: 'ngoRequests',
  }),
  donor: one(users, {
    fields: [donationRequests.donorId],
    references: [users.id],
    relationName: 'donorRequests',
  }),
}));

export const receiverRequestsRelations = relations(receiverRequests, ({ one }) => ({
  ngo: one(users, {
    fields: [receiverRequests.ngoId],
    references: [users.id],
    relationName: 'receiverNgo',
  }),
  donor: one(users, {
    fields: [receiverRequests.donorId],
    references: [users.id],
    relationName: 'receiverDonor',
  }),
}));

export type UserRecord = typeof users.$inferSelect;
export type DonationRecord = typeof donations.$inferSelect;
export type DonationRequestRecord = typeof donationRequests.$inferSelect;
export type ReceiverRequestRecord = typeof receiverRequests.$inferSelect;
export type ContactMessageRecord = typeof contactMessages.$inferSelect;
