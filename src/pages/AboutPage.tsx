import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { FoodMedia, MEDIA_ASSETS } from '../components/FoodMedia.tsx';
import { PublicLayout } from '../components/PublicLayout.tsx';
import { useRouter } from '../context/RouterContext.tsx';

export function AboutPage() {
  const { navigate } = useRouter();

  const roles = [
    {
      title: 'Food Donors',
      summary:
        'Restaurants, catering kitchens, bakeries, grocery stores, and event organizers list surplus edible food with clear quantities, pickup locations, and expiry dates.',
    },
    {
      title: 'Community NGOs',
      summary:
        'Registered shelters, food banks, and charitable outreach groups search open donations by category, send pickup requests, and track approvals through collection.',
    },
    {
      title: 'Platform Administrators',
      summary:
        'Administrators oversee registered donor and NGO accounts, monitor active and completed donations, and keep food-rescue operations accountable.',
    },
  ];

  const safeguards = [
    'Mandatory expiry date and food description on every donation listing',
    'Single-assignment approval preventing duplicate pickups for the same batch',
    'Direct donor and NGO contact visibility once a pickup request is submitted',
    'End-to-end status tracking from Available through Accepted to Completed',
  ];

  return (
    <PublicLayout>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-[#166534]">About HarvestBridge</p>
          <h1
            className="font-display text-3xl sm:text-4xl font-bold text-[#142219] mt-2"
            style={{ textWrap: 'balance' }}
          >
            Built to close the gap between surplus food and local hunger.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-[#4B5D51] leading-relaxed">
            Every day, edible meals and fresh produce are discarded simply because donors lack a
            fast, structured way to alert nearby charities. HarvestBridge provides a single
            coordination workspace for donors, NGOs, and administrators.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 rounded-2xl overflow-hidden border border-[#E2DDD1] bg-[#FFFFFF]">
            <FoodMedia
              src={MEDIA_ASSETS.delivery}
              alt="NGO outreach coordinator loading insulated food boxes into a delivery van"
              className="w-full h-full min-h-[280px]"
            />
          </div>
          <div className="lg:col-span-5 rounded-2xl border border-[#E2DDD1] bg-[#FFFFFF] p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-[#142219]">
                Our Operational Principles
              </h2>
              <p className="text-sm text-[#4B5D51] mt-2 leading-relaxed">
                Every feature in HarvestBridge is designed around speed, transparency, and food
                safety between local partners.
              </p>
              <ul className="mt-6 space-y-3.5">
                {safeguards.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[#142219]">
                    <CheckCircle2
                      className="w-4 h-4 text-[#166534] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-[#E2DDD1]">
              <button
                type="button"
                onClick={() => navigate('/available-food')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#166534] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] transition-colors min-h-[42px] cursor-pointer"
              >
                <span>Browse Available Food</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Role Breakdown */}
        <div className="mt-14">
          <h2 className="font-display text-2xl font-bold text-[#142219]">
            Three Connected Roles
          </h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {roles.map((role) => (
              <div
                key={role.title}
                className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-6"
              >
                <h3 className="font-display text-lg font-semibold text-[#166534]">
                  {role.title}
                </h3>
                <p className="mt-2 text-sm text-[#4B5D51] leading-relaxed">{role.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
