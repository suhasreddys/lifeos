"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import InstallPwaButton from "./InstallPwaButton";
import {
  IconHome,
  IconPlanner,
  IconDocument,
  IconCalendar,
  IconCheckSquare,
  IconFinance,
  IconSparkles,
  IconUser,
  IconLogOut,
} from "./Icons";

type UserSession = {
  id: string;
  name: string;
  email: string;
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<UserSession | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.authenticated && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => {});
  }, [pathname]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setShowMenu(false);
      router.push("/login");
      router.refresh();
    } catch {}
  }

  const desktopNavItems = [
    { href: "/", label: "Home", icon: IconHome },
    { href: "/planner", label: "Planner", icon: IconPlanner },
    { href: "/documents", label: "Documents", icon: IconDocument },
    { href: "/calendar", label: "Calendar", icon: IconCalendar },
    { href: "/tasks", label: "Tasks", icon: IconCheckSquare },
    { href: "/finance", label: "Finance", icon: IconFinance },
  ];

  const mobileNavItems = [
    { href: "/", label: "Home", icon: IconHome },
    { href: "/documents", label: "Vault", icon: IconDocument },
    { href: "/calendar", label: "Calendar", icon: IconCalendar },
    { href: "/tasks", label: "Tasks", icon: IconCheckSquare },
    { href: "/ai", label: "Ask AI", icon: IconSparkles, isAi: true },
  ];

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "G";

  return (
    <>
      {/* Top Glass Navigation Bar */}
      <header className="topbar">
        <div className="topbar-left">
          <Link className="brand" href="/" aria-label="LifeOS home">
            <span className="brand-mark">
              <IconSparkles size={20} />
            </span>
            <span className="brand-title">LifeOS</span>
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="desktop-nav" aria-label="Main Navigation">
          {desktopNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`topbar-link ${isActive ? "topbar-link--active" : ""}`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="topbar-right" style={{ position: "relative" }}>
          <InstallPwaButton />

          <Link
            href="/ai"
            className={`topbar-pill-link topbar-pill-link--ai ${pathname === "/ai" ? "topbar-pill-link--active" : ""}`}
          >
            <IconSparkles size={16} />
            <span>Ask AI</span>
          </Link>

          {user ? (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="user-avatar"
                title={`${user.name} (${user.email})`}
                onClick={() => setShowMenu(!showMenu)}
                style={{ cursor: "pointer", border: 0 }}
              >
                {initial}
              </button>

              {showMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: 46,
                    right: 0,
                    width: 220,
                    background: "var(--modal-bg)",
                    border: "1px solid var(--line)",
                    borderRadius: 18,
                    padding: 12,
                    boxShadow: "var(--shadow-lg)",
                    zIndex: 1000,
                  }}
                >
                  <div style={{ padding: "6px 8px 10px", borderBottom: "1px solid var(--line)", marginBottom: 8 }}>
                    <strong style={{ display: "block", fontSize: 14, color: "var(--ink)", fontWeight: 700 }}>{user.name}</strong>
                    <span style={{ display: "block", fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {user.email}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: 0,
                      background: "rgba(239, 68, 68, 0.12)",
                      color: "#ef4444",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <IconLogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="topbar-pill-link"
              style={{ background: "var(--gradient-brand)", color: "#ffffff", borderColor: "transparent" }}
            >
              <IconUser size={16} />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </header>

      {/* Mobile Bottom Dock Bar */}
      <nav className="mobile-bottom-dock" aria-label="Mobile Navigation">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-dock-item ${isActive ? "mobile-dock-item--active" : ""} ${item.isAi ? "mobile-dock-item--ai" : ""}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
