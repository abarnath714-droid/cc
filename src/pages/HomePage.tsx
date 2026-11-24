import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Calendar, MapPin, Package, PlusCircle, Utensils } from 'lucide-react';
import {
  FoodMedia,
  getCategoryImage,
  MEDIA_ASSETS,
  REAL_FOOD_GALLERY,
} from '../components/FoodMedia.tsx';
import { PublicLayout, getDashboardPath } from '../components/PublicLayout.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useRouter } from '../context/RouterContext.tsx';
import { useLiveSync } from '../hooks/useLiveSync.ts';
import type { Donation, PlatformStats } from '../types.ts';

export function HomePage() {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [featured, setFeatured] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [guideTab, setGuideTab] = useState<'add' | 'request'>('add');

  const loadData = useCallback(async () => {
    try {
      const [statsRes, donationsRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/donations?status=Available'),
      ]);
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (donationsRes.ok) {
        const data = await donationsRes.json();
        setFeatured((data.donations || []).slice(0, 3));
      }
    } catch {
      // Non-blocking initial load
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useLiveSync(loadData);

  const addFoodSteps = [
    {
      num: '01.',
      title: 'Sign In as a Donor',
      detail:
        'Register or sign in with a Donor account (restaurant, bakery, grocer, or household kitchen) to access your Donor Portal.',
    },
    {
      num: '02.',
      title: 'Add Food Details & Photo',
      detail:
        'Click Add Food Donation, enter food name, category, quantity, pickup address, expiry date, and pick or upload a real food photo.',
    },
    {
      num: '03.',
      title: 'Publish or Pledge to NGOs',
      detail:
        'Your donation appears live on Available Food immediately—or you can pledge directly to supply an open NGO receiver request.',
    },
    {
      num: '04.',
      title: 'Approve & Track Handover',
      detail:
        'Accept an NGO pickup request and update delivery stages live from Ready for Pickup to In Transit and Completed.',
    },
  ];

  const requestFoodSteps = [
    {
      num: '01.',
      title: 'Sign In as Receiver / NGO',
      detail:
        'Create or open your NGO / Receiver account to request surplus listings or post specific food needs for your community.',
    },
    {
      num: '02.',
      title: 'Request Surplus Donations',
      detail:
        'Browse Available Food, filter by category, open any listing, and click Request Food with your pickup window and transport note.',
    },
    {
      num: '03.',
      title: 'Post Custom Food Requests',
      detail:
        'Need specific meals or dry staples? Open NGO Dashboard → Post Food Request to specify quantity, drop-off address, urgency, and photo.',
    },
    {
      num: '04.',
      title: 'Track Delivery to Your Door',
      detail:
        'Follow real-time progress across Open/Pending, Pledged/Accepted, In Transit, and confirm when food is delivered.',
    },
  ];

  const activeSteps = guideTab === 'add' ? addFoodSteps : requestFoodSteps;

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 lg:pt-14 lg:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-sm font-medium text-[#166534] mb-3">
              Community Food Rescue Network
            </p>
            <h1
              className="font-display font-bold tracking-tight text-[#142219] leading-[1.08]"
              style={{ fontSize: 'clamp(2.25rem, 4vw, 3.6rem)', textWrap: 'balance' }}
            >
              Turn surplus meals into neighborhood nourishment.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-[#4B5D51] leading-relaxed max-w-xl">
              HarvestBridge connects food donors directly with local NGOs so fresh produce, cooked
              meals, and pantry goods reach families in need before they go to waste.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => navigate('/available-food')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#166534] px-5 py-3 text-sm font-semibold text-white hover:bg-[#14532D] transition-colors min-h-[44px] whitespace-nowrap cursor-pointer"
              >
                <span>Explore Available Food</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>

              {user ? (
                <button
                  type="button"
                  onClick={() => navigate(getDashboardPath(user.role))}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#D6E0D8] bg-[#FFFFFF] px-5 py-3 text-sm font-semibold text-[#142219] hover:bg-[#F2EDE1] transition-colors min-h-[44px] whitespace-nowrap cursor-pointer"
                >
                  <span>Go to My Dashboard</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#D6E0D8] bg-[#FFFFFF] px-5 py-3 text-sm font-semibold text-[#142219] hover:bg-[#F2EDE1] transition-colors min-h-[44px] whitespace-nowrap cursor-pointer"
                >
                  <span>Register as Donor or NGO</span>
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl overflow-hidden border border-[#E2DDD1] bg-[#FFFFFF] h-full min-h-[280px] lg:min-h-[420px]">
              <FoodMedia
                src={MEDIA_ASSETS.hero}
                alt="Volunteers packing fresh produce and meal boxes at a community food hub"
                className="w-full h-full lg:h-full"
              />
            </div>
          </div>
        </div>

        {/* Full-Width 4-Column Live Impact Strip */}
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-5">
            <p className="text-xs font-medium text-[#4B5D51]">Total Food Listings</p>
            <p className="font-mono text-2xl sm:text-3xl font-semibold text-[#142219] tabular-nums mt-1">
              {stats ? stats.totalDonations : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-5">
            <p className="text-xs font-medium text-[#4B5D51]">Available for Pickup</p>
            <p className="font-mono text-2xl sm:text-3xl font-semibold text-[#166534] tabular-nums mt-1">
              {stats ? stats.availableDonations : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-5">
            <p className="text-xs font-medium text-[#4B5D51]">Completed Handovers</p>
            <p className="font-mono text-2xl sm:text-3xl font-semibold text-[#142219] tabular-nums mt-1">
              {stats ? stats.completedDonations : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-5">
            <p className="text-xs font-medium text-[#4B5D51]">Registered NGOs &amp; Donors</p>
            <p className="font-mono text-2xl sm:text-3xl font-semibold text-[#142219] tabular-nums mt-1">
              {stats ? stats.totalDonors + stats.totalNgos : '—'}
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Guide: How Users Add Food & Request Food */}
      <section className="bg-[#FFFFFF] border-y border-[#E2DDD1] py-14 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-[#166534]">Step-by-Step Guide</p>
              <h2
                className="font-display text-2xl sm:text-3xl font-bold text-[#142219] mt-2"
                style={{ textWrap: 'balance' }}
              >
                How to add surplus food or request meals for your community
              </h2>
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#FAF7F0] border border-[#E2DDD1] rounded-lg self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setGuideTab('add')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  guideTab === 'add'
                    ? 'bg-[#166534] text-white'
                    : 'text-[#4B5D51] hover:text-[#142219]'
                }`}
              >
                <PlusCircle className="w-4 h-4" aria-hidden="true" />
                <span>How to Add Food</span>
              </button>
              <button
                type="button"
                onClick={() => setGuideTab('request')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  guideTab === 'request'
                    ? 'bg-[#166534] text-white'
                    : 'text-[#4B5D51] hover:text-[#142219]'
                }`}
              >
                <Utensils className="w-4 h-4" aria-hidden="true" />
                <span>How to Request Food</span>
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {activeSteps.map((step) => (
              <div
                key={step.num}
                className="rounded-xl border border-[#E2DDD1] bg-[#FAF7F0] p-6 flex flex-col"
              >
                <span className="font-mono text-sm font-semibold text-[#166534] tabular-nums">
                  {step.num}
                </span>
                <h3 className="font-display text-lg font-semibold text-[#142219] mt-2">
                  {step.title}
                </h3>
                <p className="text-sm text-[#4B5D51] leading-relaxed mt-2">{step.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E2DDD1] bg-[#FAF7F0] px-6 py-4">
            <p className="text-sm text-[#4B5D51]">
              {guideTab === 'add'
                ? 'Ready to donate cooked meals, produce, bread, or pantry staples?'
                : 'Looking to request available surplus food or post a custom NGO food need?'}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {guideTab === 'add' ? (
                <button
                  type="button"
                  onClick={() =>
                    navigate(user?.role === 'donor' ? '/donor' : user ? getDashboardPath(user.role) : '/register')
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] cursor-pointer whitespace-nowrap"
                >
                  <PlusCircle className="w-4 h-4" aria-hidden="true" />
                  <span>{user?.role === 'donor' ? 'Add Food in Donor Dashboard' : 'Start Adding Food'}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('/available-food')}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] cursor-pointer whitespace-nowrap"
                  >
                    <span>Browse &amp; Request Food</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(user?.role === 'ngo' ? '/ngo' : '/login')}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#D6E0D8] bg-[#FFFFFF] px-4 py-2.5 text-sm font-semibold text-[#142219] hover:bg-[#E9F0EA] cursor-pointer whitespace-nowrap"
                  >
                    <span>{user?.role === 'ngo' ? 'Post Custom Request' : 'NGO Sign In to Request'}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Real Food Gallery Strip */}
          <div className="mt-12">
            <div className="flex items-end justify-between gap-4 mb-5">
              <div>
                <h3 className="font-display text-xl font-bold text-[#142219]">
                  Real Food Shared Across HarvestBridge
                </h3>
                <p className="text-sm text-[#4B5D51] mt-0.5">
                  Select any food category to browse active donations and open receiver requests.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {REAL_FOOD_GALLERY.map((item) => (
                <button
                  key={item.src}
                  type="button"
                  onClick={() =>
                    navigate(`/available-food?category=${encodeURIComponent(item.category)}`)
                  }
                  className="group text-left rounded-xl border border-[#E2DDD1] bg-[#FAF7F0] overflow-hidden hover:border-[#166534] transition-colors cursor-pointer"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden border-b border-[#E2DDD1]">
                    <FoodMedia
                      src={item.src}
                      alt={item.label}
                      className="w-full h-full group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-semibold text-[#142219] line-clamp-2">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-[#166534] mt-0.5 truncate">{item.category}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Live Available Food Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#166534]">Live Listings</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#142219] mt-1">
              Currently Available Food Donations
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate('/available-food')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#166534] hover:text-[#14532D] cursor-pointer whitespace-nowrap"
          >
            <span>View all available food</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] h-80 animate-pulse"
              />
            ))}
          </div>
        ) : featured.length === 0 ? (
          <div className="mt-8 rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-10 text-center">
            <p className="text-base font-medium text-[#142219]">
              No open donations are listed right now.
            </p>
            <p className="text-sm text-[#4B5D51] mt-1">
              Register as a food donor to publish your first surplus meal listing.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {featured.map((item) => (
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

                  <h3 className="font-display text-lg font-semibold text-[#142219] line-clamp-2">
                    {item.foodName}
                  </h3>
                  <p className="text-sm text-[#4B5D51] mt-1">
                    By {item.donorOrganization || item.donorName}
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
                      <span className="font-mono tabular-nums">Best before {item.expiryDate}</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-[#E2DDD1]">
                    <button
                      type="button"
                      onClick={() => navigate(`/donations/${item.id}`)}
                      className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-4 py-2.5 text-sm font-semibold text-[#166534] hover:bg-[#E9F0EA] transition-colors min-h-[42px] cursor-pointer"
                    >
                      View Donation Details
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Conversion Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="rounded-2xl bg-[#166534] text-white p-8 sm:p-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              Ready to share surplus food or coordinate NGO pickups?
            </h2>
            <p className="text-[#E9F0EA] mt-2 text-sm sm:text-base leading-relaxed">
              Create your Donor or NGO account in under a minute and start tracking every food
              handover from listing to completion.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="rounded-lg bg-[#FFFFFF] px-5 py-3 text-sm font-semibold text-[#166534] hover:bg-[#FAF7F0] transition-colors min-h-[44px] whitespace-nowrap cursor-pointer"
            >
              Get Started
            </button>
            <button
              type="button"
              onClick={() => navigate('/contact')}
              className="rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors min-h-[44px] whitespace-nowrap cursor-pointer"
            >
              Contact Us
            </button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
