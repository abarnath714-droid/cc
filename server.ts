import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { hashPassword, signSessionToken, verifyPassword } from './src/lib/auth-crypto.ts';
import {
  clearDemoData,
  completeDonationRequest,
  createDonation,
  createDonationRequest,
  createPasswordUser,
  createReceiverRequest,
  deleteDonation,
  deleteReceiverRequest,
  deleteUserById,
  ensureDemoReceiverSeeded,
  getDonationById,
  getPlatformStats,
  getReceiverRequestById,
  getRequestById,
  getUserByEmail,
  getUserWithPasswordByEmail,
  hasAnyAdminUser,
  hasExistingActiveRequest,
  listAllUsers,
  listContactMessages,
  listDonations,
  listReceiverRequests,
  listRequests,
  pledgeReceiverRequest,
  respondToRequest,
  saveContactMessage,
  seedDemoData,
  updateDonation,
  updateDonationDeliveryStage,
  updateReceiverDeliveryStatus,
  updateReceiverRequest,
  updateUserStatusAndRole,
  upsertGoogleUser,
  type UserRole,
} from './src/db/repository.ts';
import {
  optionalAuth,
  requireAuth,
  requireFirebaseToken,
  requireRole,
  type AuthRequest,
} from './src/middleware/auth.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_CATEGORIES = [
  'Cooked Meals',
  'Fresh Produce',
  'Bakery & Bread',
  'Packaged & Dry Goods',
  'Dairy & Beverages',
] as const;

const OWNER_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'nathabar2@gmail.com').toLowerCase().trim();

const sseClients = new Set<Response>();
let demoSeedAttempted = false;

function broadcastUpdate(eventType: string, payload: Record<string, unknown> = {}) {
  const message = `event: update\ndata: ${JSON.stringify({ type: eventType, ...payload, ts: Date.now() })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

async function ensureDemoSeededOnce() {
  if (demoSeedAttempted) return;
  demoSeedAttempted = true;
  try {
    await seedDemoData(false);
    await ensureDemoReceiverSeeded();
  } catch (err) {
    demoSeedAttempted = false;
    console.error('Lazy demo seed skipped:', err);
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parsePositiveId(raw: string): number | null {
  const num = Number(raw);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function constantTimeMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function sanitizeImageUrl(
  raw: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Invalid food photo format.' };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  if (/^\/src\/assets\/images\/[a-zA-Z0-9_.-]+\.(jpg|jpeg|png|webp)$/.test(trimmed)) {
    return { ok: true, value: trimmed };
  }
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    if (trimmed.length > 950_000) {
      return { ok: false, error: 'Uploaded food photo is too large. Please select a smaller file.' };
    }
    return { ok: true, value: trimmed };
  }
  return {
    ok: false,
    error: 'Please choose a gallery food photo or upload a JPEG, PNG, or WebP image.',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Real-time SSE stream for live dashboard updates
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    sseClients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // Public health & stats
  app.get('/api/stats', async (_req, res) => {
    try {
      await ensureDemoSeededOnce();
      const stats = await getPlatformStats();
      res.json(stats);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unable to load statistics.';
      res.status(500).json({ error: msg });
    }
  });

  // Auth status & admin claim
  app.get('/api/auth/admin-status', async (_req, res) => {
    try {
      const hasAdmin = await hasAnyAdminUser();
      const passcodeConfigured = Boolean(process.env.ADMIN_PASSCODE?.trim());
      res.json({ hasAdmin, passcodeConfigured });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unable to check admin status.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/auth/claim-admin', async (req, res) => {
    try {
      const { name, email, password, passcode } = req.body ?? {};
      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Please provide a valid full name.' });
      }
      if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }

      const configuredPasscode = process.env.ADMIN_PASSCODE?.trim();
      if (configuredPasscode) {
        if (typeof passcode !== 'string' || !constantTimeMatch(passcode.trim(), configuredPasscode)) {
          return res.status(403).json({ error: 'Invalid administrator passcode.' });
        }
      } else {
        const hasAdmin = await hasAnyAdminUser();
        if (hasAdmin) {
          return res.status(403).json({
            error: 'An administrator account already exists. Please sign in with your admin credentials.',
          });
        }
      }

      const existing = await getUserByEmail(email.trim());
      if (existing) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }

      const created = await createPasswordUser({
        name: name.trim(),
        email: email.trim(),
        passwordHash: hashPassword(password),
        role: 'admin',
        organizationName: 'HarvestBridge Administration',
      });

      const token = signSessionToken(created.uid);
      broadcastUpdate('users_changed');
      res.status(201).json({ token, user: created });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unable to claim admin account.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, password, role, organizationName, phone, address, adminPasscode } =
        req.body ?? {};

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Full name is required (minimum 2 characters).' });
      }
      if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }

      let resolvedRole: UserRole = 'donor';
      if (role === 'ngo') {
        resolvedRole = 'ngo';
      } else if (role === 'donor') {
        resolvedRole = 'donor';
      } else if (role === 'admin') {
        const configuredPasscode = process.env.ADMIN_PASSCODE?.trim();
        if (!configuredPasscode || typeof adminPasscode !== 'string' || !constantTimeMatch(adminPasscode.trim(), configuredPasscode)) {
          return res.status(403).json({
            error: 'Admin registration requires a valid administrator passcode.',
          });
        }
        resolvedRole = 'admin';
      } else {
        return res.status(400).json({ error: 'Please select a valid role (Donor or NGO).' });
      }

      if (!organizationName || typeof organizationName !== 'string' || organizationName.trim().length < 2) {
        return res.status(400).json({
          error:
            resolvedRole === 'ngo'
              ? 'NGO / Organization name is required.'
              : 'Donor / Restaurant / Organization name is required.',
        });
      }

      const existing = await getUserByEmail(email.trim());
      if (existing) {
        return res.status(409).json({ error: 'An account with this email address already exists.' });
      }

      const user = await createPasswordUser({
        name: name.trim(),
        email: email.trim(),
        passwordHash: hashPassword(password),
        role: resolvedRole,
        organizationName: organizationName.trim(),
        phone: typeof phone === 'string' ? phone.trim() : null,
        address: typeof address === 'string' ? address.trim() : null,
      });

      const token = signSessionToken(user.uid);
      broadcastUpdate('users_changed');
      res.status(201).json({ token, user });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Registration failed.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body ?? {};
      if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const userRecord = await getUserWithPasswordByEmail(email.trim());
      if (!userRecord || !verifyPassword(password, userRecord.passwordHash)) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      if (userRecord.status !== 'active') {
        return res.status(403).json({
          error: 'Your account is currently suspended. Contact an administrator for help.',
        });
      }

      const safeUser = await getUserByEmail(userRecord.email);
      const token = signSessionToken(userRecord.uid);
      res.json({ token, user: safeUser });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unable to log in.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/auth/google-sync', requireFirebaseToken, async (req: AuthRequest, res) => {
    try {
      const claims = req.firebaseClaims!;
      const existingByEmail = await getUserByEmail(claims.email);
      const { role, organizationName, phone, address, name } = req.body ?? {};

      if (existingByEmail) {
        if (existingByEmail.status !== 'active') {
          return res.status(403).json({
            error: 'Your account is currently suspended. Contact an administrator.',
          });
        }
        const synced = await upsertGoogleUser({
          uid: claims.uid,
          email: claims.email,
          name: existingByEmail.name,
          role: existingByEmail.role,
        });
        return res.json({ user: synced });
      }

      const isOwnerAdmin = claims.email === OWNER_ADMIN_EMAIL;
      if (!isOwnerAdmin && role !== 'donor' && role !== 'ngo') {
        return res.status(409).json({
          needsProfile: true,
          email: claims.email,
          name: claims.name || claims.email.split('@')[0],
          error: 'Please choose your role (Donor or NGO) to complete registration.',
        });
      }

      const resolvedRole: UserRole = isOwnerAdmin ? 'admin' : role;
      const resolvedName =
        typeof name === 'string' && name.trim().length >= 2
          ? name.trim()
          : claims.name || claims.email.split('@')[0];

      const created = await upsertGoogleUser({
        uid: claims.uid,
        email: claims.email,
        name: resolvedName,
        role: resolvedRole,
        organizationName:
          typeof organizationName === 'string' && organizationName.trim()
            ? organizationName.trim()
            : isOwnerAdmin
              ? 'HarvestBridge Administration'
              : resolvedName,
        phone: typeof phone === 'string' ? phone.trim() : null,
        address: typeof address === 'string' ? address.trim() : null,
      });

      broadcastUpdate('users_changed');
      res.status(201).json({ user: created });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Google sign-in sync failed.';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
    res.json({ user: req.user });
  });

  // Donations endpoints
  app.get('/api/donations', optionalAuth, async (req: AuthRequest, res) => {
    try {
      await ensureDemoSeededOnce();
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const mine = req.query.mine === 'true';

      if (mine) {
        if (!req.user) {
          return res.status(401).json({ error: 'Please sign in to view your donations.' });
        }
        const items = await listDonations({
          donorId: req.user.id,
          category,
          search,
          status,
        });
        return res.json({ donations: items });
      }

      const items = await listDonations({ category, search, status });
      res.json({ donations: items });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load donations.';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/donations/:id', optionalAuth, async (req: AuthRequest, res) => {
    try {
      await ensureDemoSeededOnce();
      const id = parsePositiveId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'Invalid donation ID.' });
      }
      const donation = await getDonationById(id);
      if (!donation) {
        return res.status(404).json({ error: 'Donation listing not found.' });
      }

      let userRequest = null;
      let requests: Awaited<ReturnType<typeof listRequests>> = [];
      if (req.user) {
        if (req.user.role === 'ngo') {
          const mine = await listRequests({ donationId: id, ngoId: req.user.id });
          userRequest = mine[0] || null;
        } else if (req.user.id === donation.donorId || req.user.role === 'admin') {
          requests = await listRequests({ donationId: id });
        }
      }

      res.json({ donation, userRequest, requests });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load donation details.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/donations', requireAuth, requireRole('donor', 'admin'), async (req: AuthRequest, res) => {
    try {
      const { foodName, category, quantity, location, expiryDate, description, imageUrl } =
        req.body ?? {};
      if (!foodName || typeof foodName !== 'string' || foodName.trim().length < 2) {
        return res.status(400).json({ error: 'Food name is required.' });
      }
      if (!category || !ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'Please choose a valid food category.' });
      }
      if (!quantity || typeof quantity !== 'string' || !quantity.trim()) {
        return res.status(400).json({ error: 'Quantity is required.' });
      }
      if (!location || typeof location !== 'string' || location.trim().length < 3) {
        return res.status(400).json({ error: 'Pickup location is required.' });
      }
      if (!expiryDate || typeof expiryDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate.trim())) {
        return res.status(400).json({ error: 'Please provide a valid expiry date (YYYY-MM-DD).' });
      }
      if (!description || typeof description !== 'string' || description.trim().length < 5) {
        return res.status(400).json({ error: 'Please add a short description of the food.' });
      }
      const imgCheck = sanitizeImageUrl(imageUrl);
      if (imgCheck.ok === false) {
        return res.status(400).json({ error: imgCheck.error });
      }

      const created = await createDonation({
        donorId: req.user!.id,
        foodName,
        category,
        quantity,
        location,
        expiryDate,
        description,
        imageUrl: imgCheck.value,
      });

      broadcastUpdate('donations_changed', { donationId: created.id });
      res.status(201).json({ donation: created });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create donation.';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/donations/:id', requireAuth, requireRole('donor', 'admin'), async (req: AuthRequest, res) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'Invalid donation ID.' });
      }

      const existing = await getDonationById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Donation not found.' });
      }
      if (existing.donorId !== req.user!.id && req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'You can only edit your own donations.' });
      }
      if (existing.status !== 'Available' && req.user!.role !== 'admin') {
        return res.status(400).json({
          error: 'Only available donations can be edited before a request is accepted.',
        });
      }

      const { foodName, category, quantity, location, expiryDate, description, imageUrl } =
        req.body ?? {};
      if (!foodName || typeof foodName !== 'string' || foodName.trim().length < 2) {
        return res.status(400).json({ error: 'Food name is required.' });
      }
      if (!category || !ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'Please select a valid food category.' });
      }
      if (!quantity || typeof quantity !== 'string' || !quantity.trim()) {
        return res.status(400).json({ error: 'Quantity is required.' });
      }
      if (!location || typeof location !== 'string' || location.trim().length < 3) {
        return res.status(400).json({ error: 'Pickup location is required.' });
      }
      if (!expiryDate || typeof expiryDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expiryDate.trim())) {
        return res.status(400).json({ error: 'Valid expiry date (YYYY-MM-DD) is required.' });
      }
      if (!description || typeof description !== 'string' || description.trim().length < 5) {
        return res.status(400).json({ error: 'Description is required.' });
      }
      const imgCheck = sanitizeImageUrl(imageUrl);
      if (imgCheck.ok === false) {
        return res.status(400).json({ error: imgCheck.error });
      }

      const updated = await updateDonation(id, {
        foodName,
        category,
        quantity,
        location,
        expiryDate,
        description,
        ...(imageUrl !== undefined ? { imageUrl: imgCheck.value } : {}),
      });

      broadcastUpdate('donations_changed', { donationId: id });
      res.json({ donation: updated });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update donation.';
      res.status(500).json({ error: msg });
    }
  });

  app.delete('/api/donations/:id', requireAuth, requireRole('donor', 'admin'), async (req: AuthRequest, res) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'Invalid donation ID.' });
      }
      const existing = await getDonationById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Donation not found.' });
      }
      if (existing.donorId !== req.user!.id && req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'You can only delete your own donations.' });
      }
      if (existing.status !== 'Available' && req.user!.role !== 'admin') {
        return res.status(400).json({
          error: 'Only available donations can be deleted.',
        });
      }

      await deleteDonation(id);
      broadcastUpdate('donations_changed', { donationId: id });
      res.json({ deleted: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete donation.';
      res.status(500).json({ error: msg });
    }
  });

  // Donation Requests endpoints
  app.get('/api/requests', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      if (user.role === 'admin') {
        const all = await listRequests();
        return res.json({ requests: all });
      }
      if (user.role === 'donor') {
        const donorReqs = await listRequests({ donorId: user.id });
        return res.json({ requests: donorReqs });
      }
      const ngoReqs = await listRequests({ ngoId: user.id });
      return res.json({ requests: ngoReqs });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load requests.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/requests', requireAuth, requireRole('ngo'), async (req: AuthRequest, res) => {
    try {
      const { donationId, message, pickupTime } = req.body ?? {};
      const parsedDonationId = Number(donationId);
      if (!Number.isInteger(parsedDonationId) || parsedDonationId <= 0) {
        return res.status(400).json({ error: 'Invalid donation selected.' });
      }
      if (!pickupTime || typeof pickupTime !== 'string' || pickupTime.trim().length < 2) {
        return res.status(400).json({ error: 'Please specify a preferred pickup time.' });
      }
      if (!message || typeof message !== 'string' || message.trim().length < 5) {
        return res.status(400).json({ error: 'Please include a brief pickup note for the donor.' });
      }

      const donation = await getDonationById(parsedDonationId);
      if (!donation) {
        return res.status(404).json({ error: 'Donation listing not found.' });
      }
      if (donation.status !== 'Available') {
        return res.status(400).json({
          error: 'This donation has already been assigned or completed.',
        });
      }

      const alreadyRequested = await hasExistingActiveRequest(parsedDonationId, req.user!.id);
      if (alreadyRequested) {
        return res.status(409).json({
          error: 'Your NGO already has an active request for this donation.',
        });
      }

      const created = await createDonationRequest({
        donationId: parsedDonationId,
        ngoId: req.user!.id,
        donorId: donation.donorId,
        message,
        pickupTime,
      });

      broadcastUpdate('requests_changed', { donationId: parsedDonationId });
      res.status(201).json({ request: created });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to submit donation request.';
      res.status(500).json({ error: msg });
    }
  });

  app.patch(
    '/api/requests/:id/respond',
    requireAuth,
    requireRole('donor', 'admin'),
    async (req: AuthRequest, res) => {
      try {
        const id = parsePositiveId(req.params.id);
        if (!id) {
          return res.status(400).json({ error: 'Invalid request ID.' });
        }
        const { decision } = req.body ?? {};
        if (decision !== 'Accepted' && decision !== 'Rejected') {
          return res.status(400).json({ error: 'Decision must be Accepted or Rejected.' });
        }

        const existing = await getRequestById(id);
        if (!existing) {
          return res.status(404).json({ error: 'Donation request not found.' });
        }
        if (existing.donorId !== req.user!.id && req.user!.role !== 'admin') {
          return res.status(403).json({
            error: 'You can only respond to requests for your own donations.',
          });
        }
        if (existing.status !== 'Pending') {
          return res.status(400).json({
            error: `This request has already been marked as ${existing.status}.`,
          });
        }

        const donation = await getDonationById(existing.donationId);
        if (decision === 'Accepted' && donation && donation.status !== 'Available') {
          return res.status(400).json({
            error: 'Another request has already been accepted for this donation.',
          });
        }

        const updated = await respondToRequest(id, decision);
        broadcastUpdate('requests_changed', { donationId: existing.donationId });
        broadcastUpdate('donations_changed', { donationId: existing.donationId });
        res.json({ request: updated });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to update request.';
        res.status(500).json({ error: msg });
      }
    }
  );

  app.patch('/api/requests/:id/delivery', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'Invalid request ID.' });
      }
      const { stage, deliveryContact, trackingNote } = req.body ?? {};
      if (stage !== 'Ready for Pickup' && stage !== 'In Transit' && stage !== 'Completed') {
        return res.status(400).json({
          error: 'Delivery stage must be Ready for Pickup, In Transit, or Completed.',
        });
      }

      const existing = await getRequestById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Donation request not found.' });
      }

      const user = req.user!;
      const isParticipant =
        existing.ngoId === user.id || existing.donorId === user.id || user.role === 'admin';
      if (!isParticipant) {
        return res.status(403).json({
          error: 'Only the assigned NGO, donor, or an admin can update delivery tracking.',
        });
      }
      if (existing.status !== 'Accepted') {
        return res.status(400).json({
          error: 'Delivery tracking can only be updated for accepted requests.',
        });
      }

      const updated = await updateDonationDeliveryStage(
        id,
        stage,
        typeof deliveryContact === 'string' ? deliveryContact : undefined,
        typeof trackingNote === 'string' ? trackingNote : undefined
      );

      broadcastUpdate('requests_changed', { donationId: existing.donationId });
      broadcastUpdate('donations_changed', { donationId: existing.donationId });
      res.json({ request: updated });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update delivery stage.';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/requests/:id/complete', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'Invalid request ID.' });
      }
      const existing = await getRequestById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Donation request not found.' });
      }

      const user = req.user!;
      const isParticipant =
        existing.ngoId === user.id || existing.donorId === user.id || user.role === 'admin';
      if (!isParticipant) {
        return res.status(403).json({
          error: 'Only the assigned NGO, donor, or an admin can mark pickup completed.',
        });
      }
      if (existing.status !== 'Accepted') {
        return res.status(400).json({
          error: 'Only accepted donations can be marked as collected and completed.',
        });
      }

      const updated = await completeDonationRequest(id);
      broadcastUpdate('requests_changed', { donationId: existing.donationId });
      broadcastUpdate('donations_changed', { donationId: existing.donationId });
      res.json({ request: updated });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to complete donation.';
      res.status(500).json({ error: msg });
    }
  });

  // Receiver (NGO) Food Requests endpoints
  app.get('/api/receiver-requests', optionalAuth, async (req: AuthRequest, res) => {
    try {
      await ensureDemoSeededOnce();
      const mine = req.query.mine === 'true';
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      if (mine) {
        if (!req.user) {
          return res.status(401).json({ error: 'Please sign in to view your food requests.' });
        }
        const items =
          req.user.role === 'donor'
            ? await listReceiverRequests({ donorId: req.user.id, status })
            : await listReceiverRequests({ ngoId: req.user.id, status });
        return res.json({ receiverRequests: items });
      }

      const items = await listReceiverRequests({ status });
      res.json({ receiverRequests: items });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load receiver requests.';
      res.status(500).json({ error: msg });
    }
  });

  app.post(
    '/api/receiver-requests',
    requireAuth,
    requireRole('ngo', 'admin'),
    async (req: AuthRequest, res) => {
      try {
        const {
          foodName,
          category,
          quantityNeeded,
          deliveryAddress,
          neededByDate,
          urgency,
          notes,
          imageUrl,
        } = req.body ?? {};

        if (!foodName || typeof foodName !== 'string' || foodName.trim().length < 2) {
          return res.status(400).json({ error: 'Food name is required.' });
        }
        if (!category || !ALLOWED_CATEGORIES.includes(category)) {
          return res.status(400).json({ error: 'Please choose a valid food category.' });
        }
        if (!quantityNeeded || typeof quantityNeeded !== 'string' || !quantityNeeded.trim()) {
          return res.status(400).json({ error: 'Quantity needed is required.' });
        }
        if (!deliveryAddress || typeof deliveryAddress !== 'string' || deliveryAddress.trim().length < 3) {
          return res.status(400).json({ error: 'Delivery address is required.' });
        }
        if (!neededByDate || typeof neededByDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(neededByDate.trim())) {
          return res.status(400).json({ error: 'Valid needed-by date (YYYY-MM-DD) is required.' });
        }
        if (!notes || typeof notes !== 'string' || notes.trim().length < 5) {
          return res.status(400).json({ error: 'Please add brief details about your need.' });
        }
        const imgCheck = sanitizeImageUrl(imageUrl);
        if (imgCheck.ok === false) {
          return res.status(400).json({ error: imgCheck.error });
        }

        const resolvedUrgency = urgency === 'Urgent' ? 'Urgent' : 'Standard';
        const created = await createReceiverRequest({
          ngoId: req.user!.id,
          foodName,
          category,
          quantityNeeded,
          deliveryAddress,
          neededByDate,
          urgency: resolvedUrgency,
          notes,
          imageUrl: imgCheck.value,
        });

        broadcastUpdate('receiver_requests_changed', { id: created.id });
        res.status(201).json({ receiverRequest: created });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to create food request.';
        res.status(500).json({ error: msg });
      }
    }
  );

  app.patch(
    '/api/receiver-requests/:id',
    requireAuth,
    requireRole('ngo', 'admin'),
    async (req: AuthRequest, res) => {
      try {
        const id = parsePositiveId(req.params.id);
        if (!id) {
          return res.status(400).json({ error: 'Invalid request ID.' });
        }
        const existing = await getReceiverRequestById(id);
        if (!existing) {
          return res.status(404).json({ error: 'Receiver food request not found.' });
        }
        if (existing.ngoId !== req.user!.id && req.user!.role !== 'admin') {
          return res.status(403).json({ error: 'You can only edit your own food requests.' });
        }
        if (existing.status !== 'Open' && req.user!.role !== 'admin') {
          return res.status(400).json({
            error: 'Only open requests can be edited before a donor pledges fulfillment.',
          });
        }

        const {
          foodName,
          category,
          quantityNeeded,
          deliveryAddress,
          neededByDate,
          urgency,
          notes,
          imageUrl,
        } = req.body ?? {};
        if (!foodName || typeof foodName !== 'string' || foodName.trim().length < 2) {
          return res.status(400).json({ error: 'Food name is required.' });
        }
        if (!category || !ALLOWED_CATEGORIES.includes(category)) {
          return res.status(400).json({ error: 'Please choose a valid food category.' });
        }
        if (!quantityNeeded || typeof quantityNeeded !== 'string' || !quantityNeeded.trim()) {
          return res.status(400).json({ error: 'Quantity needed is required.' });
        }
        if (!deliveryAddress || typeof deliveryAddress !== 'string' || deliveryAddress.trim().length < 3) {
          return res.status(400).json({ error: 'Delivery address is required.' });
        }
        if (!neededByDate || typeof neededByDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(neededByDate.trim())) {
          return res.status(400).json({ error: 'Valid needed-by date (YYYY-MM-DD) is required.' });
        }
        if (!notes || typeof notes !== 'string' || notes.trim().length < 5) {
          return res.status(400).json({ error: 'Please add brief details about your need.' });
        }
        const imgCheck = sanitizeImageUrl(imageUrl);
        if (imgCheck.ok === false) {
          return res.status(400).json({ error: imgCheck.error });
        }

        const updated = await updateReceiverRequest(id, {
          foodName,
          category,
          quantityNeeded,
          deliveryAddress,
          neededByDate,
          urgency: urgency === 'Urgent' ? 'Urgent' : 'Standard',
          notes,
          ...(imageUrl !== undefined ? { imageUrl: imgCheck.value } : {}),
        });

        broadcastUpdate('receiver_requests_changed', { id });
        res.json({ receiverRequest: updated });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to update receiver request.';
        res.status(500).json({ error: msg });
      }
    }
  );

  app.delete(
    '/api/receiver-requests/:id',
    requireAuth,
    requireRole('ngo', 'admin'),
    async (req: AuthRequest, res) => {
      try {
        const id = parsePositiveId(req.params.id);
        if (!id) {
          return res.status(400).json({ error: 'Invalid request ID.' });
        }
        const existing = await getReceiverRequestById(id);
        if (!existing) {
          return res.status(404).json({ error: 'Receiver food request not found.' });
        }
        if (existing.ngoId !== req.user!.id && req.user!.role !== 'admin') {
          return res.status(403).json({ error: 'You can only delete your own food requests.' });
        }
        if (existing.status !== 'Open' && req.user!.role !== 'admin') {
          return res.status(400).json({
            error: 'Cannot delete a request once a donor has pledged fulfillment.',
          });
        }

        await deleteReceiverRequest(id);
        broadcastUpdate('receiver_requests_changed', { id });
        res.json({ deleted: true });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to delete request.';
        res.status(500).json({ error: msg });
      }
    }
  );

  app.patch(
    '/api/receiver-requests/:id/pledge',
    requireAuth,
    requireRole('donor', 'admin'),
    async (req: AuthRequest, res) => {
      try {
        const id = parsePositiveId(req.params.id);
        if (!id) {
          return res.status(400).json({ error: 'Invalid request ID.' });
        }
        const existing = await getReceiverRequestById(id);
        if (!existing) {
          return res.status(404).json({ error: 'Receiver food request not found.' });
        }
        if (existing.status !== 'Open') {
          return res.status(400).json({
            error: 'A donor has already committed to fulfill this request.',
          });
        }

        const { deliveryContact, trackingNote } = req.body ?? {};
        const updated = await pledgeReceiverRequest(
          id,
          req.user!.id,
          typeof deliveryContact === 'string' ? deliveryContact : null,
          typeof trackingNote === 'string' ? trackingNote : null
        );

        broadcastUpdate('receiver_requests_changed', { id });
        res.json({ receiverRequest: updated });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to pledge fulfillment.';
        res.status(500).json({ error: msg });
      }
    }
  );

  app.patch('/api/receiver-requests/:id/delivery', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'Invalid request ID.' });
      }
      const { status, deliveryContact, trackingNote } = req.body ?? {};
      if (status !== 'In Transit' && status !== 'Delivered') {
        return res.status(400).json({
          error: 'Delivery status must be In Transit or Delivered.',
        });
      }

      const existing = await getReceiverRequestById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Receiver food request not found.' });
      }

      const user = req.user!;
      const isParticipant =
        existing.ngoId === user.id || existing.donorId === user.id || user.role === 'admin';
      if (!isParticipant) {
        return res.status(403).json({
          error: 'Only the assigned donor, receiver NGO, or an admin can update delivery tracking.',
        });
      }
      if (existing.status === 'Open') {
        return res.status(400).json({
          error: 'A donor must pledge fulfillment before delivery tracking can begin.',
        });
      }
      if (existing.status === 'Delivered') {
        return res.status(400).json({ error: 'This delivery has already been completed.' });
      }

      const updated = await updateReceiverDeliveryStatus(
        id,
        status,
        typeof deliveryContact === 'string' ? deliveryContact : undefined,
        typeof trackingNote === 'string' ? trackingNote : undefined
      );

      broadcastUpdate('receiver_requests_changed', { id });
      res.json({ receiverRequest: updated });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update delivery status.';
      res.status(500).json({ error: msg });
    }
  });

  // Admin management endpoints
  app.get('/api/admin/overview', requireAuth, requireRole('admin'), async (_req, res) => {
    try {
      const [stats, allUsers, allDonations, allRequests, allReceiverRequests, messages] =
        await Promise.all([
          getPlatformStats(),
          listAllUsers(),
          listDonations(),
          listRequests(),
          listReceiverRequests(),
          listContactMessages(),
        ]);
      res.json({
        stats,
        users: allUsers,
        donations: allDonations,
        requests: allRequests,
        receiverRequests: allReceiverRequests,
        messages,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load admin overview.';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/admin/users/:id', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'Invalid user ID.' });
      }
      if (id === req.user!.id && req.body?.status === 'suspended') {
        return res.status(400).json({ error: 'You cannot suspend your own active admin account.' });
      }

      const updates: { status?: string; role?: UserRole } = {};
      if (req.body?.status === 'active' || req.body?.status === 'suspended') {
        updates.status = req.body.status;
      }
      if (req.body?.role === 'donor' || req.body?.role === 'ngo' || req.body?.role === 'admin') {
        updates.role = req.body.role;
      }
      if (!updates.status && !updates.role) {
        return res.status(400).json({ error: 'Provide a valid status or role update.' });
      }

      const updated = await updateUserStatusAndRole(id, updates);
      if (!updated) {
        return res.status(404).json({ error: 'User not found.' });
      }
      broadcastUpdate('users_changed');
      res.json({ user: updated });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update user.';
      res.status(500).json({ error: msg });
    }
  });

  app.delete('/api/admin/users/:id', requireAuth, requireRole('admin'), async (req: AuthRequest, res) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        return res.status(400).json({ error: 'Invalid user ID.' });
      }
      if (id === req.user!.id) {
        return res.status(400).json({ error: 'You cannot delete your own active admin account.' });
      }
      const deleted = await deleteUserById(id);
      if (!deleted) {
        return res.status(404).json({ error: 'User not found.' });
      }
      broadcastUpdate('users_changed');
      broadcastUpdate('donations_changed');
      res.json({ deleted: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete user.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/admin/demo-data', requireAuth, requireRole('admin'), async (req, res) => {
    try {
      const action = req.body?.action;
      if (action === 'clear') {
        await clearDemoData();
        broadcastUpdate('donations_changed');
        broadcastUpdate('users_changed');
        broadcastUpdate('requests_changed');
        broadcastUpdate('receiver_requests_changed');
        return res.json({ cleared: true });
      }
      await seedDemoData(true);
      broadcastUpdate('donations_changed');
      broadcastUpdate('users_changed');
      broadcastUpdate('requests_changed');
      broadcastUpdate('receiver_requests_changed');
      res.json({ seeded: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to manage demo records.';
      res.status(500).json({ error: msg });
    }
  });

  // Contact Us endpoint
  app.post('/api/contact', async (req, res) => {
    try {
      const { name, email, subject, message } = req.body ?? {};
      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'Please enter your full name.' });
      }
      if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      if (!subject || typeof subject !== 'string' || subject.trim().length < 3) {
        return res.status(400).json({ error: 'Please enter a subject.' });
      }
      if (!message || typeof message !== 'string' || message.trim().length < 10) {
        return res.status(400).json({ error: 'Message must be at least 10 characters.' });
      }

      const saved = await saveContactMessage({ name, email, subject, message });
      res.status(201).json({ saved });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to submit contact form.';
      res.status(500).json({ error: msg });
    }
  });

  // Return JSON 404 for unknown API routes and JSON errors for malformed/oversized payloads
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }
    const errObj = err as { type?: string; status?: number; message?: string };
    if (errObj?.type === 'entity.too.large' || errObj?.status === 413) {
      return res.status(413).json({
        error: 'Request payload is too large. Please upload a smaller image.',
      });
    }
    if (err instanceof SyntaxError && errObj?.status === 400) {
      return res.status(400).json({ error: 'Invalid JSON request payload.' });
    }
    if (req.path.startsWith('/api')) {
      return res.status(errObj?.status || 500).json({
        error: errObj?.message || 'Unexpected server error.',
      });
    }
    return next(err);
  });

  // Vite middleware in development, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HarvestBridge server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
