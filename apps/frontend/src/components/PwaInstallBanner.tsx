import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from './ui/Button.js';

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if dismissed before
    const isDismissed = localStorage.getItem('nivasa_pwa_dismissed');
    if (isDismissed) return;

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Show after 3s on mobile or desktop if not standalone
    const timer = setTimeout(() => {
      if (!window.matchMedia('(display-mode: standalone)').matches && !isDismissed) {
        setIsVisible(true);
      }
    }, 2500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } else {
      // Direct instructions for iOS / browsers that don't emit prompt
      alert('To install Nivasa: Tap the share button in your browser and select "Add to Home Screen".');
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem('nivasa_pwa_dismissed', 'true');
    } catch {}
  };

  if (!isVisible) return null;

  return (
    <div className="mb-4 rounded-surface border border-sage-200 bg-sage-50/80 p-3 sm:p-4 text-xs shadow-xs transition-all flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-sage-600 text-white shadow-xs">
          <Smartphone className="h-4 w-4" />
        </div>
        <div>
          <h4 className="font-semibold text-walnut-900">Download Nivasa Web App</h4>
          <p className="text-[11px] text-text-secondary">
            Install on your home screen for instant gate pass generation and offline bookings.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="primary" onClick={handleInstall} className="text-xs py-1 px-3">
          <Download className="mr-1 h-3.5 w-3.5" /> Install
        </Button>
        <button
          onClick={handleDismiss}
          className="p-1 text-text-muted hover:text-text-primary rounded-control"
          title="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
