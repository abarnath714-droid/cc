import { Check, Truck } from 'lucide-react';

interface DeliveryTrackerProps {
  variant: 'donation' | 'receiver';
  currentStage: string;
  deliveryContact?: string | null;
  trackingNote?: string | null;
  pledgedAt?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
}

const DONATION_STEPS = [
  { key: 'Pending', label: 'Requested' },
  { key: 'Accepted', label: 'Approved' },
  { key: 'Ready for Pickup', label: 'Ready' },
  { key: 'In Transit', label: 'In Transit' },
  { key: 'Completed', label: 'Delivered' },
];

const RECEIVER_STEPS = [
  { key: 'Open', label: 'Requested' },
  { key: 'Pledged', label: 'Donor Pledged' },
  { key: 'In Transit', label: 'In Transit' },
  { key: 'Delivered', label: 'Delivered' },
];

function formatTimestamp(ts?: string | null): string | null {
  if (!ts) return null;
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function DeliveryTracker({
  variant,
  currentStage,
  deliveryContact,
  trackingNote,
  pledgedAt,
  dispatchedAt,
  deliveredAt,
}: DeliveryTrackerProps) {
  if (currentStage === 'Rejected') {
    return (
      <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs text-[#991B1B]">
        This pickup request was declined by the donor.
      </div>
    );
  }

  const steps = variant === 'donation' ? DONATION_STEPS : RECEIVER_STEPS;
  const activeIndex = Math.max(
    0,
    steps.findIndex((s) => s.key.toLowerCase() === currentStage.toLowerCase())
  );

  const dispatchedFormatted = formatTimestamp(dispatchedAt);
  const deliveredFormatted = formatTimestamp(deliveredAt);
  const pledgedFormatted = formatTimestamp(pledgedAt);

  return (
    <div className="rounded-xl border border-[#E2DDD1] bg-[#FAF7F0] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#142219]">
          <Truck className="w-3.5 h-3.5 text-[#166534]" aria-hidden="true" />
          <span>Delivery Progress</span>
        </div>
        <span className="text-xs font-medium text-[#166534]">{currentStage}</span>
      </div>

      {/* Step Indicator */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, idx) => {
          const isCompleted = idx < activeIndex || currentStage === 'Completed' || currentStage === 'Delivered';
          const isCurrent = idx === activeIndex && currentStage !== 'Completed' && currentStage !== 'Delivered';
          return (
            <div key={step.key} className="flex flex-col items-start min-w-0">
              <div className="w-full flex items-center gap-1.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 border ${
                    isCompleted
                      ? 'bg-[#166534] border-[#166534] text-white'
                      : isCurrent
                        ? 'bg-[#FFFFFF] border-[#166534] text-[#166534]'
                        : 'bg-[#FFFFFF] border-[#D6E0D8] text-[#4B5D51]'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-3 h-3" aria-hidden="true" />
                  ) : (
                    <span className="tabular-nums">{idx + 1}</span>
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 rounded-full ${
                      idx < activeIndex ? 'bg-[#166534]' : 'bg-[#D6E0D8]'
                    }`}
                  />
                )}
              </div>
              <span
                className={`mt-1.5 text-[11px] leading-tight truncate w-full ${
                  isCompleted || isCurrent
                    ? 'font-semibold text-[#142219]'
                    : 'text-[#4B5D51]'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tracking Metadata */}
      {(deliveryContact || trackingNote || pledgedFormatted || dispatchedFormatted || deliveredFormatted) && (
        <div className="pt-2.5 border-t border-[#E2DDD1] space-y-1 text-xs text-[#4B5D51]">
          {deliveryContact && (
            <p>
              <span className="font-medium text-[#142219]">Courier / Contact:</span>{' '}
              {deliveryContact}
            </p>
          )}
          {trackingNote && (
            <p>
              <span className="font-medium text-[#142219]">Latest Update:</span> {trackingNote}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums pt-0.5">
            {pledgedFormatted && <span>Pledged: {pledgedFormatted}</span>}
            {dispatchedFormatted && <span>Dispatched: {dispatchedFormatted}</span>}
            {deliveredFormatted && <span>Delivered: {deliveredFormatted}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
