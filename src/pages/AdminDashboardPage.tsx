import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  LayoutDashboard,
  Mail,
  Package,
  Trash2,
  Truck,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { DashboardLayout, type SidebarNavItem } from '../components/DashboardLayout.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useRouter } from '../context/RouterContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { useLiveSync } from '../hooks/useLiveSync.ts';
import type {
  ContactMessage,
  Donation,
  DonationRequest,
  PlatformStats,
  ReceiverRequest,
  User,
} from '../types.ts';

export function AdminDashboardPage() {
  const { user: currentUser, authFetch } = useAuth();
  const { navigate } = useRouter();
  const { showSuccess, showError } = useToast();

  const [section, setSection] = useState<
    'overview' | 'users' | 'donations' | 'requests' | 'receiver-requests' | 'messages'
  >('overview');
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [requests, setRequests] = useState<DonationRequest[]>([]);
  const [receiverRequests, setReceiverRequests] = useState<ReceiverRequest[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [roleFilter, setRoleFilter] = useState<'all' | 'donor' | 'ngo' | 'admin'>('all');
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<number | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/overview');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load admin overview.');
      }
      setStats(data.stats);
      setUsers(data.users || []);
      setDonations(data.donations || []);
      setRequests(data.requests || []);
      setReceiverRequests(data.receiverRequests || []);
      setMessages(data.messages || []);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to load admin data.');
    } finally {
      setLoading(false);
    }
  }, [authFetch, showError]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useLiveSync(loadOverview);

  const filteredUsers = useMemo(() => {
    if (roleFilter === 'all') return users;
    return users.filter((u) => u.role === roleFilter);
  }, [users, roleFilter]);

  const navItems: SidebarNavItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'users', label: 'Donor & NGO Accounts', icon: Users, badgeCount: users.length },
    { id: 'donations', label: 'All Donations', icon: Package, badgeCount: donations.length },
    {
      id: 'requests',
      label: 'Pickup & Delivery Logs',
      icon: Truck,
      badgeCount: stats?.pendingRequests ?? 0,
    },
    {
      id: 'receiver-requests',
      label: 'Receiver Food Needs',
      icon: ClipboardList,
      badgeCount: receiverRequests.length,
    },
    { id: 'messages', label: 'Contact Inquiries', icon: Mail, badgeCount: messages.length },
  ];

  const handleToggleUserStatus = async (target: User) => {
    const nextStatus = target.status === 'active' ? 'suspended' : 'active';
    setBusy(true);
    try {
      const res = await authFetch(`/api/admin/users/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not update account status.');
      }
      showSuccess(`${target.name} marked as ${nextStatus}.`);
      await loadOverview();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to update user status.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    setBusy(true);
    try {
      const res = await authFetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not delete user.');
      }
      showSuccess('User account deleted.');
      setConfirmDeleteUserId(null);
      await loadOverview();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to delete user.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDonation = async (donationId: number) => {
    setBusy(true);
    try {
      const res = await authFetch(`/api/donations/${donationId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not delete donation.');
      }
      showSuccess('Donation record removed.');
      await loadOverview();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to remove donation.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteReceiverRequest = async (id: number) => {
    setBusy(true);
    try {
      const res = await authFetch(`/api/receiver-requests/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not delete receiver request.');
      }
      showSuccess('Receiver food request removed.');
      await loadOverview();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to remove request.');
    } finally {
      setBusy(false);
    }
  };

  const handleDemoAction = async (action: 'seed' | 'clear') => {
    setBusy(true);
    try {
      const res = await authFetch('/api/admin/demo-data', {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Demo data update failed.');
      }
      showSuccess(action === 'clear' ? 'Demo listings cleared.' : 'Sample demo listings loaded.');
      await loadOverview();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Demo data action failed.');
    } finally {
      setBusy(false);
    }
  };

  const hasDemoItems = useMemo(
    () =>
      donations.some((d) => d.isDemo) ||
      users.some((u) => u.isDemo) ||
      receiverRequests.some((r) => r.isDemo),
    [donations, users, receiverRequests]
  );

  return (
    <DashboardLayout
      portalLabel="Admin Console"
      title={
        section === 'users'
          ? 'Manage Donor & NGO Accounts'
          : section === 'donations'
            ? 'All Food Donations'
            : section === 'requests'
              ? 'Pickup & Delivery Logs'
              : section === 'receiver-requests'
                ? 'Food Requested by Receivers'
                : section === 'messages'
                  ? 'Contact Form Inquiries'
                  : 'Platform Administration Overview'
      }
      navItems={navItems}
      activeSection={section}
      onSelectSection={(id) => setSection(id as typeof section)}
      primaryAction={
        hasDemoItems ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => handleDemoAction('clear')}
            className="rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2 text-xs font-semibold text-[#142219] hover:bg-[#F2EDE1] whitespace-nowrap cursor-pointer"
          >
            Clear Demo Data
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => handleDemoAction('seed')}
            className="rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2 text-xs font-semibold text-[#166534] hover:bg-[#E9F0EA] whitespace-nowrap cursor-pointer"
          >
            Load Sample Demo Data
          </button>
        )
      }
    >
      {/* Top KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-5">
          <p className="text-xs font-medium text-[#4B5D51]">Total Registered Users</p>
          <p className="font-mono text-2xl font-semibold text-[#142219] tabular-nums mt-1">
            {stats ? stats.totalUsers : '—'}
          </p>
          {stats && (
            <p className="text-xs text-[#4B5D51] mt-1 tabular-nums">
              {stats.totalDonors} Donors · {stats.totalNgos} NGOs
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-5">
          <p className="text-xs font-medium text-[#4B5D51]">Total Donations</p>
          <p className="font-mono text-2xl font-semibold text-[#166534] tabular-nums mt-1">
            {stats ? stats.totalDonations : '—'}
          </p>
          {stats && (
            <p className="text-xs text-[#4B5D51] mt-1 tabular-nums">
              {stats.availableDonations} Available · {stats.completedDonations} Completed
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-5">
          <p className="text-xs font-medium text-[#4B5D51]">Pending Requests</p>
          <p className="font-mono text-2xl font-semibold text-[#B45309] tabular-nums mt-1">
            {stats ? stats.pendingRequests : '—'}
          </p>
          {stats && (
            <p className="text-xs text-[#4B5D51] mt-1 tabular-nums">
              {stats.totalRequests} Pickup Requests
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-5">
          <p className="text-xs font-medium text-[#4B5D51]">Receiver Food Needs</p>
          <p className="font-mono text-2xl font-semibold text-[#0F766E] tabular-nums mt-1">
            {stats ? stats.totalReceiverRequests ?? receiverRequests.length : '—'}
          </p>
          {stats && (
            <p className="text-xs text-[#4B5D51] mt-1 tabular-nums">
              {stats.openReceiverRequests ?? 0} Open Needs
            </p>
          )}
        </div>
      </div>

      {/* Users Management */}
      {(section === 'overview' || section === 'users') && (
        <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-[#E2DDD1] flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-lg font-semibold text-[#142219]">
              Registered Accounts
            </h2>
            <div className="flex items-center gap-1.5">
              {(['all', 'donor', 'ngo', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize cursor-pointer ${
                    roleFilter === r
                      ? 'bg-[#166534] text-white'
                      : 'bg-[#FAF7F0] text-[#4B5D51] hover:text-[#142219]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-[#4B5D51]">Loading user accounts...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#4B5D51]">No accounts found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2DDD1] bg-[#FAF7F0] text-xs font-semibold text-[#4B5D51]">
                    <th className="py-3 px-4">User &amp; Organization</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2DDD1] text-sm">
                  {filteredUsers.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    return (
                      <tr key={u.id} className="hover:bg-[#FAF7F0]/60">
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-[#142219]">
                            {u.organizationName || u.name}
                            {u.isDemo ? ' · Demo account' : ''}
                          </p>
                          <p className="text-xs text-[#4B5D51]">
                            {u.name} · {u.email}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium capitalize text-[#142219]">
                          {u.role}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={u.status} />
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {isSelf ? (
                            <span className="text-xs text-[#4B5D51]">Current Admin</span>
                          ) : (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleToggleUserStatus(u)}
                                className="inline-flex items-center gap-1 rounded-md border border-[#D6E0D8] bg-[#FAF7F0] px-2.5 py-1.5 text-xs font-medium text-[#142219] hover:bg-[#E9F0EA] cursor-pointer"
                              >
                                {u.status === 'active' ? (
                                  <>
                                    <UserX className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Suspend</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Activate</span>
                                  </>
                                )}
                              </button>

                              {confirmDeleteUserId === u.id ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleDeleteUser(u.id)}
                                    className="rounded-md bg-[#DC2626] px-2.5 py-1.5 text-xs font-medium text-white cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteUserId(null)}
                                    className="rounded-md border border-[#E2DDD1] px-2 py-1.5 text-xs text-[#4B5D51] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteUserId(u.id)}
                                  className="inline-flex items-center gap-1 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1.5 text-xs font-medium text-[#B91C1C] hover:bg-[#FEE2E2] cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Donations Monitor */}
      {(section === 'overview' || section === 'donations') && (
        <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-[#E2DDD1] flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[#142219]">
              All Donation Records
            </h2>
            <span className="font-mono text-xs text-[#4B5D51] tabular-nums">
              {donations.length} records
            </span>
          </div>

          {donations.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#4B5D51]">No donations recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2DDD1] bg-[#FAF7F0] text-xs font-semibold text-[#4B5D51]">
                    <th className="py-3 px-4">Food Item</th>
                    <th className="py-3 px-4">Donor</th>
                    <th className="py-3 px-4">Quantity</th>
                    <th className="py-3 px-4">Expiry</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2DDD1] text-sm">
                  {donations.map((d) => (
                    <tr key={d.id} className="hover:bg-[#FAF7F0]/60">
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/donations/${d.id}`)}
                          className="font-semibold text-[#142219] hover:text-[#166534] text-left cursor-pointer"
                        >
                          {d.foodName}
                        </button>
                        <p className="text-xs text-[#4B5D51]">
                          {d.category}
                          {d.isDemo ? ' · Demo listing' : ''}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#4B5D51]">
                        {d.donorOrganization || d.donorName}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#4B5D51] whitespace-nowrap">
                        {d.quantity}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-[#4B5D51] tabular-nums whitespace-nowrap">
                        {d.expiryDate}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDeleteDonation(d.id)}
                          className="text-xs font-medium text-[#B91C1C] hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* All Pickup & Delivery Logs */}
      {section === 'requests' && (
        <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2DDD1] flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[#142219]">
              Pickup &amp; Delivery Tracking Logs
            </h2>
            <span className="font-mono text-xs text-[#4B5D51] tabular-nums">
              {requests.length} requests
            </span>
          </div>

          {requests.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#4B5D51]">
              No donation requests submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2DDD1] bg-[#FAF7F0] text-xs font-semibold text-[#4B5D51]">
                    <th className="py-3 px-4">Food Donation</th>
                    <th className="py-3 px-4">Donor</th>
                    <th className="py-3 px-4">NGO</th>
                    <th className="py-3 px-4">Delivery Stage</th>
                    <th className="py-3 px-4">Tracking Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2DDD1] text-sm">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-[#FAF7F0]/60">
                      <td className="py-3.5 px-4 font-semibold text-[#142219]">{r.foodName}</td>
                      <td className="py-3.5 px-4 text-xs text-[#4B5D51]">
                        {r.donorOrganization || r.donorName}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#4B5D51]">
                        {r.ngoOrganization || r.ngoName}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge
                          status={r.status === 'Accepted' ? r.deliveryStage || 'Accepted' : r.status}
                        />
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#4B5D51]">
                        {r.trackingNote || r.pickupTime}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Receiver Food Requests */}
      {section === 'receiver-requests' && (
        <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2DDD1] flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[#142219]">
              Food Requested by Receivers (NGOs)
            </h2>
            <span className="font-mono text-xs text-[#4B5D51] tabular-nums">
              {receiverRequests.length} requests
            </span>
          </div>

          {receiverRequests.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#4B5D51]">
              No receiver food requests posted yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2DDD1] bg-[#FAF7F0] text-xs font-semibold text-[#4B5D51]">
                    <th className="py-3 px-4">Food Needed</th>
                    <th className="py-3 px-4">Receiver (NGO)</th>
                    <th className="py-3 px-4">Fulfilling Donor</th>
                    <th className="py-3 px-4">Delivery Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2DDD1] text-sm">
                  {receiverRequests.map((rr) => (
                    <tr key={rr.id} className="hover:bg-[#FAF7F0]/60">
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-[#142219]">{rr.foodName}</p>
                        <p className="text-xs text-[#4B5D51]">
                          {rr.quantityNeeded} · Needed by {rr.neededByDate}
                          {rr.isDemo ? ' · Demo request' : ''}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#4B5D51]">
                        {rr.ngoOrganization || rr.ngoName}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#4B5D51]">
                        {rr.donorOrganization || rr.donorName || 'Awaiting Donor'}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={rr.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDeleteReceiverRequest(rr.id)}
                          className="text-xs font-medium text-[#B91C1C] hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Contact Messages */}
      {section === 'messages' && (
        <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2DDD1] flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[#142219]">
              Contact Form Submissions
            </h2>
            <span className="font-mono text-xs text-[#4B5D51] tabular-nums">
              {messages.length} messages
            </span>
          </div>

          {messages.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#4B5D51]">
              No messages submitted via Contact Us yet.
            </div>
          ) : (
            <div className="divide-y divide-[#E2DDD1]">
              {messages.map((m) => (
                <div key={m.id} className="p-5 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-sm text-[#142219]">{m.subject}</p>
                    <span className="font-mono text-xs text-[#4B5D51] tabular-nums">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-[#166534]">
                    {m.name} ({m.email})
                  </p>
                  <p className="text-sm text-[#4B5D51] pt-1">{m.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
