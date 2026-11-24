import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { PublicLayout, getDashboardPath } from '../components/PublicLayout.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useRouter } from '../context/RouterContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

export function LoginPage() {
  const { navigate } = useRouter();
  const {
    user,
    loginWithPassword,
    signInWithGoogle,
    pendingGoogleProfile,
    completeGoogleProfile,
    clearPendingGoogleProfile,
    claimAdminAccount,
  } = useAuth();
  const { showSuccess, showError } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Google first-time profile completion
  const [googleRole, setGoogleRole] = useState<'donor' | 'ngo'>('donor');
  const [googleOrg, setGoogleOrg] = useState('');
  const [googlePhone, setGooglePhone] = useState('');
  const [googleAddress, setGoogleAddress] = useState('');

  // First-run admin claim state
  const [adminStatus, setAdminStatus] = useState<{
    hasAdmin: boolean;
    passcodeConfigured: boolean;
  } | null>(null);
  const [showAdminClaim, setShowAdminClaim] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('');

  useEffect(() => {
    if (user) {
      navigate(getDashboardPath(user.role));
    }
  }, [user, navigate]);

  useEffect(() => {
    fetch('/api/auth/admin-status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setAdminStatus(data);
      })
      .catch(() => {});
  }, []);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      showError('Please enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const loggedIn = await loginWithPassword(email.trim(), password);
      showSuccess(`Welcome back, ${loggedIn.name}.`);
      navigate(getDashboardPath(loggedIn.role));
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleClick = async () => {
    setSubmitting(true);
    try {
      const result = await signInWithGoogle();
      if (result.user) {
        showSuccess(`Signed in as ${result.user.name}.`);
        navigate(getDashboardPath(result.user.role));
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleOrg.trim()) {
      showError('Please enter your organization or kitchen name.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await completeGoogleProfile({
        role: googleRole,
        organizationName: googleOrg.trim(),
        phone: googlePhone.trim(),
        address: googleAddress.trim(),
      });
      showSuccess(`Account ready. Welcome to HarvestBridge!`);
      navigate(getDashboardPath(created.role));
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to complete registration.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminName.trim().length < 2 || !adminEmail.includes('@') || adminPassword.length < 6) {
      showError('Enter a valid name, email, and password (6+ characters).');
      return;
    }
    setSubmitting(true);
    try {
      await claimAdminAccount({
        name: adminName.trim(),
        email: adminEmail.trim(),
        password: adminPassword,
        passcode: adminPasscode.trim() || undefined,
      });
      showSuccess('Administrator account created.');
      navigate('/admin');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not set up administrator.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <section className="max-w-lg mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="rounded-2xl border border-[#E2DDD1] bg-[#FFFFFF] p-6 sm:p-8">
          {pendingGoogleProfile ? (
            <form onSubmit={handleCompleteGoogle} className="space-y-4">
              <div>
                <p className="text-xs font-medium text-[#166534]">Complete Google Sign-In</p>
                <h1 className="font-display text-2xl font-bold text-[#142219] mt-1">
                  Select Your Organization Role
                </h1>
                <p className="text-sm text-[#4B5D51] mt-1">
                  Signed in as <strong>{pendingGoogleProfile.email}</strong>. Choose whether you
                  are donating food or receiving donations as an NGO.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {(['donor', 'ngo'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setGoogleRole(r)}
                    className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                      googleRole === r
                        ? 'border-[#166534] bg-[#E9F0EA] text-[#142219]'
                        : 'border-[#E2DDD1] bg-[#FAF7F0] text-[#4B5D51]'
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      {r === 'donor' ? 'Food Donor' : 'NGO Partner'}
                    </p>
                    <p className="text-xs mt-0.5 opacity-80">
                      {r === 'donor' ? 'Upload surplus food' : 'Request & collect food'}
                    </p>
                  </button>
                ))}
              </div>

              <div>
                <label
                  htmlFor="google-org"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  {googleRole === 'ngo' ? 'NGO / Charity Name *' : 'Kitchen / Store / Donor Name *'}
                </label>
                <input
                  id="google-org"
                  type="text"
                  required
                  value={googleOrg}
                  onChange={(e) => setGoogleOrg(e.target.value)}
                  placeholder="e.g., Oakwood Community Kitchen"
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="google-phone"
                    className="block text-sm font-medium text-[#142219] mb-1.5"
                  >
                    Phone Number
                  </label>
                  <input
                    id="google-phone"
                    type="tel"
                    value={googlePhone}
                    onChange={(e) => setGooglePhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="google-address"
                    className="block text-sm font-medium text-[#142219] mb-1.5"
                  >
                    City / Address
                  </label>
                  <input
                    id="google-address"
                    type="text"
                    value={googleAddress}
                    onChange={(e) => setGoogleAddress(e.target.value)}
                    placeholder="Street & neighborhood"
                    className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] min-h-[44px] cursor-pointer"
                >
                  {submitting ? 'Saving Profile...' : 'Continue to Dashboard'}
                </button>
                <button
                  type="button"
                  onClick={clearPendingGoogleProfile}
                  className="rounded-lg border border-[#E2DDD1] px-4 py-2.5 text-sm font-medium text-[#4B5D51] hover:bg-[#FAF7F0] min-h-[44px] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : showAdminClaim ? (
            <form onSubmit={handleClaimAdmin} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#166534]">System Administration</p>
                  <h1 className="font-display text-2xl font-bold text-[#142219] mt-1">
                    Set Up Admin Account
                  </h1>
                </div>
                <ShieldCheck className="w-7 h-7 text-[#166534]" aria-hidden="true" />
              </div>
              <p className="text-sm text-[#4B5D51]">
                {adminStatus?.passcodeConfigured
                  ? 'Enter your details and configured administrator passcode.'
                  : 'Create the initial administrator account for this HarvestBridge workspace.'}
              </p>

              <div>
                <label
                  htmlFor="admin-name"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Full Name *
                </label>
                <input
                  id="admin-name"
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Admin Email *
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-sm font-medium text-[#142219] mb-1.5"
                >
                  Password (min 6 characters) *
                </label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  minLength={6}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>

              {adminStatus?.passcodeConfigured && (
                <div>
                  <label
                    htmlFor="admin-passcode"
                    className="block text-sm font-medium text-[#142219] mb-1.5"
                  >
                    Administrator Passcode *
                  </label>
                  <input
                    id="admin-passcode"
                    type="password"
                    required
                    value={adminPasscode}
                    onChange={(e) => setAdminPasscode(e.target.value)}
                    className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-[#166534] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14532D] min-h-[44px] cursor-pointer"
                >
                  {submitting ? 'Creating Admin...' : 'Claim Admin Account'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdminClaim(false)}
                  className="rounded-lg border border-[#E2DDD1] px-4 py-2.5 text-sm font-medium text-[#4B5D51] hover:bg-[#FAF7F0] min-h-[44px] cursor-pointer"
                >
                  Back
                </button>
              </div>
            </form>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium text-[#166534]">Welcome Back</p>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#142219] mt-1">
                  Sign in to HarvestBridge
                </h1>
                <p className="text-sm text-[#4B5D51] mt-1">
                  Access your Donor, NGO, or Administrator dashboard.
                </p>
              </div>

              <form onSubmit={handlePasswordLogin} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-sm font-medium text-[#142219] mb-1.5"
                  >
                    Email Address *
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@organization.org"
                    className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm text-[#142219] focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-medium text-[#142219] mb-1.5"
                  >
                    Password *
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm text-[#142219] focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-[#166534] px-4 py-3 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-60 min-h-[44px] cursor-pointer"
                >
                  {submitting ? 'Signing In...' : 'Sign In'}
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
                onClick={handleGoogleClick}
                className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-4 py-2.5 text-sm font-semibold text-[#142219] hover:bg-[#F2EDE1] transition-colors min-h-[44px] cursor-pointer"
              >
                Continue with Google
              </button>

              <div className="mt-6 pt-5 border-t border-[#E2DDD1] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <p className="text-[#4B5D51]">
                  New to HarvestBridge?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="font-semibold text-[#166534] hover:underline cursor-pointer"
                  >
                    Create an account
                  </button>
                </p>

                {adminStatus && (!adminStatus.hasAdmin || adminStatus.passcodeConfigured) && (
                  <button
                    type="button"
                    onClick={() => setShowAdminClaim(true)}
                    className="text-xs font-medium text-[#4B5D51] hover:text-[#166534] underline cursor-pointer"
                  >
                    First-time Admin Setup
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
