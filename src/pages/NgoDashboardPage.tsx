import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Edit3,
  LayoutDashboard,
  MapPin,
  Package,
  PlusCircle,
  Search,
  Trash2,
  Truck,
  X,
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

interface ReceiverFormState {
  foodName: string;
  category: string;
  quantityNeeded: string;
  deliveryAddress: string;
  neededByDate: string;
  urgency: 'Standard' | 'Urgent';
  notes: string;
  imageUrl: string | null;
}

const emptyReceiverForm = (defaultAddress = ''): ReceiverFormState => ({
  foodName: '',
  category: FOOD_CATEGORIES[0],
  quantityNeeded: '',
  deliveryAddress: defaultAddress,
  neededByDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  urgency: 'Standard',
  notes: '',
  imageUrl: null,
});

export function NgoDashboardPage() {
  const { user, authFetch } = useAuth();
  const { navigate } = useRouter();
  const { showSuccess, showError } = useToast();

  const [section, setSection] = useState<'browse' | 'requests' | 'receiver-needs'>('browse');
  const [donations, setDonations] = useState<Donation[]>([]);
  const [myRequests, setMyRequests] = useState<DonationRequest[]>([]);
  const [myReceiverRequests, setMyReceiverRequests] = useState<ReceiverRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [requestStatusFilter, setRequestStatusFilter] = useState('All');

  // Inline request modal for donor listings
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
  const [pickupTime, setPickupTime] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delivery tracking update modal
  const [trackingModal, setTrackingModal] = useState<{
    kind: 'donation' | 'receiver';
    id: number;
    title: string;
    nextStage: 'In Transit' | 'Completed' | 'Delivered';
  } | null>(null);
  const [deliveryContact, setDeliveryContact] = useState('');
  const [trackingNote, setTrackingNote] = useState('');

  // Receiver food request form
  const [editingNeedId, setEditingNeedId] = useState<number | null>(null);
  const [showNeedForm, setShowNeedForm] = useState(false);
  const [needForm, setNeedForm] = useState<ReceiverFormState>(() =>
    emptyReceiverForm(user?.address || '')
  );
  const [confirmDeleteNeedId, setConfirmDeleteNeedId] = useState<number | null>(null);

  const loadNgoData = useCallback(async () => {
    try {
      const [donRes, reqRes, recRes] = await Promise.all([
        authFetch('/api/donations?status=Available'),
        authFetch('/api/requests'),
        authFetch('/api/receiver-requests?mine=true'),
      ]);
      if (donRes.ok) {
        const d = await donRes.json();
        setDonations(d.donations || []);
      }
      if (reqRes.ok) {
        const r = await reqRes.json();
        setMyRequests(r.requests || []);
      }
      if (recRes.ok) {
        const rr = await recRes.json();
        setMyReceiverRequests(rr.receiverRequests || []);
      }
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadNgoData();
  }, [loadNgoData]);

  useLiveSync(loadNgoData);

  const activeRequestedDonationIds = useMemo(() => {
    const ids = new Set<number>();
    for (const r of myRequests) {
      if (r.status !== 'Rejected') {
        ids.add(r.donationId);
      }
    }
    return ids;
  }, [myRequests]);

  const filteredDonations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return donations.filter((item) => {
      if (category !== 'All' && item.category !== category) return false;
      if (!q) return true;
      return (
        item.foodName.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.donorOrganization || item.donorName).toLowerCase().includes(q)
      );
    });
  }, [donations, search, category]);

  const filteredRequests = useMemo(() => {
    if (requestStatusFilter === 'All') return myRequests;
    return myRequests.filter((r) => r.status === requestStatusFilter);
  }, [myRequests, requestStatusFilter]);

  const stats = useMemo(() => {
    return {
      available: donations.length,
      pending: myRequests.filter((r) => r.status === 'Pending').length,
      inProgress:
        myRequests.filter((r) => r.status === 'Accepted').length +
        myReceiverRequests.filter((r) => r.status === 'Pledged' || r.status === 'In Transit').length,
      completed:
        myRequests.filter((r) => r.status === 'Completed').length +
        myReceiverRequests.filter((r) => r.status === 'Delivered').length,
    };
  }, [donations, myRequests, myReceiverRequests]);

  const navItems: SidebarNavItem[] = [
    { id: 'browse', label: 'Available Food', icon: LayoutDashboard, badgeCount: stats.available },
    {
      id: 'requests',
      label: 'Pickup & Delivery Tracker',
      icon: Truck,
      badgeCount: myRequests.filter((r) => r.status === 'Accepted').length,
    },
    {
      id: 'receiver-needs',
      label: 'Food Requested by Us',
      icon: ClipboardList,
      badgeCount: myReceiverRequests.length,
    },
  ];

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDonation) return;
    if (!pickupTime.trim() || message.trim().length < 5) {
      showError('Please enter a pickup window and a brief note (5+ characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authFetch('/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          donationId: selectedDonation.id,
          pickupTime: pickupTime.trim(),
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not send request.');
      }
      showSuccess('Food request sent to donor.');
      setSelectedDonation(null);
      setPickupTime('');
      setMessage('');
      await loadNgoData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to send food request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNeedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      needForm.foodName.trim().length < 2 ||
      !needForm.quantityNeeded.trim() ||
      needForm.deliveryAddress.trim().length < 3 ||
      !needForm.neededByDate ||
      needForm.notes.trim().length < 5
    ) {
      showError('Please complete all required fields for your food request.');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingNeedId
        ? `/api/receiver-requests/${editingNeedId}`
        : '/api/receiver-requests';
      const method = editingNeedId ? 'PATCH' : 'POST';
      const res = await authFetch(url, {
        method,
        body: JSON.stringify(needForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to save food request.');
      }
      showSuccess(editingNeedId ? 'Food request updated.' : 'Food request posted for donors.');
      setShowNeedForm(false);
      setEditingNeedId(null);
      setNeedForm(emptyReceiverForm(user?.address || ''));
      await loadNgoData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not save food request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNeed = async (id: number) => {
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/receiver-requests/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not delete request.');
      }
      showSuccess('Receiver food request removed.');
      setConfirmDeleteNeedId(null);
      await loadNgoData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to delete request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingModal) return;
    setSubmitting(true);
    try {
      if (trackingModal.kind === 'donation') {
        const res = await authFetch(`/api/requests/${trackingModal.id}/delivery`, {
          method: 'PATCH',
          body: JSON.stringify({
            stage: trackingModal.nextStage,
            deliveryContact: deliveryContact.trim() || undefined,
            trackingNote: trackingNote.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not update delivery stage.');
      } else {
        const res = await authFetch(`/api/receiver-requests/${trackingModal.id}/delivery`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: trackingModal.nextStage === 'Delivered' ? 'Delivered' : 'In Transit',
            deliveryContact: deliveryContact.trim() || undefined,
            trackingNote: trackingNote.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not update delivery status.');
      }
      showSuccess(`Delivery updated to ${trackingModal.nextStage}.`);
      setTrackingModal(null);
      setDeliveryContact('');
      setTrackingNote('');
      await loadNgoData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to update delivery tracking.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      portalLabel="NGO / Receiver Portal"
      title={
        section === 'browse'
          ? 'Available Food Donations'
          : section === 'requests'
            ? 'Pickup & Delivery Tracker'
            : 'Food Requested by Receiver'
      }
      navItems={navItems}
      activeSection={section}
      onSelectSection={(id) => setSection(id as typeof section)}
      primaryAction={
        <button
          type="button"
          onClick={() => {
            setEditingNeedId(null);
            setNeedForm(emptyReceiverForm(user?.address || ''));
            setShowNeedForm(true);
            setSection('receiver-needs');
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#166534] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14532D] min-h-[40px] whitespace-nowrap cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" aria-hidden="true" />
          <span>Post Food Request</span>
        </button>
      }
    >
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-5">
          <p className="text-xs font-medium text-[#4B5D51]">Available Donations</p>
          <p className="font-mono text-2xl font-semibold text-[#166534] tabular-nums mt-1">
            {stats.available}
          </p>
        </div>
        <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-5">
          <p className="text-xs font-medium text-[#4B5D51]">Pending Approval</p>
          <p className="font-mono text-2xl font-semibold text-[#B45309] tabular-nums mt-1">
            {stats.pending}
          </p>
        </div>
        <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-5">
          <p className="text-xs font-medium text-[#4B5D51]">Active Deliveries</p>
          <p className="font-mono text-2xl font-semibold text-[#1D4ED8] tabular-nums mt-1">
            {stats.inProgress}
          </p>
        </div>
        <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-5">
          <p className="text-xs font-medium text-[#4B5D51]">Completed &amp; Delivered</p>
          <p className="font-mono text-2xl font-semibold text-[#0F766E] tabular-nums mt-1">
            {stats.completed}
          </p>
        </div>
      </div>

      {/* SECTION 1: BROWSE DONOR DONATIONS */}
      {section === 'browse' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] px-4 py-3 text-xs text-[#4B5D51] flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong className="text-[#142219]">How to request food:</strong> Click{' '}
              <strong>Request Food</strong> on any available donation below, or use{' '}
              <strong>Post Food Request</strong> to tell donors what meals or groceries your NGO
              needs.
            </span>
            <button
              type="button"
              onClick={() => {
                setEditingNeedId(null);
                setNeedForm(emptyReceiverForm(user?.address || ''));
                setShowNeedForm(true);
                setSection('receiver-needs');
              }}
              className="font-semibold text-[#166534] hover:underline cursor-pointer whitespace-nowrap"
            >
              Post a Custom Food Need →
            </button>
          </div>
          <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-4 space-y-3">
            <div className="relative">
              <Search
                className="w-4 h-4 text-[#4B5D51] absolute left-3.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search available food by name, donor, or neighborhood..."
                aria-label="Search available donations"
                className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {['All', ...FOOD_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    category === cat
                      ? 'bg-[#E9F0EA] text-[#166534] border border-[#BBF7D0]'
                      : 'bg-[#FAF7F0] text-[#4B5D51] border border-[#E2DDD1] hover:text-[#142219]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] h-80 animate-pulse"
                />
              ))}
            </div>
          ) : filteredDonations.length === 0 ? (
            <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-10 text-center">
              <p className="text-sm font-medium text-[#142219]">
                No available food donations match your filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCategory('All');
                }}
                className="mt-3 rounded-lg bg-[#166534] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDonations.map((item) => {
                const alreadyRequested = activeRequestedDonationIds.has(item.id);
                return (
                  <article
                    key={item.id}
                    className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] overflow-hidden flex flex-col"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden border-b border-[#E2DDD1]">
                      <FoodMedia
                        src={getCategoryImage(item.category, item.foodName, item.imageUrl)}
                        alt={item.foodName}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs text-[#4B5D51] truncate">
                          {item.category}
                          {item.isDemo ? ' · Demo listing' : ''}
                        </span>
                        <StatusBadge status={item.status} />
                      </div>

                      <h2 className="font-display text-lg font-semibold text-[#142219] line-clamp-2">
                        {item.foodName}
                      </h2>
                      <p className="text-xs text-[#4B5D51] mt-1">
                        Donor: {item.donorOrganization || item.donorName}
                      </p>

                      <div className="mt-3 space-y-1.5 text-xs text-[#4B5D51]">
                        <div className="flex items-center gap-2">
                          <Package className="w-3.5 h-3.5 text-[#166534] shrink-0" aria-hidden="true" />
                          <span className="truncate">{item.quantity}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-[#166534] shrink-0" aria-hidden="true" />
                          <span className="truncate">{item.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-[#166534] shrink-0" aria-hidden="true" />
                          <span className="font-mono tabular-nums">Expiry: {item.expiryDate}</span>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-[#E2DDD1] flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/donations/${item.id}`)}
                          className="flex-1 rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#142219] hover:bg-[#F2EDE1] min-h-[40px] cursor-pointer"
                        >
                          Full Details
                        </button>
                        {alreadyRequested ? (
                          <button
                            type="button"
                            onClick={() => setSection('requests')}
                            className="flex-1 rounded-lg bg-[#E9F0EA] px-3 py-2 text-xs font-semibold text-[#166534] min-h-[40px] cursor-pointer"
                          >
                            Track Request
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDonation(item);
                              setPickupTime('');
                              setMessage('');
                            }}
                            className="flex-1 rounded-lg bg-[#166534] px-3 py-2 text-xs font-semibold text-white hover:bg-[#14532D] min-h-[40px] cursor-pointer"
                          >
                            Request Food
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: PICKUP & DELIVERY TRACKER */}
      {section === 'requests' && (
        <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2DDD1] flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-lg font-semibold text-[#142219]">
              Donation Pickup &amp; Delivery Tracking
            </h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {['All', 'Pending', 'Accepted', 'Rejected', 'Completed'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setRequestStatusFilter(st)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                    requestStatusFilter === st
                      ? 'bg-[#166534] text-white'
                      : 'bg-[#FAF7F0] text-[#4B5D51] hover:text-[#142219]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#4B5D51]">
              No requests found for the selected status.
            </div>
          ) : (
            <div className="divide-y divide-[#E2DDD1]">
              {filteredRequests.map((reqItem) => (
                <div key={reqItem.id} className="p-6 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/donations/${reqItem.donationId}`)}
                          className="font-display text-base font-semibold text-[#142219] hover:text-[#166534] cursor-pointer"
                        >
                          {reqItem.foodName}
                        </button>
                        <StatusBadge
                          status={
                            reqItem.status === 'Accepted'
                              ? reqItem.deliveryStage || 'Accepted'
                              : reqItem.status
                          }
                        />
                      </div>
                      <p className="text-xs text-[#4B5D51]">
                        Donor: <strong className="text-[#142219]">{reqItem.donorOrganization || reqItem.donorName}</strong> ·{' '}
                        {reqItem.location}
                        {reqItem.donorPhone ? ` · ${reqItem.donorPhone}` : ''}
                      </p>
                      <p className="text-xs text-[#4B5D51]">
                        Quantity: {reqItem.quantity} · Pickup Window: {reqItem.pickupTime}
                      </p>
                    </div>

                    {reqItem.status === 'Accepted' && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {reqItem.deliveryStage !== 'In Transit' && (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => {
                              setTrackingModal({
                                kind: 'donation',
                                id: reqItem.id,
                                title: reqItem.foodName,
                                nextStage: 'In Transit',
                              });
                              setDeliveryContact(reqItem.deliveryContact || user?.phone || '');
                              setTrackingNote('NGO courier en route to donor location.');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-xs font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE] min-h-[38px] cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Mark In Transit</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => {
                            setTrackingModal({
                              kind: 'donation',
                              id: reqItem.id,
                              title: reqItem.foodName,
                              nextStage: 'Completed',
                            });
                            setDeliveryContact(reqItem.deliveryContact || '');
                            setTrackingNote('Food collected and delivered to NGO kitchen.');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 min-h-[38px] cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Mark Delivered &amp; Completed</span>
                        </button>
                      </div>
                    )}
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

      {/* SECTION 3: FOOD REQUESTED BY RECEIVER (NGO) */}
      {section === 'receiver-needs' && (
        <div className="space-y-6">
          {showNeedForm && (
            <div className="rounded-2xl border border-[#E2DDD1] bg-[#FFFFFF] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#142219]">
                    {editingNeedId ? 'Edit Receiver Food Request' : 'Request Specific Food Needed'}
                  </h2>
                  <p className="text-xs text-[#4B5D51]">
                    Let local donors know what meals or supplies your NGO needs and track delivery.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowNeedForm(false);
                    setEditingNeedId(null);
                  }}
                  aria-label="Close form"
                  className="p-2 rounded-lg text-[#4B5D51] hover:bg-[#FAF7F0] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleNeedSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="need-food-name"
                      className="block text-sm font-medium text-[#142219] mb-1.5"
                    >
                      Food Item Needed *
                    </label>
                    <input
                      id="need-food-name"
                      type="text"
                      required
                      value={needForm.foodName}
                      onChange={(e) => setNeedForm({ ...needForm, foodName: e.target.value })}
                      placeholder="e.g., Hot Vegetarian Dinner Meals or Rice Bags"
                      className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="need-category"
                      className="block text-sm font-medium text-[#142219] mb-1.5"
                    >
                      Food Category *
                    </label>
                    <select
                      id="need-category"
                      value={needForm.category}
                      onChange={(e) => setNeedForm({ ...needForm, category: e.target.value })}
                      className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    >
                      {FOOD_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="need-qty"
                      className="block text-sm font-medium text-[#142219] mb-1.5"
                    >
                      Quantity Needed *
                    </label>
                    <input
                      id="need-qty"
                      type="text"
                      required
                      value={needForm.quantityNeeded}
                      onChange={(e) =>
                        setNeedForm({ ...needForm, quantityNeeded: e.target.value })
                      }
                      placeholder="e.g., 60 portions / 25 kg"
                      className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="need-date"
                      className="block text-sm font-medium text-[#142219] mb-1.5"
                    >
                      Needed By Date *
                    </label>
                    <input
                      id="need-date"
                      type="date"
                      required
                      value={needForm.neededByDate}
                      onChange={(e) => setNeedForm({ ...needForm, neededByDate: e.target.value })}
                      className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="need-urgency"
                      className="block text-sm font-medium text-[#142219] mb-1.5"
                    >
                      Urgency
                    </label>
                    <select
                      id="need-urgency"
                      value={needForm.urgency}
                      onChange={(e) =>
                        setNeedForm({
                          ...needForm,
                          urgency: e.target.value === 'Urgent' ? 'Urgent' : 'Standard',
                        })
                      }
                      className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    >
                      <option value="Standard">Standard</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="need-address"
                    className="block text-sm font-medium text-[#142219] mb-1.5"
                  >
                    Drop-off / Receiver Delivery Address *
                  </label>
                  <input
                    id="need-address"
                    type="text"
                    required
                    value={needForm.deliveryAddress}
                    onChange={(e) =>
                      setNeedForm({ ...needForm, deliveryAddress: e.target.value })
                    }
                    placeholder="Shelter / NGO receiving address"
                    className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="need-notes"
                    className="block text-sm font-medium text-[#142219] mb-1.5"
                  >
                    Dietary &amp; Delivery Notes *
                  </label>
                  <textarea
                    id="need-notes"
                    required
                    rows={3}
                    value={needForm.notes}
                    onChange={(e) => setNeedForm({ ...needForm, notes: e.target.value })}
                    placeholder="Share receiving hours, allergen restrictions, or meal count details..."
                    className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <FoodImagePicker
                  category={needForm.category}
                  foodName={needForm.foodName}
                  value={needForm.imageUrl}
                  onChange={(nextUrl) => setNeedForm({ ...needForm, imageUrl: nextUrl })}
                  onError={showError}
                />

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-[#166534] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] min-h-[42px] cursor-pointer"
                  >
                    {submitting
                      ? 'Saving...'
                      : editingNeedId
                        ? 'Save Request Changes'
                        : 'Publish Food Request'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNeedForm(false);
                      setEditingNeedId(null);
                    }}
                    className="rounded-lg border border-[#E2DDD1] px-4 py-2.5 text-sm font-medium text-[#4B5D51] hover:bg-[#FAF7F0] min-h-[42px] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E2DDD1] flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#142219]">
                  Our Posted Food Requests &amp; Delivery Status
                </h2>
                <p className="text-xs text-[#4B5D51]">
                  Foods requested directly by your organization from donors.
                </p>
              </div>
              {!showNeedForm && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingNeedId(null);
                    setNeedForm(emptyReceiverForm(user?.address || ''));
                    setShowNeedForm(true);
                  }}
                  className="rounded-lg bg-[#166534] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#14532D] whitespace-nowrap cursor-pointer"
                >
                  + Request Food
                </button>
              )}
            </div>

            {myReceiverRequests.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-sm font-medium text-[#142219]">
                  You haven&apos;t posted any direct food requests yet.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNeedForm(true)}
                  className="rounded-lg bg-[#166534] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  Create Your First Food Request
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#E2DDD1]">
                {myReceiverRequests.map((item) => (
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
                            Needed:{' '}
                            <strong className="text-[#142219]">{item.quantityNeeded}</strong> · By{' '}
                            <span className="font-mono tabular-nums">{item.neededByDate}</span> ·
                            Drop-off: {item.deliveryAddress}
                          </p>
                          {item.donorOrganization && (
                            <p className="text-xs text-[#166534] font-medium">
                              Fulfilling Donor: {item.donorOrganization}
                              {item.donorPhone ? ` · ${item.donorPhone}` : ''}
                            </p>
                          )}
                          <p className="text-sm text-[#4B5D51]">{item.notes}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {item.status === 'Open' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNeedId(item.id);
                                setNeedForm({
                                  foodName: item.foodName,
                                  category: item.category,
                                  quantityNeeded: item.quantityNeeded,
                                  deliveryAddress: item.deliveryAddress,
                                  neededByDate: item.neededByDate,
                                  urgency: item.urgency === 'Urgent' ? 'Urgent' : 'Standard',
                                  notes: item.notes,
                                  imageUrl: item.imageUrl || null,
                                });
                                setShowNeedForm(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-[#D6E0D8] bg-[#FAF7F0] px-3 py-1.5 text-xs font-medium text-[#142219] hover:bg-[#E9F0EA] cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Edit</span>
                            </button>
                            {confirmDeleteNeedId === item.id ? (
                              <>
                                <button
                                  type="button"
                                  disabled={submitting}
                                  onClick={() => handleDeleteNeed(item.id)}
                                  className="rounded-md bg-[#DC2626] px-3 py-1.5 text-xs font-medium text-white cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteNeedId(null)}
                                  className="rounded-md border border-[#E2DDD1] px-2.5 py-1.5 text-xs text-[#4B5D51] cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteNeedId(item.id)}
                                className="inline-flex items-center gap-1 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-1.5 text-xs font-medium text-[#B91C1C] hover:bg-[#FEE2E2] cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Delete</span>
                              </button>
                            )}
                          </>
                        )}

                        {(item.status === 'Pledged' || item.status === 'In Transit') && (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => {
                              setTrackingModal({
                                kind: 'receiver',
                                id: item.id,
                                title: item.foodName,
                                nextStage: 'Delivered',
                              });
                              setDeliveryContact(item.deliveryContact || '');
                              setTrackingNote('Received and verified at NGO drop-off location.');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Confirm Food Delivered</span>
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
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Request Food Modal (on Donor Listing) */}
      {selectedDonation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="req-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#142219]/45 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E2DDD1] bg-[#FFFFFF] p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#166534]">Request Food Donation</p>
                <h3 id="req-modal-title" className="font-display text-lg font-bold text-[#142219]">
                  {selectedDonation.foodName}
                </h3>
                <p className="text-xs text-[#4B5D51] mt-0.5">
                  {selectedDonation.quantity} · {selectedDonation.location}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDonation(null)}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-[#4B5D51] hover:bg-[#FAF7F0]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRequestSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="ngo-pickup-time"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Preferred Pickup Time *
                </label>
                <input
                  id="ngo-pickup-time"
                  type="text"
                  required
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  placeholder="e.g., Today 5:00 PM - 6:00 PM"
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div>
                <label
                  htmlFor="ngo-request-msg"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Pickup Details &amp; Message *
                </label>
                <textarea
                  id="ngo-request-msg"
                  required
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Let the donor know how your NGO will transport and distribute this food..."
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] min-h-[42px] cursor-pointer"
                >
                  {submitting ? 'Submitting...' : 'Send Food Request'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDonation(null)}
                  className="rounded-lg border border-[#E2DDD1] px-4 py-2.5 text-sm font-medium text-[#4B5D51] hover:bg-[#FAF7F0] min-h-[42px] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delivery Tracking Update Modal */}
      {trackingModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#142219]/45 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E2DDD1] bg-[#FFFFFF] p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#166534]">Update Delivery Progress</p>
                <h3 className="font-display text-lg font-bold text-[#142219]">
                  {trackingModal.title}
                </h3>
                <p className="text-xs text-[#4B5D51]">
                  Moving stage to <strong>{trackingModal.nextStage}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTrackingModal(null)}
                aria-label="Close dialog"
                className="p-1.5 rounded-lg text-[#4B5D51] hover:bg-[#FAF7F0]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTrackingSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="track-contact"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Courier / Driver Contact (optional)
                </label>
                <input
                  id="track-contact"
                  type="text"
                  value={deliveryContact}
                  onChange={(e) => setDeliveryContact(e.target.value)}
                  placeholder="e.g., Driver name & phone number"
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div>
                <label
                  htmlFor="track-note"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Delivery Tracking Note
                </label>
                <textarea
                  id="track-note"
                  rows={3}
                  value={trackingNote}
                  onChange={(e) => setTrackingNote(e.target.value)}
                  placeholder="Share ETA, handoff confirmation, or vehicle update..."
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] min-h-[42px] cursor-pointer"
                >
                  {submitting ? 'Updating...' : 'Save Delivery Update'}
                </button>
                <button
                  type="button"
                  onClick={() => setTrackingModal(null)}
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
