import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ShieldCheck, ArrowRight, UserCheck } from 'lucide-react';
import { Button } from '../components/ui/Button.js';

export function LoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('9820000001');
  const [otp, setOtp] = useState('123456');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('otp');
    }, 400);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (phone.includes('9876543210') || phone.includes('9876543211')) {
        navigate('/staff/complaints');
      } else if (phone.includes('9876543212')) {
        navigate('/committee');
      } else {
        navigate('/resident');
      }
    }, 400);
  };

  const handleQuickLogin = (demoPhone: string, targetPath: string) => {
    setPhone(demoPhone);
    setOtp('123456');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate(targetPath);
    }, 200);
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-surface border border-border bg-surface p-6 sm:p-8 shadow-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-control bg-sage-500 text-white font-bold mb-3 shadow-xs">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-walnut-900">Sign in to Nivasa</h1>
          <p className="mt-1 text-xs text-text-secondary">
            Gated Society Operations & Community Management
          </p>
        </div>

        {/* OTP Flow */}
        {step === 'phone' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label htmlFor="login-phone" className="block text-xs font-semibold text-text-primary mb-1">
                Mobile Number
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-control border border-r-0 border-border bg-surface-alt text-xs text-text-muted">
                  +91
                </span>
                <input
                  id="login-phone"
                  type="tel"
                  maxLength={10}
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9820000001"
                  className="w-full rounded-r-control border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-sage-500 font-mono"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-text-muted">
                Demo OTP <code className="text-sage-700 font-bold">123456</code> is enabled for testing.
              </p>
            </div>

            <Button type="submit" variant="primary" className="w-full" isLoading={loading}>
              Continue with OTP
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="login-otp" className="text-xs font-semibold text-text-primary">Enter 6-digit Code</label>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="text-xs text-sage-700 hover:underline"
                >
                  Change phone
                </button>
              </div>
              <input
                id="login-otp"
                type="text"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="w-full rounded-control border border-border px-3 py-2 text-center text-lg tracking-widest text-text-primary focus:outline-none focus:border-sage-500 font-mono font-bold"
              />
              <p className="mt-1.5 text-center text-[11px] text-text-muted">
                Sent to +91 {phone}
              </p>
            </div>

            <Button type="submit" variant="primary" className="w-full" isLoading={loading}>
              Verify & Sign In
            </Button>
          </form>
        )}

        {/* Quick Demo Profile Logins for Fast Review */}
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2.5 text-center">
            One-Click Demo Profiles (TDD.md Fixtures)
          </p>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <button
              onClick={() => handleQuickLogin('9820000001', '/resident')}
              className="flex items-center justify-between p-2 rounded-control border border-border hover:bg-sage-50/50 hover:border-sage-300 text-left transition-colors"
            >
              <div>
                <span className="font-semibold text-walnut-900">Neeraj Kulkarni</span>
                <span className="text-[11px] text-text-muted block">Flat T07-1203 • Paid ₹7,475</span>
              </div>
              <span className="text-[10px] font-semibold text-sage-700 bg-sage-50 px-2 py-0.5 rounded-full border border-sage-200">
                Resident (Owner)
              </span>
            </button>

            <button
              onClick={() => handleQuickLogin('9820000002', '/resident')}
              className="flex items-center justify-between p-2 rounded-control border border-border hover:bg-amber-50/50 hover:border-amber-300 text-left transition-colors"
            >
              <div>
                <span className="font-semibold text-walnut-900">Swati Joshi</span>
                <span className="text-[11px] text-amber-700 block">Flat T12-0408 • 47 Days Overdue</span>
              </div>
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Resident (Tenant)
              </span>
            </button>

            <button
              onClick={() => handleQuickLogin('9876543210', '/staff/complaints')}
              className="flex items-center justify-between p-2 rounded-control border border-border hover:bg-surface-alt text-left transition-colors"
            >
              <div>
                <span className="font-semibold text-walnut-900">Ramesh Sawant</span>
                <span className="text-[11px] text-text-muted block">Help Desk Queue & Dispatch</span>
              </div>
              <span className="text-[10px] font-semibold text-walnut-900 bg-walnut-50 px-2 py-0.5 rounded-full border border-walnut-200">
                Help Desk
              </span>
            </button>

            <button
              onClick={() => handleQuickLogin('9876543211', '/staff/reconciliation')}
              className="flex items-center justify-between p-2 rounded-control border border-border hover:bg-surface-alt text-left transition-colors"
            >
              <div>
                <span className="font-semibold text-walnut-900">Pooja Mehta</span>
                <span className="text-[11px] text-text-muted block">Bank CSV Reconciliation</span>
              </div>
              <span className="text-[10px] font-semibold text-walnut-900 bg-walnut-50 px-2 py-0.5 rounded-full border border-walnut-200">
                Accounts
              </span>
            </button>

            <button
              onClick={() => handleQuickLogin('9876543212', '/committee')}
              className="flex items-center justify-between p-2 rounded-control border border-border hover:bg-surface-alt text-left transition-colors"
            >
              <div>
                <span className="font-semibold text-walnut-900">Dr. Vikram Deshmukh</span>
                <span className="text-[11px] text-text-muted block">Collections, Ageing & Reports</span>
              </div>
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Committee
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

