import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Edit3,
  Handshake,
  LayoutDashboard,
  Package,
  PlusCircle,
  Trash2,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import { DashboardLayout, type SidebarNavItem } from '../components/DashboardLayout.tsx';
import { DeliveryTracker } from '../components/DeliveryTracker.tsx';
import { FoodImagePicker, FoodMedia, getCategoryImage } from '../components/FoodMedia.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useRouter } from '../context/RouterContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { useLiveSync } from '../hooks/useLiveSync.ts';
import {
  FOOD_CATEGORIES,
  type Donation,
  type DonationRequest,
  type ReceiverRequest,
} from '../types.ts';

interface DonationFormState {
  foodName: string;
  category: string;
  quantity: string;
  location: string;
  expiryDate: string;
  description: string;
  imageUrl: string | null;
}

const emptyForm = (defaultLocation = ''): DonationFormState => ({
  foodName: '',
  category: FOOD_CATEGORIES[0],
  quantity: '',
  location: defaultLocation,
  expiryDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  description: '',
  imageUrl: null,
});

export function DonorDashboardPage() {
  const { user, authFetch } = useAuth();
  const { navigate } = useRouter();
  const { showSuccess, showError } = useToast();

  const [section, setSection] = useState<
    'overview' | 'add' | 'donations' | 'requests' | 'receiver-needs'
  >('overview');
  const [donations, setDonations] = useState<Donation[]>([]);
  const [requests, setRequests] = useState<DonationRequest[]>([]);
  const [receiverNeeds, setReceiverNeeds] = useState<ReceiverRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DonationFormState>(() => emptyForm(user?.address || ''));
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Delivery / Pledge modal
  const [actionModal, setActionModal] = useState<{
    mode: 'donation-delivery' | 'receiver-pledge' | 'receiver-delivery';
    id: number;
    title: string;
    nextStage: string;
  } | null>(null);
  const [deliveryContact, setDeliveryContact] = useState('');
  const [trackingNote, setTrackingNote] = useState('');

  const loadDonorData = useCallback(async () => {
    try {
      const [donRes, reqRes, recRes] = await Promise.all([
        authFetch('/api/donations?mine=true'),
        authFetch('/api/requests'),
        authFetch('/api/receiver-requests'),
      ]);
      if (donRes.ok) {
        const d = await donRes.json();
        setDonations(d.donations || []);
      }
      if (reqRes.ok) {
        const r = await reqRes.json();
        setRequests(r.requests || []);
      }
      if (recRes.ok) {
        const rr = await recRes.json();
        setReceiverNeeds(rr.receiverRequests || []);
      }
    } catch {
      // Handled on actions
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadDonorData();
  }, [loadDonorData]);

  useLiveSync(loadDonorData);

  const openReceiverNeeds = useMemo(
    () =>
      receiverNeeds.filter(
        (r) => r.status === 'Open' || (user && r.donorId === user.id)
      ),
    [receiverNeeds, user]
  );

  const stats = useMemo(() => {
    const available = donations.filter((d) => d.status === 'Available').length;
    const completed = donations.filter((d) => d.status === 'Completed').length;
    const pendingReqs = requests.filter((r) => r.status === 'Pending').length;
    const openNeedsCount = receiverNeeds.filter((r) => r.status === 'Open').length;
    return {
      total: donations.length,
      available,
      completed,
      pendingReqs,
      openNeedsCount,
    };
  }, [donations, requests, receiverNeeds]);

  const navItems: SidebarNavItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'add', label: editingId ? 'Edit Donation' : 'Add Donation', icon: PlusCircle },
    { id: 'donations', label: 'My Donations', icon: Package },
    {
      id: 'requests',
      label: 'NGO Requests & Tracking',
      icon: Truck,
      badgeCount: stats.pendingReqs,
    },
    {
      id: 'receiver-needs',
      label: 'Food Requested by NGOs',
      icon: ClipboardList,
      badgeCount: stats.openNeedsCount,
    },
  ];

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      form.foodName.trim().length < 2 ||
      !form.quantity.trim() ||
      form.location.trim().length < 3 ||
      !form.expiryDate ||
      form.description.trim().length < 5
    ) {
      showError('Please fill in all required food donation fields.');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingId ? `/api/donations/${editingId}` : '/api/donations';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await authFetch(url, {
        method,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not save donation.');
      }

      showSuccess(editingId ? 'Donation updated successfully.' : 'Food donation published.');
      setEditingId(null);
      setForm(emptyForm(user?.address || ''));
      setSection('donations');
      await loadDonorData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to save donation.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item: Donation) => {
    setEditingId(item.id);
    setForm({
      foodName: item.foodName,
      category: item.category,
      quantity: item.quantity,
      location: item.location,
      expiryDate: item.expiryDate,
      description: item.description,
      imageUrl: item.imageUrl || null,
    });
    setSection('add');
  };

  const handleDelete = async (id: number) => {
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/donations/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not delete donation.');
      }
      showSuccess('Donation listing removed.');
      setConfirmDeleteId(null);
      await loadDonorData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to delete donation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestDecision = async (requestId: number, decision: 'Accepted' | 'Rejected') => {
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/requests/${requestId}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not update request.');
      }
      showSuccess(
        decision === 'Accepted'
          ? 'Request accepted. You can now track preparation and delivery.'
          : 'Request rejected.'
      );
      await loadDonorData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to update request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActionModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal) return;
    setSubmitting(true);
    try {
      if (actionModal.mode === 'donation-delivery') {
        const res = await authFetch(`/api/requests/${actionModal.id}/delivery`, {
          method: 'PATCH',
          body: JSON.stringify({
            stage: actionModal.nextStage,
            deliveryContact: deliveryContact.trim() || undefined,
            trackingNote: trackingNote.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not update delivery stage.');
        showSuccess(`Delivery stage updated to ${actionModal.nextStage}.`);
      } else if (actionModal.mode === 'receiver-pledge') {
        const res = await authFetch(`/api/receiver-requests/${actionModal.id}/pledge`, {
          method: 'PATCH',
          body: JSON.stringify({
            deliveryContact: deliveryContact.trim() || undefined,
            trackingNote: trackingNote.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not pledge food fulfillment.');
        showSuccess('Thank you! You have pledged to fulfill this receiver food request.');
      } else {
        const res = await authFetch(`/api/receiver-requests/${actionModal.id}/delivery`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: actionModal.nextStage,
            deliveryContact: deliveryContact.trim() || undefined,
            trackingNote: trackingNote.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not update delivery tracking.');
        showSuccess(`Delivery updated to ${actionModal.nextStage}.`);
      }

      setActionModal(null);
      setDeliveryContact('');
      setTrackingNote('');
      await loadDonorData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to save update.');
    } finally {
      setSubmitting(false);
    }
  };

  const sectionTitle =
    section === 'add'
      ? editingId
        ? 'Edit Food Donation'
        : 'Add New Food Donation'
      : section === 'donations'
        ? 'Uploaded Food Donations'
        : section === 'requests'
          ? 'NGO Requests & Delivery Tracker'
          : section === 'receiver-needs'
            ? 'Food Requested by Receivers (NGOs)'
            : 'Donor Dashboard Overview';

  return (
    <DashboardLayout
      portalLabel="Donor Portal"
      title={sectionTitle}
      navItems={navItems}
      activeSection={section}
      onSelectSection={(id) => {
        if (id !== 'add') setEditingId(null);
        setSection(id as typeof section);
      }}
      primaryAction={
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setForm(emptyForm(user?.address || ''));
            setSection('add');
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532D] min-h-[40px] whitespace-nowrap cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" aria-hidden="true" />
          <span>Add Food Donation</span>
        </button>
      }
    >
      {/* OVERVIEW */}
      {section === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-5">
              <p className="text-xs font-medium text-[#4B5D51]">Total Donations</p>
              <p className="font-mono text-2xl font-semibold text-[#142219] tabular-nums mt-1">
                {stats.total}
              </p>
            </div>
            <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-5">
              <p className="text-xs font-medium text-[#4B5D51]">Available Now</p>
              <p className="font-mono text-2xl font-semibold text-[#166534] tabular-nums mt-1">
                {stats.available}
              </p>
            </div>
            <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-5">
              <p className="text-xs font-medium text-[#4B5D51]">Pending NGO Requests</p>
              <p className="font-mono text-2xl font-semibold text-[#B45309] tabular-nums mt-1">
                {stats.pendingReqs}
              </p>
            </div>
            <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-5">
              <p className="text-xs font-medium text-[#4B5D51]">Open Receiver Needs</p>
              <p className="font-mono text-2xl font-semibold text-[#166534] tabular-nums mt-1">
                {stats.openNeedsCount}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E2DDD1] flex items-center justify-between gap-4">
              <h2 className="font-display text-lg font-semibold text-[#142219]">
                Recent NGO Requests &amp; Active Deliveries
              </h2>
              <button
                type="button"
                onClick={() => setSection('requests')}
                className="text-xs font-semibold text-[#166534] hover:underline cursor-pointer"
              >
                Open Delivery Tracker
              </button>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-[#4B5D51]">Loading requests...</div>
            ) : requests.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#4B5D51]">
                No NGO requests received yet. Publish an available donation or fulfill an open
                receiver food request.
              </div>
            ) : (
              <div className="divide-y divide-[#E2DDD1]">
                {requests.slice(0, 4).map((reqItem) => (
                  <div key={reqItem.id} className="p-5 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm text-[#142219]">
                            {reqItem.foodName}
                          </span>
                          <StatusBadge
                            status={
                              reqItem.status === 'Accepted'
                                ? reqItem.deliveryStage || 'Accepted'
                                : reqItem.status
                            }
                          />
                        </div>
                        <p className="text-xs text-[#4B5D51]">
                          Requested by{' '}
                          <strong className="text-[#142219]">
                            {reqItem.ngoOrganization || reqItem.ngoName}
                          </strong>{' '}
                          · Pickup: {reqItem.pickupTime}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {reqItem.status === 'Pending' && (
                          <>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleRequestDecision(reqItem.id, 'Accepted')}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#166534] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#14532D] min-h-[38px] cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Accept</span>
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleRequestDecision(reqItem.id, 'Rejected')}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEE2E2] min-h-[38px] cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {reqItem.status !== 'Rejected' && (
                      <DeliveryTracker
                        variant="donation"
                        currentStage={reqItem.deliveryStage || reqItem.status}
                        deliveryContact={reqItem.deliveryContact}
                        trackingNote={reqItem.trackingNote}
                        dispatchedAt={reqItem.dispatchedAt}
                        deliveredAt={reqItem.deliveredAt}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD / EDIT DONATION FORM */}
      {section === 'add' && (
        <div className="max-w-3xl rounded-2xl border border-[#E2DDD1] bg-[#FFFFFF] p-6 sm:p-8 space-y-5">
          <div className="rounded-xl border border-[#E2DDD1] bg-[#FAF7F0] px-4 py-3 text-xs text-[#4B5D51]">
            <strong className="text-[#142219]">How to add food:</strong> Enter the food item,
            category, quantity, pickup address, and expiry date, select or upload a real food photo
            below, and publish it for local NGOs to request.
          </div>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="don-food-name"
                className="block text-sm font-medium text-[#142219] mb-1.5"
              >
                Food Name / Title *
              </label>
              <input
                id="don-food-name"
                type="text"
                required
                value={form.foodName}
                onChange={(e) => setForm({ ...form, foodName: e.target.value })}
                placeholder="e.g., Fresh Vegetable Pulao Trays"
                className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="don-category"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Category *
                </label>
                <select
                  id="don-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                >
                  {FOOD_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="don-quantity"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Quantity *
                </label>
                <input
                  id="don-quantity"
                  type="text"
                  required
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="e.g., 30 meal boxes or 15 kg"
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="don-location"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Pickup Location *
                </label>
                <input
                  id="don-location"
                  type="text"
                  required
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Street address & pickup bay"
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div>
                <label
                  htmlFor="don-expiry"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Expiry / Best Before Date *
                </label>
                <input
                  id="don-expiry"
                  type="date"
                  required
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="don-desc"
                className="block text-sm font-medium text-[#142219] mb-1.5"
              >
                Description &amp; Handling Notes *
              </label>
              <textarea
                id="don-desc"
                required
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe packaging, dietary info, refrigeration state, and pickup hours..."
                className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
              />
            </div>

            <FoodImagePicker
              category={form.category}
              foodName={form.foodName}
              value={form.imageUrl}
              onChange={(nextUrl) => setForm({ ...form, imageUrl: nextUrl })}
              onError={showError}
            />

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-[#166534] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-60 min-h-[44px] cursor-pointer"
              >
                {submitting
                  ? 'Saving...'
                  : editingId
                    ? 'Save Changes'
                    : 'Publish Food Donation'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm(user?.address || ''));
                    setSection('donations');
                  }}
                  className="rounded-lg border border-[#E2DDD1] px-4 py-2.5 text-sm font-medium text-[#4B5D51] hover:bg-[#FAF7F0] min-h-[44px] cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* MY DONATIONS TABLE */}
      {(section === 'donations' || section === 'overview') && (
        <div className={section === 'overview' ? 'mt-8' : ''}>
          <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E2DDD1] flex items-center justify-between gap-4">
              <h2 className="font-display text-lg font-semibold text-[#142219]">
                Your Uploaded Food Donations
              </h2>
              <span className="font-mono text-xs text-[#4B5D51] tabular-nums">
                {donations.length} listings
              </span>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-[#4B5D51]">Loading donations...</div>
            ) : donations.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-[#142219]">
                  You haven&apos;t uploaded any food donations yet.
                </p>
                <button
                  type="button"
                  onClick={() => setSection('add')}
                  className="mt-3 rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532D] cursor-pointer"
                >
                  Upload First Donation
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2DDD1] bg-[#FAF7F0] text-xs font-semibold text-[#4B5D51]">
                      <th className="py-3 px-4">Food Item</th>
                      <th className="py-3 px-4">Quantity</th>
                      <th className="py-3 px-4">Expiry</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2DDD1] text-sm">
                    {donations.map((item) => (
                      <tr key={item.id} className="hover:bg-[#FAF7F0]/60">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-11 rounded-lg overflow-hidden border border-[#E2DDD1] shrink-0 bg-[#FAF7F0]">
                              <FoodMedia
                                src={getCategoryImage(item.category, item.foodName, item.imageUrl)}
                                alt={item.foodName}
                                className="w-full h-full"
                              />
                            </div>
                            <div>
                              <button
                                type="button"
                                onClick={() => navigate(`/donations/${item.id}`)}
                                className="font-semibold text-[#142219] hover:text-[#166534] text-left cursor-pointer"
                              >
                                {item.foodName}
                              </button>
                              <p className="text-xs text-[#4B5D51]">
                                {item.category} · {item.location}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[#4B5D51] whitespace-nowrap">
                          {item.quantity}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-[#4B5D51] tabular-nums whitespace-nowrap">
                          {item.expiryDate}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {item.status === 'Available' ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(item)}
                                className="inline-flex items-center gap-1 rounded-md border border-[#D6E0D8] bg-[#FAF7F0] px-2.5 py-1.5 text-xs font-medium text-[#142219] hover:bg-[#E9F0EA] cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Edit</span>
                              </button>
                              {confirmDeleteId === item.id ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => handleDelete(item.id)}
                                    className="rounded-md bg-[#DC2626] px-2.5 py-1.5 text-xs font-medium text-white cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="rounded-md border border-[#E2DDD1] px-2 py-1.5 text-xs text-[#4B5D51] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(item.id)}
                                  className="inline-flex items-center gap-1 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1.5 text-xs font-medium text-[#B91C1C] hover:bg-[#FEE2E2] cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigate(`/donations/${item.id}`)}
                              className="text-xs font-semibold text-[#166534] hover:underline cursor-pointer"
                            >
                              View Details
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NGO REQUESTS & DELIVERY TRACKER */}
      {section === 'requests' && (
        <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2DDD1] flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[#142219]">
              NGO Pickup Requests &amp; Delivery Stages
            </h2>
            <span className="font-mono text-xs text-[#4B5D51] tabular-nums">
              {requests.length} total
            </span>
          </div>

          {requests.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#4B5D51]">
              No NGO requests have arrived yet.
            </div>
          ) : (
            <div className="divide-y divide-[#E2DDD1]">
              {requests.map((reqItem) => (
                <div key={reqItem.id} className="p-6 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-display text-base font-semibold text-[#142219]">
                          {reqItem.foodName}
                        </span>
                        <StatusBadge
                          status={
                            reqItem.status === 'Accepted'
                              ? reqItem.deliveryStage || 'Accepted'
                              : reqItem.status
                          }
                        />
                      </div>
                      <p className="text-sm text-[#142219]">
                        NGO: <strong>{reqItem.ngoOrganization || reqItem.ngoName}</strong> (
                        {reqItem.ngoEmail}
                        {reqItem.ngoPhone ? ` · ${reqItem.ngoPhone}` : ''})
                      </p>
                      <p className="text-xs text-[#4B5D51]">
                        Preferred Pickup: <strong>{reqItem.pickupTime}</strong> · Quantity:{' '}
                        {reqItem.quantity}
                      </p>
                      <p className="text-sm text-[#4B5D51]">{reqItem.message}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {reqItem.status === 'Pending' && (
                        <>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleRequestDecision(reqItem.id, 'Accepted')}
                            className="rounded-lg bg-[#166534] px-4 py-2 text-xs font-semibold text-white hover:bg-[#14532D] min-h-[40px] cursor-pointer"
                          >
                            Accept Request
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleRequestDecision(reqItem.id, 'Rejected')}
                            className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-2 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEE2E2] min-h-[40px] cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {reqItem.status === 'Accepted' && (
                        <>
                          {reqItem.deliveryStage === 'Accepted' && (
                            <button
                              type="button"
                              onClick={() => {
                                setActionModal({
                                  mode: 'donation-delivery',
                                  id: reqItem.id,
                                  title: reqItem.foodName,
                                  nextStage: 'Ready for Pickup',
                                });
                                setDeliveryContact(reqItem.deliveryContact || user?.phone || '');
                                setTrackingNote('Food packed and ready at pickup bay.');
                              }}
                              className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2 text-xs font-semibold text-[#B45309] hover:bg-[#FEF3C7] min-h-[38px] cursor-pointer"
                            >
                              Mark Ready for Pickup
                            </button>
                          )}
                          {reqItem.deliveryStage !== 'In Transit' && (
                            <button
                              type="button"
                              onClick={() => {
                                setActionModal({
                                  mode: 'donation-delivery',
                                  id: reqItem.id,
                                  title: reqItem.foodName,
                                  nextStage: 'In Transit',
                                });
                                setDeliveryContact(reqItem.deliveryContact || user?.phone || '');
                                setTrackingNote('Food handed over for delivery to NGO.');
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 py-2 text-xs font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE] min-h-[38px] cursor-pointer"
                            >
                              <Truck className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Mark In Transit</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setActionModal({
                                mode: 'donation-delivery',
                                id: reqItem.id,
                                title: reqItem.foodName,
                                nextStage: 'Completed',
                              });
                              setDeliveryContact(reqItem.deliveryContact || '');
                              setTrackingNote('Delivery completed and confirmed.');
                            }}
                            className="rounded-lg bg-[#0F766E] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 min-h-[38px] cursor-pointer"
                          >
                            Mark Delivered &amp; Completed
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <DeliveryTracker
                    variant="donation"
                    currentStage={reqItem.deliveryStage || reqItem.status}
                    deliveryContact={reqItem.deliveryContact}
                    trackingNote={reqItem.trackingNote}
                    dispatchedAt={reqItem.dispatchedAt}
                    deliveredAt={reqItem.deliveredAt}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FOOD REQUESTED BY RECEIVERS (NGOs) */}
      {section === 'receiver-needs' && (
        <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2DDD1] flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#142219]">
                Food Requested by Community NGOs
              </h2>
              <p className="text-xs text-[#4B5D51]">
                Pledge to supply open NGO food requests and update delivery status until delivered.
              </p>
            </div>
            <span className="font-mono text-xs text-[#4B5D51] tabular-nums">
              {openReceiverNeeds.length} requests
            </span>
          </div>

          {openReceiverNeeds.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#4B5D51]">
              No open receiver food requests right now.
            </div>
          ) : (
            <div className="divide-y divide-[#E2DDD1]">
              {openReceiverNeeds.map((item) => {
                const isMine = user && item.donorId === user.id;
                return (
                  <div key={item.id} className="p-6 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-20 h-16 rounded-lg overflow-hidden border border-[#E2DDD1] shrink-0 bg-[#FAF7F0] hidden sm:block">
                          <FoodMedia
                            src={getCategoryImage(item.category, item.foodName, item.imageUrl)}
                            alt={item.foodName}
                            className="w-full h-full"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h3 className="font-display text-base font-semibold text-[#142219]">
                              {item.foodName}
                            </h3>
                            <StatusBadge status={item.status} />
                            <span className="text-xs text-[#4B5D51]">
                              {item.category} · {item.urgency}
                              {item.isDemo ? ' · Demo request' : ''}
                            </span>
                          </div>
                          <p className="text-xs text-[#4B5D51]">
                            Requested by{' '}
                            <strong className="text-[#142219]">
                              {item.ngoOrganization || item.ngoName}
                            </strong>{' '}
                            ({item.ngoEmail}
                            {item.ngoPhone ? ` · ${item.ngoPhone}` : ''})
                          </p>
                          <p className="text-xs text-[#4B5D51]">
                            Quantity Needed:{' '}
                            <strong className="text-[#142219]">{item.quantityNeeded}</strong> ·
                            Needed by{' '}
                            <span className="font-mono tabular-nums">{item.neededByDate}</span> ·
                            Deliver to: {item.deliveryAddress}
                          </p>
                          <p className="text-sm text-[#4B5D51]">{item.notes}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {item.status === 'Open' && (
                          <button
                            type="button"
                            onClick={() => {
                              setActionModal({
                                mode: 'receiver-pledge',
                                id: item.id,
                                title: item.foodName,
                                nextStage: 'Pledged',
                              });
                              setDeliveryContact(user?.phone || '');
                              setTrackingNote('Preparing food batch for delivery.');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#166534] px-4 py-2 text-xs font-semibold text-white hover:bg-[#14532D] min-h-[40px] cursor-pointer"
                          >
                            <Handshake className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Fulfill / Pledge Food</span>
                          </button>
                        )}

                        {isMine && item.status === 'Pledged' && (
                          <button
                            type="button"
                            onClick={() => {
                              setActionModal({
                                mode: 'receiver-delivery',
                                id: item.id,
                                title: item.foodName,
                                nextStage: 'In Transit',
                              });
                              setDeliveryContact(item.deliveryContact || user?.phone || '');
                              setTrackingNote('Food packed and dispatched for delivery.');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 py-2 text-xs font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE] min-h-[38px] cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Mark In Transit</span>
                          </button>
                        )}

                        {isMine && (item.status === 'Pledged' || item.status === 'In Transit') && (
                          <button
                            type="button"
                            onClick={() => {
                              setActionModal({
                                mode: 'receiver-delivery',
                                id: item.id,
                                title: item.foodName,
                                nextStage: 'Delivered',
                              });
                              setDeliveryContact(item.deliveryContact || '');
                              setTrackingNote('Delivered to NGO drop-off location.');
                            }}
                            className="rounded-lg bg-[#0F766E] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 min-h-[38px] cursor-pointer"
                          >
                            Mark Delivered
                          </button>
                        )}
                      </div>
                    </div>

                    <DeliveryTracker
                      variant="receiver"
                      currentStage={item.status}
                      deliveryContact={item.deliveryContact}
                      trackingNote={item.trackingNote}
                      pledgedAt={item.pledgedAt}
                      dispatchedAt={item.dispatchedAt}
                      deliveredAt={item.deliveredAt}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Delivery / Pledge Update Modal */}
      {actionModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#142219]/45 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E2DDD1] bg-[#FFFFFF] p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#166534]">
                  {actionModal.mode === 'receiver-pledge'
                    ? 'Commit Food Fulfillment'
                    : 'Update Delivery Tracking'}
                </p>
                <h3 className="font-display text-lg font-bold text-[#142219]">
                  {actionModal.title}
                </h3>
                <p className="text-xs text-[#4B5D51]">
                  Status update: <strong>{actionModal.nextStage}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActionModal(null)}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-[#4B5D51] hover:bg-[#FAF7F0]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleActionModalSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="donor-track-contact"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Delivery / Driver Contact
                </label>
                <input
                  id="donor-track-contact"
                  type="text"
                  value={deliveryContact}
                  onChange={(e) => setDeliveryContact(e.target.value)}
                  placeholder="Name & phone number for handoff"
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div>
                <label
                  htmlFor="donor-track-note"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Tracking Note / ETA
                </label>
                <textarea
                  id="donor-track-note"
                  rows={3}
                  value={trackingNote}
                  onChange={(e) => setTrackingNote(e.target.value)}
                  placeholder="Share dispatch details, vehicle info, or estimated arrival..."
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] min-h-[42px] cursor-pointer"
                >
                  {submitting
                    ? 'Saving...'
                    : actionModal.mode === 'receiver-pledge'
                      ? 'Confirm Pledge'
                      : 'Update Delivery Stage'}
                </button>
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="rounded-lg border border-[#E2DDD1] px-4 py-2.5 text-sm font-medium text-[#4B5D51] hover:bg-[#FAF7F0] min-h-[42px] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
