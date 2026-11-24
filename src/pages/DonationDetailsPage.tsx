import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  MapPin,
  Package,
  Phone,
  Truck,
  User as UserIcon,
} from 'lucide-react';
import { DeliveryTracker } from '../components/DeliveryTracker.tsx';
import { FoodMedia, getCategoryImage } from '../components/FoodMedia.tsx';
import { PublicLayout, getDashboardPath } from '../components/PublicLayout.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useRouter } from '../context/RouterContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { useLiveSync } from '../hooks/useLiveSync.ts';
import type { Donation, DonationRequest } from '../types.ts';

export function DonationDetailsPage({ donationId }: { donationId: number }) {
  const { navigate } = useRouter();
  const { user, authFetch } = useAuth();
  const { showSuccess, showError } = useToast();

  const [donation, setDonation] = useState<Donation | null>(null);
  const [userRequest, setUserRequest] = useState<DonationRequest | null>(null);
  const [requests, setRequests] = useState<DonationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pickupTime, setPickupTime] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadDetails = useCallback(async () => {
    try {
      setError(null);
      const res = await authFetch(`/api/donations/${donationId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to load donation details.');
      }
      setDonation(data.donation);
      setUserRequest(data.userRequest || null);
      setRequests(data.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load donation details.');
    } finally {
      setLoading(false);
    }
  }, [authFetch, donationId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  useLiveSync(loadDetails);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupTime.trim() || message.trim().length < 5) {
      showError('Please enter a pickup window and a brief note (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authFetch('/api/requests', {
        method: 'POST',
        body: JSON.stringify({
          donationId,
          pickupTime: pickupTime.trim(),
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not submit food request.');
      }
      showSuccess('Food request sent to the donor.');
      setPickupTime('');
      setMessage('');
      await loadDetails();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not submit food request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvanceDelivery = async (
    requestId: number,
    stage: 'Ready for Pickup' | 'In Transit' | 'Completed'
  ) => {
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/requests/${requestId}/delivery`, {
        method: 'PATCH',
        body: JSON.stringify({ stage }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to update delivery stage.');
      }
      showSuccess(`Delivery stage updated to ${stage}.`);
      await loadDetails();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to update delivery stage.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDonorDecision = async (requestId: number, decision: 'Accepted' | 'Rejected') => {
    setSubmitting(true);
    try {
      const res = await authFetch(`/api/requests/${requestId}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to update request status.');
      }
      showSuccess(`Request ${decision.toLowerCase()}.`);
      await loadDetails();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to update request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <button
          type="button"
          onClick={() => navigate('/available-food')}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#4B5D51] hover:text-[#166534] mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Available Food</span>
        </button>

        {loading ? (
          <div className="rounded-2xl border border-[#E2DDD1] bg-[#FFFFFF] h-96 animate-pulse" />
        ) : error || !donation ? (
          <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-8 text-center">
            <h1 className="font-display text-xl font-bold text-[#991B1B]">
              {error || 'Donation not found'}
            </h1>
            <button
              type="button"
              onClick={() => navigate('/available-food')}
              className="mt-4 rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white cursor-pointer"
            >
              Browse Available Food
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Detail Column */}
            <div className="lg:col-span-7 rounded-2xl border border-[#E2DDD1] bg-[#FFFFFF] overflow-hidden">
              <div className="aspect-[16/10] w-full overflow-hidden border-b border-[#E2DDD1]">
                <FoodMedia
                  src={getCategoryImage(donation.category, donation.foodName, donation.imageUrl)}
                  alt={donation.foodName}
                  className="w-full h-full"
                />
              </div>

              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-[#4B5D51]">
                    {donation.category}
                    {donation.isDemo ? ' · Demo listing' : ''}
                  </span>
                  <StatusBadge status={donation.status} />
                </div>

                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#142219] mt-3">
                  {donation.foodName}
                </h1>

                <p className="mt-4 text-base text-[#4B5D51] leading-relaxed">
                  {donation.description}
                </p>

                <div className="mt-6 pt-6 border-t border-[#E2DDD1] grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start gap-3">
                    <Package className="w-4 h-4 text-[#166534] mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-[#4B5D51]">Quantity</p>
                      <p className="font-medium text-[#142219]">{donation.quantity}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-[#166534] mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-[#4B5D51]">Expiry / Best Before</p>
                      <p className="font-mono font-medium text-[#142219] tabular-nums">
                        {donation.expiryDate}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-[#166534] mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-[#4B5D51]">Pickup Location</p>
                      <p className="font-medium text-[#142219]">{donation.location}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <UserIcon className="w-4 h-4 text-[#166534] mt-0.5 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-xs text-[#4B5D51]">Donor</p>
                      <p className="font-medium text-[#142219]">
                        {donation.donorOrganization || donation.donorName}
                      </p>
                      {donation.donorPhone && (
                        <p className="text-xs text-[#4B5D51] flex items-center gap-1 mt-0.5 font-mono">
                          <Phone className="w-3 h-3" aria-hidden="true" />
                          {donation.donorPhone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Action / Delivery Tracking Panel */}
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-2xl border border-[#E2DDD1] bg-[#FFFFFF] p-6 sm:p-8">
                <h2 className="font-display text-xl font-bold text-[#142219]">
                  Pickup &amp; Delivery Tracking
                </h2>

                {!user ? (
                  <div className="mt-4">
                    <p className="text-sm text-[#4B5D51] leading-relaxed">
                      Sign in with an NGO account to request this food donation and track delivery
                      from approval to completion.
                    </p>
                    <div className="mt-5 flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="flex-1 rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] min-h-[42px] cursor-pointer"
                      >
                        Sign In to Request
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/register')}
                        className="flex-1 rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-4 py-2.5 text-sm font-semibold text-[#142219] hover:bg-[#F2EDE1] min-h-[42px] cursor-pointer"
                      >
                        Register NGO
                      </button>
                    </div>
                  </div>
                ) : user.role === 'ngo' ? (
                  <div className="mt-4">
                    {userRequest ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-[#E2DDD1] bg-[#FAF7F0] p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-[#4B5D51]">
                              Your Request Status
                            </span>
                            <StatusBadge
                              status={
                                userRequest.status === 'Accepted'
                                  ? userRequest.deliveryStage || 'Accepted'
                                  : userRequest.status
                              }
                            />
                          </div>
                          <p className="text-sm text-[#142219] font-medium">
                            Pickup Window: {userRequest.pickupTime}
                          </p>
                          <p className="text-sm text-[#4B5D51]">{userRequest.message}</p>
                        </div>

                        <DeliveryTracker
                          variant="donation"
                          currentStage={userRequest.deliveryStage || userRequest.status}
                          deliveryContact={userRequest.deliveryContact}
                          trackingNote={userRequest.trackingNote}
                          dispatchedAt={userRequest.dispatchedAt}
                          deliveredAt={userRequest.deliveredAt}
                        />

                        {userRequest.status === 'Accepted' && (
                          <div className="flex flex-col gap-2">
                            {userRequest.deliveryStage !== 'In Transit' && (
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => handleAdvanceDelivery(userRequest.id, 'In Transit')}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-2.5 text-sm font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE] min-h-[42px] cursor-pointer"
                              >
                                <Truck className="w-4 h-4" aria-hidden="true" />
                                <span>Mark In Transit</span>
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleAdvanceDelivery(userRequest.id, 'Completed')}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#166534] px-4 py-3 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-60 min-h-[44px] cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                              <span>
                                {submitting ? 'Updating...' : 'Mark Food Delivered & Completed'}
                              </span>
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => navigate('/ngo')}
                          className="w-full rounded-lg border border-[#D6E0D8] bg-[#FFFFFF] px-4 py-2.5 text-sm font-medium text-[#166534] hover:bg-[#FAF7F0] cursor-pointer"
                        >
                          Open NGO Dashboard
                        </button>
                      </div>
                    ) : donation.status !== 'Available' ? (
                      <div className="rounded-xl border border-[#E2DDD1] bg-[#FAF7F0] p-4 text-sm text-[#4B5D51]">
                        This donation is currently marked as <strong>{donation.status}</strong> and is
                        no longer open for new requests.
                      </div>
                    ) : (
                      <form onSubmit={handleRequestSubmit} className="space-y-4">
                        <div>
                          <label
                            htmlFor="pickup-time"
                            className="block text-sm font-medium text-[#142219] mb-1.5"
                          >
                            Preferred Pickup Window *
                          </label>
                          <input
                            id="pickup-time"
                            type="text"
                            required
                            value={pickupTime}
                            onChange={(e) => setPickupTime(e.target.value)}
                            placeholder="e.g., Today, 3:30 PM - 4:30 PM"
                            className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm text-[#142219] focus:outline-none focus:ring-2 focus:ring-[#166534]"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="request-message"
                            className="block text-sm font-medium text-[#142219] mb-1.5"
                          >
                            Note for Donor *
                          </label>
                          <textarea
                            id="request-message"
                            required
                            rows={3}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Share transport details, container needs, or contact instructions..."
                            className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm text-[#142219] focus:outline-none focus:ring-2 focus:ring-[#166534]"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full rounded-lg bg-[#166534] px-4 py-3 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-60 min-h-[44px] cursor-pointer"
                        >
                          {submitting ? 'Sending Request...' : 'Send Food Request'}
                        </button>
                      </form>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <p className="text-sm text-[#4B5D51]">
                      Signed in as <strong className="capitalize">{user.role}</strong>.{' '}
                      {user.id === donation.donorId || user.role === 'admin'
                        ? 'Review requests and update delivery progress below or in your dashboard.'
                        : 'Only registered NGO accounts can submit pickup requests.'}
                    </p>

                    {(user.id === donation.donorId || user.role === 'admin') &&
                      requests.length > 0 && (
                        <div className="space-y-4 pt-2">
                          <h3 className="text-sm font-semibold text-[#142219]">
                            Requests for This Donation ({requests.length})
                          </h3>
                          {requests.map((reqItem) => (
                            <div
                              key={reqItem.id}
                              className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-4 space-y-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-[#142219]">
                                  {reqItem.ngoOrganization || reqItem.ngoName}
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
                                Pickup: {reqItem.pickupTime}
                              </p>
                              <p className="text-sm text-[#4B5D51]">{reqItem.message}</p>

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

                              {reqItem.status === 'Pending' && (
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => handleDonorDecision(reqItem.id, 'Accepted')}
                                    className="flex-1 rounded-lg bg-[#166534] px-3 py-2 text-xs font-semibold text-white hover:bg-[#14532D] cursor-pointer"
                                  >
                                    Accept Request
                                  </button>
                                  <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => handleDonorDecision(reqItem.id, 'Rejected')}
                                    className="flex-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEE2E2] cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}

                              {reqItem.status === 'Accepted' && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {reqItem.deliveryStage === 'Accepted' && (
                                    <button
                                      type="button"
                                      disabled={submitting}
                                      onClick={() =>
                                        handleAdvanceDelivery(reqItem.id, 'Ready for Pickup')
                                      }
                                      className="flex-1 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-xs font-semibold text-[#B45309] cursor-pointer"
                                    >
                                      Ready for Pickup
                                    </button>
                                  )}
                                  {reqItem.deliveryStage !== 'In Transit' && (
                                    <button
                                      type="button"
                                      disabled={submitting}
                                      onClick={() => handleAdvanceDelivery(reqItem.id, 'In Transit')}
                                      className="flex-1 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-xs font-semibold text-[#1D4ED8] cursor-pointer"
                                    >
                                      In Transit
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => handleAdvanceDelivery(reqItem.id, 'Completed')}
                                    className="w-full rounded-lg bg-[#0F766E] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 cursor-pointer"
                                  >
                                    Mark Delivered &amp; Completed
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                    <button
                      type="button"
                      onClick={() => navigate(getDashboardPath(user.role))}
                      className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-4 py-2.5 text-sm font-semibold text-[#166534] hover:bg-[#E9F0EA] cursor-pointer"
                    >
                      Go to Dashboard
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
