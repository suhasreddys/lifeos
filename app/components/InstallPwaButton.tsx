"use client";

import { useEffect, useState } from "react";

export default function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);

  useEffect(() => {
    // Check if running in standalone window
    const inStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(inStandalone);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Register Service Worker
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  async function handleInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else {
      // Show iOS / Desktop manual PWA install tip
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIos) {
        setShowIosTip(true);
      } else {
        alert("To install LifeOS as an App:\n\n• On Windows/Mac (Chrome/Edge): Click the Install icon ⊕ in your address bar.\n• On Android: Tap Chrome Menu ⋮ -> Install App.");
      }
    }
  }

  if (isStandalone) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        title="Install LifeOS App on Windows, Mac, Android or iOS"
        style={{
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(139, 92, 246, 0.25) 100%)",
          border: "1px solid rgba(139, 92, 246, 0.4)",
          color: "#c084fc",
          padding: "6px 14px",
          borderRadius: 20,
          fontSize: "0.82rem",
          fontWeight: 700,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          transition: "all 0.2s ease"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "linear-gradient(135deg, rgba(99, 102, 241, 0.4) 0%, rgba(139, 92, 246, 0.4) 100%)";
          e.currentTarget.style.borderColor = "rgba(168, 85, 247, 0.6)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(139, 92, 246, 0.25) 100%)";
          e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.4)";
        }}
      >
        <span>📲</span>
        <span>Install App</span>
      </button>

      {showIosTip && (
        <div
          className="modal-backdrop"
          onClick={() => setShowIosTip(false)}
          style={{ zIndex: 9999 }}
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 360, textAlign: "center" }}
          >
            <h3 style={{ marginBottom: 12, fontSize: "1.1rem" }}>Install LifeOS on iPhone/iPad</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: "1.5" }}>
              1. Tap the <strong>Share button</strong> ⎋ at the bottom of Safari.<br />
              2. Scroll down and tap <strong>Add to Home Screen</strong> ➕.
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => setShowIosTip(false)}
              style={{ marginTop: 16, width: "100%" }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
