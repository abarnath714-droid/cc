import React, { useState } from 'react';
import { CheckCircle2, Mail, MapPin, Phone } from 'lucide-react';
import { PublicLayout } from '../components/PublicLayout.tsx';
import { useToast } from '../context/ToastContext.tsx';

export function ContactPage() {
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2 || !email.includes('@') || subject.trim().length < 3 || message.trim().length < 10) {
      showError('Please fill in all fields (message must be at least 10 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not send message.');
      }
      showSuccess('Your message has been saved and routed to the HarvestBridge team.');
      setSubmitted(true);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5 space-y-6">
            <div>
              <p className="text-sm font-medium text-[#166534]">Get in Touch</p>
              <h1 className="font-display text-3xl font-bold text-[#142219] mt-1">
                Contact HarvestBridge
              </h1>
              <p className="mt-3 text-base text-[#4B5D51] leading-relaxed">
                Questions about onboarding a restaurant donor, verifying an NGO food bank, or
                coordinating large recurring donations? Send us a message.
              </p>
            </div>

            <div className="rounded-xl border border-[#E2DDD1] bg-[#FFFFFF] p-6 space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#166534] mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-medium text-[#142219]">Support Email</p>
                  <p className="text-[#4B5D51]">coordination@harvestbridge.org</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-[#166534] mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-medium text-[#142219]">Pickup Desk</p>
                  <p className="font-mono text-[#4B5D51]">+1 (555) 204-9180</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#166534] mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-medium text-[#142219]">Community Hub</p>
                  <p className="text-[#4B5D51]">240 Greenway Commons, Suite 200</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-[#E2DDD1] bg-[#FFFFFF] p-6 sm:p-8">
            {submitted ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-[#166534] mx-auto" aria-hidden="true" />
                <h2 className="font-display text-xl font-bold text-[#142219]">
                  Thank you for reaching out
                </h2>
                <p className="text-sm text-[#4B5D51] max-w-md mx-auto">
                  Your inquiry has been recorded in our database. An administrator can also review
                  submitted messages in the Admin Dashboard.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-2 rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white hover:bg-[#14532D] cursor-pointer"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="block text-sm font-medium text-[#142219] mb-1.5"
                    >
                      Full Name *
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm text-[#142219] focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="contact-email"
                      className="block text-sm font-medium text-[#142219] mb-1.5"
                    >
                      Email Address *
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@organization.org"
                      className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm text-[#142219] focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="contact-subject"
                    className="block text-sm font-medium text-[#142219] mb-1.5"
                  >
                    Subject *
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., NGO verification inquiry"
                    className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm text-[#142219] focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-message"
                    className="block text-sm font-medium text-[#142219] mb-1.5"
                  >
                    Message *
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us how we can assist your food donation or NGO team..."
                    className="w-full rounded-lg border border-[#D6E0D8] bg-[#FAF7F0] px-3.5 py-2.5 text-sm text-[#142219] focus:outline-none focus:ring-2 focus:ring-[#166534]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto rounded-lg bg-[#166534] px-6 py-3 text-sm font-semibold text-white hover:bg-[#14532D] disabled:opacity-60 min-h-[44px] cursor-pointer"
                >
                  {submitting ? 'Sending Message...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
