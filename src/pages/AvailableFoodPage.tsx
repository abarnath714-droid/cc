import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, HelpCircle, MapPin, Package, PlusCircle, Search, Utensils } from 'lucide-react';
import { DeliveryTracker } from '../components/DeliveryTracker.tsx';
import { FoodMedia, getCategoryImage } from '../components/FoodMedia.tsx';
import { PublicLayout } from '../components/PublicLayout.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useRouter } from '../context/RouterContext.tsx';
import { useLiveSync } from '../hooks/useLiveSync.ts';
import { FOOD_CATEGORIES, type Donation, type ReceiverRequest } from '../types.ts';

export function AvailableFoodPage() {
  const { navigate, search: urlSearch } = useRouter();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'donations' | 'receiver-requests'>('donations');
  const [donations, setDonations] = useState<Donation[]>([]);
  const [receiverRequests, setReceiverRequests] = useState<ReceiverRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'Available' | 'All'>('Available');
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(urlSearch);
    const catParam = params.get('category');
    if (catParam && (catParam === 'All' || (FOOD_CATEGORIES as readonly string[]).includes(catParam))) {
      setCategory(catParam);
    }
    const tabParam = params.get('tab');
    if (tabParam === 'receiver-requests') {
      setViewMode('receiver-requests');
    }
  }, [urlSearch]);

  const fetchMarketplace = useCallback(async () => {
    try {
      setError(null);
      const [donRes, recRes] = await Promise.all([
        fetch('/api/donations'),
        fetch('/api/receiver-requests'),
      ]);
      const donData = await donRes.json();
      const recData = await recRes.json();
      if (!donRes.ok) {
        throw new Error(donData.error || 'Failed to load food donations.');
      }
      setDonations(donData.donations || []);
      setReceiverRequests(recRes.ok ? recData.receiverRequests || [] : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load food marketplace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketplace();
  }, [fetchMarketplace]);

  useLiveSync(fetchMarketplace);

  const filteredDonations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return donations.filter((item) => {
      if (statusFilter === 'Available' && item.status !== 'Available') return false;
      if (category !== 'All' && item.category !== category) return false;
      if (!q) return true;
      return (
        item.foodName.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.donorOrganization || item.donorName).toLowerCase().includes(q)
      );
    });
  }, [donations, search, category, statusFilter]);

  const filteredReceiverRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return receiverRequests.filter((item) => {
      if (statusFilter === 'Available' && item.status !== 'Open') return false;
      if (category !== 'All' && item.category !== category) return false;
      if (!q) return true;
      return (
        item.foodName.toLowerCase().includes(q) ||
        item.deliveryAddress.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q) ||
        (item.ngoOrganization || item.ngoName).toLowerCase().includes(q)
      );
    });
  }, [receiverRequests, search, category, statusFilter]);

  return (
    <PublicLayout>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#166534]">Food Marketplace</p>
            <h1 className="font-display text-3xl font-bold text-[#142219] mt-1">
              {viewMode === 'donations'
                ? 'Available Food Donations'
                : 'Food Requested by Receivers'}
            </h1>
            <p className="text-sm sm:text-base text-[#4B5D51] mt-1">
              {viewMode === 'donations'
                ? 'Search surplus meals and produce ready for pickup by registered NGOs.'
                : 'Browse specific food requested by community NGOs and track fulfillment delivery.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Switch between Donor Uploads & Receiver Requests */}
            <div className="flex items-center gap-1 p-1 bg-[#FFFFFF] border border-[#E2DDD1] rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('donations')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  viewMode === 'donations'
                    ? 'bg-[#166534] text-white'
                    : 'text-[#4B5D51] hover:text-[#142219]'
                }`}
              >
                Surplus Donations ({donations.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('receiver-requests')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  viewMode === 'receiver-requests'
                    ? 'bg-[#166534] text-white'
                    : 'text-[#4B5D51] hover:text-[#142219]'
                }`}
              >
                Requested by NGOs ({receiverRequests.length})
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#FFFFFF] border border-[#E2DDD1] rounded-lg">
              <button
                type="button"
                onClick={() => setStatusFilter('Available')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === 'Available'
                    ? 'bg-[#E9F0EA] text-[#166534]'
                    : 'text-[#4B5D51] hover:text-[#142219]'
                }`}
              >
                {viewMode === 'donations' ? 'Available Only' : 'Open Only'}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('All')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === 'All'
                    ? 'bg-[#E9F0EA] text-[#166534]'
                    : 'text-[#4B5D51] hover:text-[#142219]'
                }`}
              >
                All Statuses
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions & How Users Add / Request Food */}
        <div className="mt-6 rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-[#166534] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-[#142219]">
                  Want to donate surplus food or submit a food request?
                </p>
                <p className="text-xs text-[#4B5D51] mt-0.5">
                  Donors add surplus listings with real food photos; NGOs request available food or
                  post custom receiver needs.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowHowTo((prev) => !prev)}
                className="rounded-lg border border-[#E2DDD1] bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#142219] hover:bg-[#E9F0EA] cursor-pointer whitespace-nowrap"
              >
                {showHowTo ? 'Hide Steps' : 'How to Add & Request'}
              </button>
              <button
                type="button"
                onClick={() => navigate(user?.role === 'donor' ? '/donor' : '/register')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#166534] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#14532D] cursor-pointer whitespace-nowrap"
              >
                <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Food</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(user?.role === 'ngo' ? '/ngo' : '/login')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#166534] bg-[#FFFFFF] px-3.5 py-2 text-xs font-semibold text-[#166534] hover:bg-[#E9F0EA] cursor-pointer whitespace-nowrap"
              >
                <Utensils className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Post Receiver Request</span>
              </button>
            </div>
          </div>

          {showHowTo && (
            <div className="mt-4 pt-4 border-t border-[#E2DDD1] grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#4B5D51]">
              <div className="rounded-lg bg-[#FAF7F0] p-4 space-y-1.5">
                <p className="font-semibold text-[#142219] text-sm">
                  1. How Donors Add Food
                </p>
                <p>
                  Sign in as a Donor and open <strong>Add Food Donation</strong>. Enter the food
                  name, category, quantity, pickup address, expiry date, and pick or upload a real
                  food photo. Once published, NGOs can request pickup right away.
                </p>
              </div>
              <div className="rounded-lg bg-[#FAF7F0] p-4 space-y-1.5">
                <p className="font-semibold text-[#142219] text-sm">
                  2. How Receivers / NGOs Request Food
                </p>
                <p>
                  Click <strong>View Details &amp; Request</strong> on any available donation below to
                  book a pickup window, OR switch to <strong>Requested by NGOs</strong> and use your
                  NGO Dashboard to post a custom food request with delivery tracking.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Search & Category Filters */}
        <div className="mt-4 rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-4 space-y-4">
          <div className="relative">
            <Search
              className="w-4 h-4 text-[#4B5D51] absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                viewMode === 'donations'
                  ? 'Search by food name, donor organization, or pickup area...'
                  : 'Search by requested food, NGO name, or delivery neighborhood...'
              }
              aria-label="Search food listings"
              className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] pl-10 pr-4 py-2.5 text-sm text-[#142219] placeholder:text-[#4B5D51]/70 focus:outline-none focus:ring-2 focus:ring-[#166534]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {['All', ...FOOD_CATEGORIES].map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#E9F0EA] text-[#166534] border border-[#BBF7D0]'
                      : 'bg-[#FAF7F0] text-[#4B5D51] border border-[#E2DDD1] hover:text-[#142219]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] h-96 animate-pulse"
              />
            ))}
          </div>
        ) : viewMode === 'donations' ? (
          filteredDonations.length === 0 ? (
            <div className="mt-8 rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-12 text-center">
              <h2 className="font-display text-lg font-semibold text-[#142219]">
                No matching food donations found
              </h2>
              <p className="text-sm text-[#4B5D51] mt-1">
                Try clearing your search query or selecting another food category.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCategory('All');
                  setStatusFilter('All');
                }}
                className="mt-4 rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white hover:bg-[#14532D] cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDonations.map((item) => (
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

                    <p className="text-sm text-[#4B5D51] mt-3 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="mt-4 space-y-1.5 text-xs text-[#4B5D51]">
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

                    <div className="mt-5 pt-4 border-t border-[#E2DDD1]">
                      <button
                        type="button"
                        onClick={() => navigate(`/donations/${item.id}`)}
                        className="w-full rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] transition-colors min-h-[42px] cursor-pointer"
                      >
                        {item.status === 'Available' ? 'View Details & Request' : 'View Details'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : filteredReceiverRequests.length === 0 ? (
          <div className="mt-8 rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-12 text-center">
            <h2 className="font-display text-lg font-semibold text-[#142219]">
              No matching receiver food requests found
            </h2>
            <p className="text-sm text-[#4B5D51] mt-1">
              NGOs can post direct food requests from their NGO Dashboard.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredReceiverRequests.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[16/9] w-full overflow-hidden border-b border-[#E2DDD1]">
                    <FoodMedia
                      src={getCategoryImage(item.category, item.foodName, item.imageUrl)}
                      alt={item.foodName}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="p-6 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[#4B5D51]">
                        {item.category} · {item.urgency}
                        {item.isDemo ? ' · Demo request' : ''}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>

                    <div>
                      <h2 className="font-display text-lg font-semibold text-[#142219]">
                        {item.foodName}
                      </h2>
                      <p className="text-xs text-[#4B5D51] mt-1">
                        Requested by{' '}
                        <strong className="text-[#142219]">
                          {item.ngoOrganization || item.ngoName}
                        </strong>
                      </p>
                    </div>

                    <p className="text-sm text-[#4B5D51] leading-relaxed">{item.notes}</p>

                    <div className="space-y-1.5 text-xs text-[#4B5D51]">
                      <div className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-[#166534] shrink-0" aria-hidden="true" />
                        <span>Quantity needed: {item.quantityNeeded}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#166534] shrink-0" aria-hidden="true" />
                        <span>Deliver to: {item.deliveryAddress}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-[#166534] shrink-0" aria-hidden="true" />
                        <span className="font-mono tabular-nums">Needed by {item.neededByDate}</span>
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
                </div>

                <div className="px-6 pb-6 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(user?.role === 'donor' ? '/donor' : user?.role === 'ngo' ? '/ngo' : '/login')
                    }
                    className="w-full rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] min-h-[42px] cursor-pointer"
                  >
                    {user?.role === 'donor'
                      ? 'Fulfill in Donor Dashboard'
                      : user?.role === 'ngo'
                        ? 'Manage in NGO Dashboard'
                        : 'Sign In as Donor to Fulfill'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
