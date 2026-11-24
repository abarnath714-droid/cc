import { and, count, desc, eq, ne } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from './index.ts';
import {
  contactMessages,
  donationRequests,
  donations,
  receiverRequests,
  users,
  type UserRecord,
} from './schema.ts';

export type UserRole = 'donor' | 'ngo' | 'admin';

export interface SafeUser {
  id: number;
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  organizationName: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  isDemo: boolean;
  createdAt: Date;
}

export function toSafeUser(user: UserRecord): SafeUser {
  return {
    id: user.id,
    uid: user.uid,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    organizationName: user.organizationName,
    phone: user.phone,
    address: user.address,
    status: user.status,
    isDemo: user.isDemo,
    createdAt: user.createdAt,
  };
}

export async function getUserByUid(uid: string): Promise<SafeUser | null> {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return rows[0] ? toSafeUser(rows[0]) : null;
  } catch (error) {
    console.error('Failed to look up user by UID:', error);
    throw new Error('Unable to load user profile.', { cause: error });
  }
}

export async function getUserWithPasswordByEmail(email: string): Promise<UserRecord | null> {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to look up user by email:', error);
    throw new Error('Unable to verify account credentials.', { cause: error });
  }
}

export async function getUserByEmail(email: string): Promise<SafeUser | null> {
  const row = await getUserWithPasswordByEmail(email);
  return row ? toSafeUser(row) : null;
}

export async function hasAnyAdminUser(): Promise<boolean> {
  try {
    const rows = await db
      .select({ total: count() })
      .from(users)
      .where(eq(users.role, 'admin'));
    return Number(rows[0]?.total ?? 0) > 0;
  } catch (error) {
    console.error('Failed to check admin count:', error);
    throw new Error('Unable to check system configuration.', { cause: error });
  }
}

export async function createPasswordUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  organizationName?: string | null;
  phone?: string | null;
  address?: string | null;
}): Promise<SafeUser> {
  try {
    const uid = `local_${crypto.randomUUID()}`;
    const inserted = await db
      .insert(users)
      .values({
        uid,
        name: input.name.trim(),
        email: input.email.toLowerCase().trim(),
        passwordHash: input.passwordHash,
        role: input.role,
        organizationName: input.organizationName?.trim() || null,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        status: 'active',
        isDemo: false,
      })
      .returning();
    return toSafeUser(inserted[0]);
  } catch (error) {
    console.error('Failed to create user:', error);
    throw new Error('Unable to register user account.', { cause: error });
  }
}

export async function upsertGoogleUser(input: {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  organizationName?: string | null;
  phone?: string | null;
  address?: string | null;
}): Promise<SafeUser> {
  try {
    const normalizedEmail = input.email.toLowerCase().trim();
    const existingByUid = await db
      .select()
      .from(users)
      .where(eq(users.uid, input.uid))
      .limit(1);

    if (existingByUid[0]) {
      const updated = await db
        .update(users)
        .set({
          email: normalizedEmail,
          name: existingByUid[0].name || input.name,
        })
        .where(eq(users.id, existingByUid[0].id))
        .returning();
      return toSafeUser(updated[0]);
    }

    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingByEmail[0]) {
      const linked = await db
        .update(users)
        .set({
          uid: input.uid,
        })
        .where(eq(users.id, existingByEmail[0].id))
        .returning();
      return toSafeUser(linked[0]);
    }

    const inserted = await db
      .insert(users)
      .values({
        uid: input.uid,
        name: input.name.trim(),
        email: normalizedEmail,
        role: input.role,
        organizationName: input.organizationName?.trim() || null,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        status: 'active',
        isDemo: false,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email: normalizedEmail },
      })
      .returning();

    return toSafeUser(inserted[0]);
  } catch (error) {
    console.error('Failed to sync Google user:', error);
    throw new Error('Unable to complete Google sign-in profile.', { cause: error });
  }
}

export async function listAllUsers(): Promise<SafeUser[]> {
  try {
    const rows = await db.select().from(users).orderBy(desc(users.createdAt));
    return rows.map(toSafeUser);
  } catch (error) {
    console.error('Failed to list users:', error);
    throw new Error('Unable to load user directory.', { cause: error });
  }
}

export async function updateUserStatusAndRole(
  userId: number,
  updates: { status?: string; role?: UserRole }
): Promise<SafeUser | null> {
  try {
    const rows = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    return rows[0] ? toSafeUser(rows[0]) : null;
  } catch (error) {
    console.error('Failed to update user:', error);
    throw new Error('Unable to update user account.', { cause: error });
  }
}

export async function deleteUserById(userId: number): Promise<boolean> {
  try {
    const deleted = await db.delete(users).where(eq(users.id, userId)).returning({ id: users.id });
    return deleted.length > 0;
  } catch (error) {
    console.error('Failed to delete user:', error);
    throw new Error('Unable to delete user account.', { cause: error });
  }
}

export interface DonationWithDonor {
  id: number;
  donorId: number;
  donorName: string;
  donorOrganization: string | null;
  donorPhone: string | null;
  foodName: string;
  category: string;
  quantity: string;
  location: string;
  expiryDate: string;
  description: string;
  imageUrl: string | null;
  status: string;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
  pendingRequestCount: number;
}

export async function listDonations(filters?: {
  category?: string;
  search?: string;
  status?: string;
  donorId?: number;
}): Promise<DonationWithDonor[]> {
  try {
    const rows = await db
      .select({
        id: donations.id,
        donorId: donations.donorId,
        donorName: users.name,
        donorOrganization: users.organizationName,
        donorPhone: users.phone,
        foodName: donations.foodName,
        category: donations.category,
        quantity: donations.quantity,
        location: donations.location,
        expiryDate: donations.expiryDate,
        description: donations.description,
        imageUrl: donations.imageUrl,
        status: donations.status,
        isDemo: donations.isDemo,
        createdAt: donations.createdAt,
        updatedAt: donations.updatedAt,
      })
      .from(donations)
      .innerJoin(users, eq(donations.donorId, users.id))
      .orderBy(desc(donations.createdAt));

    const pendingCounts = await db
      .select({
        donationId: donationRequests.donationId,
        total: count(),
      })
      .from(donationRequests)
      .where(eq(donationRequests.status, 'Pending'))
      .groupBy(donationRequests.donationId);

    const pendingMap = new Map<number, number>();
    for (const item of pendingCounts) {
      pendingMap.set(item.donationId, Number(item.total));
    }

    let result: DonationWithDonor[] = rows.map((row) => ({
      ...row,
      pendingRequestCount: pendingMap.get(row.id) ?? 0,
    }));

    if (filters?.donorId !== undefined) {
      result = result.filter((d) => d.donorId === filters.donorId);
    }
    if (filters?.status && filters.status !== 'All') {
      result = result.filter((d) => d.status === filters.status);
    }
    if (filters?.category && filters.category !== 'All') {
      result = result.filter((d) => d.category === filters.category);
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      result = result.filter(
        (d) =>
          d.foodName.toLowerCase().includes(q) ||
          d.location.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          (d.donorOrganization || d.donorName).toLowerCase().includes(q)
      );
    }

    return result;
  } catch (error) {
    console.error('Failed to list donations:', error);
    throw new Error('Unable to load food donations.', { cause: error });
  }
}

export async function getDonationById(id: number): Promise<DonationWithDonor | null> {
  try {
    const rows = await db
      .select({
        id: donations.id,
        donorId: donations.donorId,
        donorName: users.name,
        donorOrganization: users.organizationName,
        donorPhone: users.phone,
        foodName: donations.foodName,
        category: donations.category,
        quantity: donations.quantity,
        location: donations.location,
        expiryDate: donations.expiryDate,
        description: donations.description,
        imageUrl: donations.imageUrl,
        status: donations.status,
        isDemo: donations.isDemo,
        createdAt: donations.createdAt,
        updatedAt: donations.updatedAt,
      })
      .from(donations)
      .innerJoin(users, eq(donations.donorId, users.id))
      .where(eq(donations.id, id))
      .limit(1);

    if (!rows[0]) {
      return null;
    }

    const pendingCounts = await db
      .select({ total: count() })
      .from(donationRequests)
      .where(and(eq(donationRequests.donationId, id), eq(donationRequests.status, 'Pending')));

    return {
      ...rows[0],
      pendingRequestCount: Number(pendingCounts[0]?.total ?? 0),
    };
  } catch (error) {
    console.error('Failed to get donation details:', error);
    throw new Error('Unable to load donation details.', { cause: error });
  }
}

export async function createDonation(input: {
  donorId: number;
  foodName: string;
  category: string;
  quantity: string;
  location: string;
  expiryDate: string;
  description: string;
  imageUrl?: string | null;
}) {
  try {
    const inserted = await db
      .insert(donations)
      .values({
        donorId: input.donorId,
        foodName: input.foodName.trim(),
        category: input.category.trim(),
        quantity: input.quantity.trim(),
        location: input.location.trim(),
        expiryDate: input.expiryDate.trim(),
        description: input.description.trim(),
        imageUrl: input.imageUrl ?? null,
        status: 'Available',
        isDemo: false,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Failed to create donation:', error);
    throw new Error('Unable to save food donation.', { cause: error });
  }
}

export async function updateDonation(
  donationId: number,
  updates: {
    foodName: string;
    category: string;
    quantity: string;
    location: string;
    expiryDate: string;
    description: string;
    imageUrl?: string | null;
  }
) {
  try {
    const updated = await db
      .update(donations)
      .set({
        foodName: updates.foodName.trim(),
        category: updates.category.trim(),
        quantity: updates.quantity.trim(),
        location: updates.location.trim(),
        expiryDate: updates.expiryDate.trim(),
        description: updates.description.trim(),
        ...(updates.imageUrl !== undefined ? { imageUrl: updates.imageUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(donations.id, donationId))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Failed to update donation:', error);
    throw new Error('Unable to update food donation.', { cause: error });
  }
}

export async function deleteDonation(donationId: number): Promise<boolean> {
  try {
    const deleted = await db
      .delete(donations)
      .where(eq(donations.id, donationId))
      .returning({ id: donations.id });
    return deleted.length > 0;
  } catch (error) {
    console.error('Failed to delete donation:', error);
    throw new Error('Unable to delete food donation.', { cause: error });
  }
}

export interface RequestDetail {
  id: number;
  donationId: number;
  ngoId: number;
  donorId: number;
  message: string;
  pickupTime: string;
  status: string;
  deliveryStage: string;
  deliveryContact: string | null;
  trackingNote: string | null;
  dispatchedAt: Date | null;
  deliveredAt: Date | null;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
  foodName: string;
  category: string;
  quantity: string;
  location: string;
  expiryDate: string;
  donationStatus: string;
  ngoName: string;
  ngoOrganization: string | null;
  ngoEmail: string;
  ngoPhone: string | null;
  donorName: string;
  donorOrganization: string | null;
  donorPhone: string | null;
}

export async function listRequests(filters?: {
  donorId?: number;
  ngoId?: number;
  donationId?: number;
}): Promise<RequestDetail[]> {
  try {
    const rows = await db
      .select({
        id: donationRequests.id,
        donationId: donationRequests.donationId,
        ngoId: donationRequests.ngoId,
        donorId: donationRequests.donorId,
        message: donationRequests.message,
        pickupTime: donationRequests.pickupTime,
        status: donationRequests.status,
        deliveryStage: donationRequests.deliveryStage,
        deliveryContact: donationRequests.deliveryContact,
        trackingNote: donationRequests.trackingNote,
        dispatchedAt: donationRequests.dispatchedAt,
        deliveredAt: donationRequests.deliveredAt,
        isDemo: donationRequests.isDemo,
        createdAt: donationRequests.createdAt,
        updatedAt: donationRequests.updatedAt,
        foodName: donations.foodName,
        category: donations.category,
        quantity: donations.quantity,
        location: donations.location,
        expiryDate: donations.expiryDate,
        donationStatus: donations.status,
      })
      .from(donationRequests)
      .innerJoin(donations, eq(donationRequests.donationId, donations.id))
      .orderBy(desc(donationRequests.createdAt));

    const allUsers = await db.select().from(users);
    const userMap = new Map<number, UserRecord>();
    for (const u of allUsers) {
      userMap.set(u.id, u);
    }

    let result: RequestDetail[] = rows.map((r) => {
      const ngo = userMap.get(r.ngoId);
      const donor = userMap.get(r.donorId);
      return {
        ...r,
        ngoName: ngo?.name || 'NGO Partner',
        ngoOrganization: ngo?.organizationName || null,
        ngoEmail: ngo?.email || '',
        ngoPhone: ngo?.phone || null,
        donorName: donor?.name || 'Food Donor',
        donorOrganization: donor?.organizationName || null,
        donorPhone: donor?.phone || null,
      };
    });

    if (filters?.donorId !== undefined) {
      result = result.filter((r) => r.donorId === filters.donorId);
    }
    if (filters?.ngoId !== undefined) {
      result = result.filter((r) => r.ngoId === filters.ngoId);
    }
    if (filters?.donationId !== undefined) {
      result = result.filter((r) => r.donationId === filters.donationId);
    }

    return result;
  } catch (error) {
    console.error('Failed to list donation requests:', error);
    throw new Error('Unable to load donation requests.', { cause: error });
  }
}

export async function getRequestById(requestId: number) {
  try {
    const rows = await db
      .select()
      .from(donationRequests)
      .where(eq(donationRequests.id, requestId))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to get donation request:', error);
    throw new Error('Unable to load request.', { cause: error });
  }
}

export async function hasExistingActiveRequest(donationId: number, ngoId: number): Promise<boolean> {
  try {
    const rows = await db
      .select({ id: donationRequests.id })
      .from(donationRequests)
      .where(
        and(
          eq(donationRequests.donationId, donationId),
          eq(donationRequests.ngoId, ngoId),
          ne(donationRequests.status, 'Rejected')
        )
      )
      .limit(1);
    return rows.length > 0;
  } catch (error) {
    console.error('Failed to check existing NGO request:', error);
    throw new Error('Unable to verify request eligibility.', { cause: error });
  }
}

export async function createDonationRequest(input: {
  donationId: number;
  ngoId: number;
  donorId: number;
  message: string;
  pickupTime: string;
}) {
  try {
    const inserted = await db
      .insert(donationRequests)
      .values({
        donationId: input.donationId,
        ngoId: input.ngoId,
        donorId: input.donorId,
        message: input.message.trim(),
        pickupTime: input.pickupTime.trim(),
        status: 'Pending',
        isDemo: false,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Failed to create donation request:', error);
    throw new Error('Unable to submit food request.', { cause: error });
  }
}

export async function respondToRequest(
  requestId: number,
  decision: 'Accepted' | 'Rejected'
) {
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(donationRequests)
        .where(eq(donationRequests.id, requestId))
        .limit(1);

      const reqRow = existing[0];
      if (!reqRow) {
        return null;
      }

      if (decision === 'Accepted') {
        const updatedReq = await tx
          .update(donationRequests)
          .set({
            status: 'Accepted',
            deliveryStage: 'Accepted',
            updatedAt: new Date(),
          })
          .where(eq(donationRequests.id, requestId))
          .returning();

        await tx
          .update(donationRequests)
          .set({
            status: 'Rejected',
            deliveryStage: 'Rejected',
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(donationRequests.donationId, reqRow.donationId),
              ne(donationRequests.id, requestId),
              eq(donationRequests.status, 'Pending')
            )
          );

        await tx
          .update(donations)
          .set({ status: 'Accepted', updatedAt: new Date() })
          .where(eq(donations.id, reqRow.donationId));

        return updatedReq[0];
      }

      const rejected = await tx
        .update(donationRequests)
        .set({
          status: 'Rejected',
          deliveryStage: 'Rejected',
          updatedAt: new Date(),
        })
        .where(eq(donationRequests.id, requestId))
        .returning();

      return rejected[0];
    });
  } catch (error) {
    console.error('Failed to respond to donation request:', error);
    throw new Error('Unable to update request decision.', { cause: error });
  }
}

export async function updateDonationDeliveryStage(
  requestId: number,
  stage: 'Ready for Pickup' | 'In Transit' | 'Completed',
  deliveryContact?: string | null,
  trackingNote?: string | null
) {
  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(donationRequests)
        .where(eq(donationRequests.id, requestId))
        .limit(1);

      const reqRow = existing[0];
      if (!reqRow) return null;

      const now = new Date();
      const isCompleted = stage === 'Completed';
      const isInTransit = stage === 'In Transit';

      const updatedReq = await tx
        .update(donationRequests)
        .set({
          deliveryStage: stage,
          status: isCompleted ? 'Completed' : 'Accepted',
          deliveryContact:
            deliveryContact !== undefined
              ? deliveryContact?.trim() || null
              : reqRow.deliveryContact,
          trackingNote:
            trackingNote !== undefined ? trackingNote?.trim() || null : reqRow.trackingNote,
          dispatchedAt: isInTransit && !reqRow.dispatchedAt ? now : reqRow.dispatchedAt,
          deliveredAt: isCompleted ? now : reqRow.deliveredAt,
          updatedAt: now,
        })
        .where(eq(donationRequests.id, requestId))
        .returning();

      if (isCompleted) {
        await tx
          .update(donations)
          .set({ status: 'Completed', updatedAt: now })
          .where(eq(donations.id, reqRow.donationId));
      }

      return updatedReq[0];
    });
  } catch (error) {
    console.error('Failed to update delivery stage:', error);
    throw new Error('Unable to update delivery tracking stage.', { cause: error });
  }
}

export async function completeDonationRequest(requestId: number) {
  return updateDonationDeliveryStage(requestId, 'Completed');
}

export interface ReceiverRequestDetail {
  id: number;
  ngoId: number;
  donorId: number | null;
  foodName: string;
  category: string;
  quantityNeeded: string;
  deliveryAddress: string;
  neededByDate: string;
  urgency: string;
  notes: string;
  imageUrl: string | null;
  status: string;
  deliveryContact: string | null;
  trackingNote: string | null;
  pledgedAt: Date | null;
  dispatchedAt: Date | null;
  deliveredAt: Date | null;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
  ngoName: string;
  ngoOrganization: string | null;
  ngoEmail: string;
  ngoPhone: string | null;
  donorName: string | null;
  donorOrganization: string | null;
  donorPhone: string | null;
}

export async function listReceiverRequests(filters?: {
  ngoId?: number;
  donorId?: number;
  status?: string;
}): Promise<ReceiverRequestDetail[]> {
  try {
    const rows = await db
      .select()
      .from(receiverRequests)
      .orderBy(desc(receiverRequests.createdAt));

    const allUsers = await db.select().from(users);
    const userMap = new Map<number, UserRecord>();
    for (const u of allUsers) {
      userMap.set(u.id, u);
    }

    let result: ReceiverRequestDetail[] = rows.map((r) => {
      const ngo = userMap.get(r.ngoId);
      const donor = r.donorId ? userMap.get(r.donorId) : undefined;
      return {
        ...r,
        ngoName: ngo?.name || 'Receiver NGO',
        ngoOrganization: ngo?.organizationName || null,
        ngoEmail: ngo?.email || '',
        ngoPhone: ngo?.phone || null,
        donorName: donor?.name || null,
        donorOrganization: donor?.organizationName || null,
        donorPhone: donor?.phone || null,
      };
    });

    if (filters?.ngoId !== undefined) {
      result = result.filter((r) => r.ngoId === filters.ngoId);
    }
    if (filters?.donorId !== undefined) {
      result = result.filter((r) => r.donorId === filters.donorId);
    }
    if (filters?.status && filters.status !== 'All') {
      result = result.filter((r) => r.status === filters.status);
    }

    return result;
  } catch (error) {
    console.error('Failed to list receiver food requests:', error);
    throw new Error('Unable to load receiver food requests.', { cause: error });
  }
}

export async function getReceiverRequestById(id: number) {
  try {
    const rows = await db
      .select()
      .from(receiverRequests)
      .where(eq(receiverRequests.id, id))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to load receiver request:', error);
    throw new Error('Unable to load receiver food request.', { cause: error });
  }
}

export async function createReceiverRequest(input: {
  ngoId: number;
  foodName: string;
  category: string;
  quantityNeeded: string;
  deliveryAddress: string;
  neededByDate: string;
  urgency: 'Standard' | 'Urgent';
  notes: string;
  imageUrl?: string | null;
}) {
  try {
    const inserted = await db
      .insert(receiverRequests)
      .values({
        ngoId: input.ngoId,
        foodName: input.foodName.trim(),
        category: input.category.trim(),
        quantityNeeded: input.quantityNeeded.trim(),
        deliveryAddress: input.deliveryAddress.trim(),
        neededByDate: input.neededByDate.trim(),
        urgency: input.urgency,
        notes: input.notes.trim(),
        imageUrl: input.imageUrl ?? null,
        status: 'Open',
        isDemo: false,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Failed to create receiver food request:', error);
    throw new Error('Unable to save your food request.', { cause: error });
  }
}

export async function updateReceiverRequest(
  id: number,
  updates: {
    foodName: string;
    category: string;
    quantityNeeded: string;
    deliveryAddress: string;
    neededByDate: string;
    urgency: 'Standard' | 'Urgent';
    notes: string;
    imageUrl?: string | null;
  }
) {
  try {
    const updated = await db
      .update(receiverRequests)
      .set({
        foodName: updates.foodName.trim(),
        category: updates.category.trim(),
        quantityNeeded: updates.quantityNeeded.trim(),
        deliveryAddress: updates.deliveryAddress.trim(),
        neededByDate: updates.neededByDate.trim(),
        urgency: updates.urgency,
        notes: updates.notes.trim(),
        ...(updates.imageUrl !== undefined ? { imageUrl: updates.imageUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(receiverRequests.id, id))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Failed to update receiver food request:', error);
    throw new Error('Unable to update food request.', { cause: error });
  }
}

export async function deleteReceiverRequest(id: number): Promise<boolean> {
  try {
    const deleted = await db
      .delete(receiverRequests)
      .where(eq(receiverRequests.id, id))
      .returning({ id: receiverRequests.id });
    return deleted.length > 0;
  } catch (error) {
    console.error('Failed to delete receiver food request:', error);
    throw new Error('Unable to delete food request.', { cause: error });
  }
}

export async function pledgeReceiverRequest(
  id: number,
  donorId: number,
  deliveryContact?: string | null,
  trackingNote?: string | null
) {
  try {
    const now = new Date();
    const updated = await db
      .update(receiverRequests)
      .set({
        donorId,
        status: 'Pledged',
        deliveryContact: deliveryContact?.trim() || null,
        trackingNote: trackingNote?.trim() || null,
        pledgedAt: now,
        updatedAt: now,
      })
      .where(eq(receiverRequests.id, id))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Failed to pledge receiver food request:', error);
    throw new Error('Unable to commit fulfillment for this request.', { cause: error });
  }
}

export async function updateReceiverDeliveryStatus(
  id: number,
  nextStatus: 'In Transit' | 'Delivered',
  deliveryContact?: string | null,
  trackingNote?: string | null
) {
  try {
    const existing = await getReceiverRequestById(id);
    if (!existing) return null;

    const now = new Date();
    const updated = await db
      .update(receiverRequests)
      .set({
        status: nextStatus,
        deliveryContact:
          deliveryContact !== undefined
            ? deliveryContact?.trim() || null
            : existing.deliveryContact,
        trackingNote:
          trackingNote !== undefined ? trackingNote?.trim() || null : existing.trackingNote,
        dispatchedAt:
          nextStatus === 'In Transit' && !existing.dispatchedAt ? now : existing.dispatchedAt,
        deliveredAt: nextStatus === 'Delivered' ? now : existing.deliveredAt,
        updatedAt: now,
      })
      .where(eq(receiverRequests.id, id))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Failed to update receiver delivery status:', error);
    throw new Error('Unable to update delivery tracking status.', { cause: error });
  }
}

export async function getPlatformStats() {
  try {
    const [userCounts, donationCounts, requestCounts, receiverCounts] = await Promise.all([
      db.select({ role: users.role, total: count() }).from(users).groupBy(users.role),
      db.select({ status: donations.status, total: count() }).from(donations).groupBy(donations.status),
      db
        .select({ status: donationRequests.status, total: count() })
        .from(donationRequests)
        .groupBy(donationRequests.status),
      db
        .select({ status: receiverRequests.status, total: count() })
        .from(receiverRequests)
        .groupBy(receiverRequests.status),
    ]);

    let totalUsers = 0;
    let totalDonors = 0;
    let totalNgos = 0;
    for (const row of userCounts) {
      const n = Number(row.total);
      totalUsers += n;
      if (row.role === 'donor') totalDonors = n;
      if (row.role === 'ngo') totalNgos = n;
    }

    let totalDonations = 0;
    let availableDonations = 0;
    let acceptedDonations = 0;
    let completedDonations = 0;
    for (const row of donationCounts) {
      const n = Number(row.total);
      totalDonations += n;
      if (row.status === 'Available') availableDonations = n;
      if (row.status === 'Accepted') acceptedDonations = n;
      if (row.status === 'Completed') completedDonations = n;
    }

    let pendingRequests = 0;
    let totalRequests = 0;
    for (const row of requestCounts) {
      const n = Number(row.total);
      totalRequests += n;
      if (row.status === 'Pending') pendingRequests = n;
    }

    let openReceiverRequests = 0;
    let totalReceiverRequests = 0;
    for (const row of receiverCounts) {
      const n = Number(row.total);
      totalReceiverRequests += n;
      if (row.status === 'Open') openReceiverRequests = n;
    }

    return {
      totalUsers,
      totalDonors,
      totalNgos,
      totalDonations,
      availableDonations,
      acceptedDonations,
      completedDonations,
      pendingRequests,
      totalRequests,
      openReceiverRequests,
      totalReceiverRequests,
    };
  } catch (error) {
    console.error('Failed to compute platform stats:', error);
    throw new Error('Unable to load platform statistics.', { cause: error });
  }
}

export async function saveContactMessage(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  try {
    const inserted = await db
      .insert(contactMessages)
      .values({
        name: input.name.trim(),
        email: input.email.trim(),
        subject: input.subject.trim(),
        message: input.message.trim(),
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Failed to save contact message:', error);
    throw new Error('Unable to send your message right now.', { cause: error });
  }
}

export async function listContactMessages() {
  try {
    return await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
  } catch (error) {
    console.error('Failed to load contact messages:', error);
    throw new Error('Unable to load contact inquiries.', { cause: error });
  }
}

export async function seedDemoData(force = false): Promise<{ seeded: boolean }> {
  try {
    if (!force) {
      const existingDonations = await db.select({ total: count() }).from(donations);
      if (Number(existingDonations[0]?.total ?? 0) > 0) {
        return { seeded: false };
      }
    }

    const existingDemoUsers = await db
      .select()
      .from(users)
      .where(eq(users.isDemo, true));

    if (existingDemoUsers.length > 0 && !force) {
      return { seeded: false };
    }

    await db.transaction(async (tx) => {
      if (force) {
        await tx.delete(receiverRequests).where(eq(receiverRequests.isDemo, true));
        await tx.delete(donationRequests).where(eq(donationRequests.isDemo, true));
        await tx.delete(donations).where(eq(donations.isDemo, true));
        await tx.delete(users).where(eq(users.isDemo, true));
      }

      const [donor1] = await tx
        .insert(users)
        .values({
          uid: `demo_donor_1_${Date.now()}`,
          name: 'Elena Rostova (Demo Donor)',
          email: 'demo.bakery@harvestbridge.example',
          passwordHash: null,
          role: 'donor',
          organizationName: 'Greenfield Artisan Bakery',
          phone: '+1 (555) 214-8890',
          address: '412 Elmwood Ave, Downtown',
          status: 'active',
          isDemo: true,
        })
        .onConflictDoNothing()
        .returning();

      const [donor2] = await tx
        .insert(users)
        .values({
          uid: `demo_donor_2_${Date.now()}`,
          name: 'Marcus Chen (Demo Donor)',
          email: 'demo.bistro@harvestbridge.example',
          passwordHash: null,
          role: 'donor',
          organizationName: 'Cedar Table Community Kitchen',
          phone: '+1 (555) 390-1420',
          address: '89 Oakridge Blvd, Midtown',
          status: 'active',
          isDemo: true,
        })
        .onConflictDoNothing()
        .returning();

      const [ngo1] = await tx
        .insert(users)
        .values({
          uid: `demo_ngo_1_${Date.now()}`,
          name: 'Priya Nair (Demo NGO)',
          email: 'demo.shelter@harvestbridge.example',
          passwordHash: null,
          role: 'ngo',
          organizationName: 'Hope Harbor Food Bank',
          phone: '+1 (555) 748-2231',
          address: '155 Riverwalk Way, Eastside',
          status: 'active',
          isDemo: true,
        })
        .onConflictDoNothing()
        .returning();

      if (!donor1 || !donor2 || !ngo1) {
        return;
      }

      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const inThreeDays = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      const inFiveDays = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

      const insertedDonations = await tx
        .insert(donations)
        .values([
          {
            donorId: donor2.id,
            foodName: 'Herb-Roasted Chicken & Vegetable Meal Boxes',
            category: 'Cooked Meals',
            quantity: '40 sealed meal boxes',
            location: '89 Oakridge Blvd, Midtown (Loading Bay B)',
            expiryDate: tomorrow,
            description:
              'Freshly prepared lunch surplus packed in food-grade kraft containers, kept chilled at 3°C. Ready for same-day NGO distribution.',
            status: 'Available',
            isDemo: true,
          },
          {
            donorId: donor1.id,
            foodName: 'Sourdough Boules & Wholegrain Rolls',
            category: 'Bakery & Bread',
            quantity: '32 loaves & 48 rolls',
            location: '412 Elmwood Ave, Downtown',
            expiryDate: tomorrow,
            description:
              'Day-end artisan bakery surplus baked early this morning. Individually bagged and boxed for clean transport.',
            status: 'Available',
            isDemo: true,
          },
          {
            donorId: donor2.id,
            foodName: 'Organic Leafy Greens, Tomatoes & Root Crates',
            category: 'Fresh Produce',
            quantity: '35 kg across 5 crates',
            location: '89 Oakridge Blvd, Midtown',
            expiryDate: inThreeDays,
            description:
              'Unblemished seasonal produce from our morning farm delivery: kale, spinach, heirloom tomatoes, apples, and carrots.',
            status: 'Available',
            isDemo: true,
          },
          {
            donorId: donor1.id,
            foodName: 'Dry Lentils, Rice & Canned Tomato Pantry Kits',
            category: 'Packaged & Dry Goods',
            quantity: '60 family pantry packs',
            location: '412 Elmwood Ave, Downtown',
            expiryDate: inFiveDays,
            description:
              'Shelf-stable dry staples packed in sturdy cartons with clear nutrition and best-before labels.',
            status: 'Accepted',
            isDemo: true,
          },
          {
            donorId: donor2.id,
            foodName: 'Pasteurized Milk Cartons & Yogurt Cups',
            category: 'Dairy & Beverages',
            quantity: '48 cartons (1L each)',
            location: '89 Oakridge Blvd, Midtown',
            expiryDate: inThreeDays,
            description:
              'Refrigerated dairy surplus delivered to a local shelter kitchen and verified as collected.',
            status: 'Completed',
            isDemo: true,
          },
        ])
        .returning();

      const acceptedDonation = insertedDonations.find((d) => d.status === 'Accepted');
      const completedDonation = insertedDonations.find((d) => d.status === 'Completed');
      const availableDonation = insertedDonations[0];

      const requestValues = [];
      if (availableDonation) {
        requestValues.push({
          donationId: availableDonation.id,
          ngoId: ngo1.id,
          donorId: availableDonation.donorId,
          message: 'We have a refrigerated van near Midtown at 4:00 PM for our evening family shelter service.',
          pickupTime: 'Today, 4:00 PM - 5:00 PM',
          status: 'Pending',
          deliveryStage: 'Pending',
          isDemo: true,
        });
      }
      if (acceptedDonation) {
        requestValues.push({
          donationId: acceptedDonation.id,
          ngoId: ngo1.id,
          donorId: acceptedDonation.donorId,
          message: 'Confirmed pickup for weekend family pantry distribution.',
          pickupTime: 'Tomorrow, 10:30 AM',
          status: 'Accepted',
          deliveryStage: 'In Transit',
          deliveryContact: 'Samir Patel · Van #4 (+1 555-820-1194)',
          trackingNote: 'Loaded at Downtown bakery bay; en route to Eastside shelter.',
          dispatchedAt: new Date(Date.now() - 1800000),
          isDemo: true,
        });
      }
      if (completedDonation) {
        requestValues.push({
          donationId: completedDonation.id,
          ngoId: ngo1.id,
          donorId: completedDonation.donorId,
          message: 'Collected in insulated coolers for Eastside Community Breakfast.',
          pickupTime: 'Yesterday, 9:00 AM',
          status: 'Completed',
          deliveryStage: 'Completed',
          deliveryContact: 'Hope Harbor Logistics (+1 555-748-2231)',
          trackingNote: 'Verified cold-chain delivery completed at shelter pantry.',
          dispatchedAt: new Date(Date.now() - 86400000),
          deliveredAt: new Date(Date.now() - 82800000),
          isDemo: true,
        });
      }

      if (requestValues.length > 0) {
        await tx.insert(donationRequests).values(requestValues);
      }

      await tx.insert(receiverRequests).values([
        {
          ngoId: ngo1.id,
          donorId: null,
          foodName: 'Warm Vegetarian Dinner Meals for 75 Residents',
          category: 'Cooked Meals',
          quantityNeeded: '75 individual meal portions',
          deliveryAddress: '155 Riverwalk Way, Eastside Shelter Kitchen',
          neededByDate: tomorrow,
          urgency: 'Urgent',
          notes: 'Seeking cooked vegetarian trays or boxed dinners for our evening community shelter meal service.',
          status: 'Open',
          isDemo: true,
        },
        {
          ngoId: ngo1.id,
          donorId: donor2.id,
          foodName: 'Dry Rice, Beans & Cooking Oil Staples',
          category: 'Packaged & Dry Goods',
          quantityNeeded: '40 kg rice & 20 kg lentils',
          deliveryAddress: '155 Riverwalk Way, Eastside Pantry',
          neededByDate: inThreeDays,
          urgency: 'Standard',
          notes: 'For weekly family food parcel assembly.',
          status: 'In Transit',
          deliveryContact: 'Cedar Table Dispatch (+1 555-390-1420)',
          trackingNote: 'Packed into 6 sealed dry totes; driver departing Midtown kitchen.',
          pledgedAt: new Date(Date.now() - 7200000),
          dispatchedAt: new Date(Date.now() - 1200000),
          isDemo: true,
        },
      ]);
    });

    return { seeded: true };
  } catch (error) {
    console.error('Failed to seed demo data:', error);
    throw new Error('Unable to load demo listings.', { cause: error });
  }
}

export async function ensureDemoReceiverSeeded(): Promise<void> {
  try {
    const existing = await db.select({ total: count() }).from(receiverRequests);
    if (Number(existing[0]?.total ?? 0) > 0) {
      return;
    }
    const demoNgo = await db
      .select()
      .from(users)
      .where(and(eq(users.isDemo, true), eq(users.role, 'ngo')))
      .limit(1);
    const demoDonor = await db
      .select()
      .from(users)
      .where(and(eq(users.isDemo, true), eq(users.role, 'donor')))
      .limit(1);

    if (!demoNgo[0]) return;

    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const inThreeDays = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

    await db.insert(receiverRequests).values([
      {
        ngoId: demoNgo[0].id,
        donorId: null,
        foodName: 'Warm Vegetarian Dinner Meals for 75 Residents',
        category: 'Cooked Meals',
        quantityNeeded: '75 individual meal portions',
        deliveryAddress: '155 Riverwalk Way, Eastside Shelter Kitchen',
        neededByDate: tomorrow,
        urgency: 'Urgent',
        notes:
          'Seeking cooked vegetarian trays or boxed dinners for our evening community shelter meal service.',
        status: 'Open',
        isDemo: true,
      },
      {
        ngoId: demoNgo[0].id,
        donorId: demoDonor[0]?.id ?? null,
        foodName: 'Dry Rice, Beans & Cooking Oil Staples',
        category: 'Packaged & Dry Goods',
        quantityNeeded: '40 kg rice & 20 kg lentils',
        deliveryAddress: '155 Riverwalk Way, Eastside Pantry',
        neededByDate: inThreeDays,
        urgency: 'Standard',
        notes: 'For weekly family food parcel assembly.',
        status: demoDonor[0] ? 'In Transit' : 'Open',
        deliveryContact: demoDonor[0] ? 'Cedar Table Dispatch (+1 555-390-1420)' : null,
        trackingNote: demoDonor[0]
          ? 'Packed into 6 sealed dry totes; driver departing Midtown kitchen.'
          : null,
        pledgedAt: demoDonor[0] ? new Date(Date.now() - 7200000) : null,
        dispatchedAt: demoDonor[0] ? new Date(Date.now() - 1200000) : null,
        isDemo: true,
      },
    ]);
  } catch (error) {
    console.error('Failed to ensure demo receiver requests:', error);
  }
}

export async function clearDemoData(): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await tx.delete(receiverRequests).where(eq(receiverRequests.isDemo, true));
      await tx.delete(donationRequests).where(eq(donationRequests.isDemo, true));
      await tx.delete(donations).where(eq(donations.isDemo, true));
      await tx.delete(users).where(eq(users.isDemo, true));
    });
  } catch (error) {
    console.error('Failed to clear demo data:', error);
    throw new Error('Unable to remove demo records.', { cause: error });
  }
}
