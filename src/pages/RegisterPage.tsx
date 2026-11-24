import React, { useEffect, useState } from 'react';
import { PublicLayout, getDashboardPath } from '../components/PublicLayout.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useRouter } from '../context/RouterContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

export function RegisterPage() {
  const { navigate } = useRouter();
  const { user, registerWithPassword, signInWithGoogle } = useAuth();
  const { showSuccess, showError } = useToast();

  const [role, setRole] = useState<'donor' | 'ngo'>('donor');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      navigate(getDashboardPath(user.role));
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      showError('Please enter your full name.');
      return;
    }
    if (organizationName.trim().length < 2) {
      showError(
        role === 'ngo'
          ? 'Please enter your NGO / organization name.'
          : 'Please enter your business, kitchen, or donor name.'
      );
      return;
    }
    if (!email.includes('@')) {
      showError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      showError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await registerWithPassword({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        organizationName: organizationName.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
      showSuccess(`Welcome to HarvestBridge, ${created.name}!`);
      navigate(getDashboardPath(created.role));
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to complete registration.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleRegister = async () => {
    setSubmitting(true);
    try {
      const result = await signInWithGoogle({
        role,
        organizationName: organizationName.trim() || name.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      if (result.user) {
        showSuccess(`Account ready. Welcome, ${result.user.name}!`);
        navigate(getDashboardPath(result.user.role));
      } else if (result.needsProfile) {
        navigate('/login');
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Google registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <section className="max-w-xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="rounded-2xl border border-[#E2DDD1] bg-[#FFFFFF] p-6 sm:p-8">
          <div>
            <p className="text-sm font-medium text-[#166534]">Join HarvestBridge</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#142219] mt-1">
              Create Your Account
            </h1>
            <p className="text-sm text-[#4B5D51] mt-1">
              Choose your role to start donating surplus food or requesting pickups for your NGO.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Role Selection */}
            <div>
              <span className="block text-sm font-medium text-[#142219] mb-2">
                Select Account Role *
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('donor')}
                  className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                    role === 'donor'
                      ? 'border-[#166534] bg-[#E9F0EA] text-[#142219]'
                      : 'border-[#E2DDD1] bg-[#FAF7F0] text-[#4B5D51] hover:text-[#142219]'
                  }`}
                >
                  <p className="text-sm font-semibold">Food Donor</p>
                  <p className="text-xs mt-1 opacity-85">
                    Restaurants, bakeries, markets, and caterers sharing surplus food.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('ngo')}
                  className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                    role === 'ngo'
                      ? 'border-[#166534] bg-[#E9F0EA] text-[#142219]'
                      : 'border-[#E2DDD1] bg-[#FAF7F0] text-[#4B5D51] hover:text-[#142219]'
                  }`}
                >
                  <p className="text-sm font-semibold">NGO / Food Bank</p>
                  <p className="text-xs mt-1 opacity-85">
                    Charities and shelters browsing listings and collecting food.
                  </p>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="reg-name"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Contact Full Name *
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-org"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  {role === 'ngo' ? 'NGO / Charity Name *' : 'Kitchen / Store Name *'}
                </label>
                <input
                  id="reg-org"
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder={role === 'ngo' ? 'Hope Harbor Shelter' : 'Greenfield Bistro'}
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="reg-email"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Email Address *
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="team@organization.org"
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-password"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Password (6+ chars) *
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="reg-phone"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Phone Number
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 234-5678"
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-address"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Pickup / Service Address
                </label>
                <input
                  id="reg-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="120 Greenway Ave"
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#166534] px-4 py-3 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-60 min-h-[44px] cursor-pointer"
            >
              {submitting
                ? 'Creating Account...'
                : role === 'ngo'
                  ? 'Register as NGO Partner'
                  : 'Register as Food Donor'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#E2DDD1]" />
            <span className="text-xs text-[#4B5D51]">or</span>
            <div className="h-px flex-1 bg-[#E2DDD1]" />
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={handleGoogleRegister}
            className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-4 py-2.5 text-sm font-semibold text-[#142219] hover:bg-[#F2EDE1] transition-colors min-h-[44px] cursor-pointer"
          >
            Register with Google ({role === 'ngo' ? 'NGO' : 'Donor'})
          </button>

          <p className="mt-6 pt-5 border-t border-[#E2DDD1] text-center text-sm text-[#4B5D51]">
            Already registered?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="font-semibold text-[#166534] hover:underline cursor-pointer"
            >
              Sign in here
            </button>
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
