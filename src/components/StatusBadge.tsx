import {
  CheckCircle2,
  Clock,
  Handshake,
  Package,
  PackageCheck,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Truck,
  XCircle,
} from 'lucide-react';

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  if (normalized === 'available' || normalized === 'open') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#BBF7D0] bg-[#ECFDF3] px-2.5 py-1 text-xs font-medium text-[#15803D] whitespace-nowrap shrink-0">
        <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{status}</span>
      </span>
    );
  }

  if (normalized === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-1 text-xs font-medium text-[#B45309] whitespace-nowrap shrink-0">
        <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Pending</span>
      </span>
    );
  }

  if (normalized === 'ready for pickup') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-1 text-xs font-medium text-[#B45309] whitespace-nowrap shrink-0">
        <Package className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Ready for Pickup</span>
      </span>
    );
  }

  if (normalized === 'in transit') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-xs font-medium text-[#1D4ED8] whitespace-nowrap shrink-0">
        <Truck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>In Transit</span>
      </span>
    );
  }

  if (normalized === 'pledged') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#86EFAC] bg-[#F0FDF4] px-2.5 py-1 text-xs font-medium text-[#166534] whitespace-nowrap shrink-0">
        <Handshake className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Pledged</span>
      </span>
    );
  }

  if (normalized === 'accepted') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#86EFAC] bg-[#F0FDF4] px-2.5 py-1 text-xs font-medium text-[#166534] whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Accepted</span>
      </span>
    );
  }

  if (normalized === 'completed' || normalized === 'delivered') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#99F6E4] bg-[#F0FDFA] px-2.5 py-1 text-xs font-medium text-[#0F766E] whitespace-nowrap shrink-0">
        <PackageCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{status}</span>
      </span>
    );
  }

  if (normalized === 'rejected' || normalized === 'suspended') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-1 text-xs font-medium text-[#B91C1C] whitespace-nowrap shrink-0">
        {normalized === 'suspended' ? (
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="capitalize">{status}</span>
      </span>
    );
  }

  if (normalized === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#BBF7D0] bg-[#ECFDF3] px-2.5 py-1 text-xs font-medium text-[#15803D] whitespace-nowrap shrink-0">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Active</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E2DDD1] bg-[#FAF7F0] px-2.5 py-1 text-xs font-medium text-[#4B5D51] whitespace-nowrap shrink-0">
      <span>{status}</span>
    </span>
  );
}
