"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppUser } from "./UserProvider";
import type { ReactNode } from "react";

type AppChromeProps = {
  children: ReactNode;
};

const navItems: Array<{ href: string; label: string; icon: string; enabled?: boolean }> = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/", label: "AI Studio", icon: "auto_awesome" },
  { href: "/saved", label: "Saved Drafts", icon: "campaign" },
  { href: "/analytics", label: "Analytics", icon: "insights" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isReady } = useAppUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("app-sidebar-collapsed") === "1";
  });

  useEffect(() => {
    const loadUnreadCount = async () => {
      if (!user?.id) {
        setUnreadCount(0);
        return;
      }

      try {
        const response = await fetch(`/api/notifications?userId=${encodeURIComponent(user.id)}`);
        const data = (await response.json()) as { unreadCount?: number };
        if (response.ok && typeof data.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        }
      } catch {
        setUnreadCount(0);
      }
    };

    if (isReady) {
      void loadUnreadCount();
    }
  }, [isReady, pathname, user?.id]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("app-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  };

  const sidebarWidth = isSidebarCollapsed ? 84 : 230;

  return (
    <div className="min-h-screen bg-background text-on-surface" style={{ ["--sidebar-width" as string]: `${sidebarWidth}px` }}>
      <aside
        className="fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-outline-variant/25 bg-surface-container-low px-4 py-8 lg:flex"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className={`mb-10 flex items-center px-2 ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
            <span className="material-symbols-outlined text-[18px]">insights</span>
          </div>
          {!isSidebarCollapsed ? (
            <div>
              <h1 className="font-headline text-xl font-extrabold leading-none text-on-surface">
                TheGoGrow
              </h1>
              <p className="mt-1 font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                Social Media AI
              </p>
            </div>
          ) : null}
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href === "/" && pathname === "/");
            const isEnabled = item.enabled !== false;
            const baseClass = `flex items-center rounded-xl px-4 py-3 transition ${
              isSidebarCollapsed ? "justify-center" : "gap-3"
            } ${
              isActive
                ? "bg-surface-container text-on-surface"
                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            }`;
            return (
              isEnabled ? (
                <Link key={item.href} href={item.href} className={baseClass}>
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  {!isSidebarCollapsed ? <span className="font-label text-sm font-semibold">{item.label}</span> : null}
                </Link>
              ) : (
                <div key={item.href} className={baseClass}>
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  {!isSidebarCollapsed ? <span className="font-label text-sm font-semibold">{item.label}</span> : null}
                </div>
              )
            );
          })}
        </nav>

        <div className="mt-auto space-y-4">
          <button
            type="button"
            onClick={() => router.push("/")}
            className={`btn-gradient flex w-full items-center justify-center rounded-xl px-4 py-3 font-label text-sm font-bold text-white ${
              isSidebarCollapsed ? "" : "gap-2"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {!isSidebarCollapsed ? "New Post" : null}
          </button>
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className={`flex w-full items-center rounded-lg px-2 py-2 text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface ${
              isSidebarCollapsed ? "justify-center" : "gap-3"
            }`}
          >
            <span className="material-symbols-outlined text-[19px]">help</span>
            {!isSidebarCollapsed ? <span className="font-label text-sm font-medium">Help Center</span> : null}
          </button>
        </div>
      </aside>

      <header className="fixed right-0 top-0 z-30 h-16 w-full border-b border-outline-variant/20 bg-background/80 px-4 backdrop-blur-md sm:px-5 lg:left-[var(--sidebar-width)] lg:w-[calc(100%-var(--sidebar-width))] lg:px-8">
        <div className="flex h-full items-center justify-between gap-6">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-lg bg-surface-container px-2 py-1 font-headline text-sm font-bold text-on-surface"
            >
              AI Studio
            </button>
          </div>
          <div className="hidden items-center gap-3 lg:flex">
            <button
              type="button"
              onClick={toggleSidebar}
              className="rounded-lg p-2 text-on-surface-variant transition hover:bg-surface-container hover:text-primary"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <span className="material-symbols-outlined">
                {isSidebarCollapsed ? "right_panel_open" : "left_panel_close"}
              </span>
            </button>
          </div>
          <div className="relative hidden w-full max-w-md items-center lg:flex">
            <span className="material-symbols-outlined absolute left-3 text-on-surface-variant">search</span>
            <input
              className="h-10 w-full rounded-xl border-none bg-surface-container-lowest pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:ring-1 focus:ring-primary/40"
              placeholder="Search resources or campaigns..."
              type="text"
            />
          </div>
          <div className="ml-auto flex items-center gap-2 text-on-surface-variant sm:gap-4">
            <button
              type="button"
              onClick={() => router.push("/notifications")}
              className="relative rounded-lg p-2 transition hover:bg-surface-container hover:text-primary"
            >
              <span className="material-symbols-outlined">notifications</span>
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[#d21414] px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </header>

      <div className="pt-16 lg:ml-[var(--sidebar-width)]">
        <main className="px-4 py-6 pb-24 sm:px-5 lg:px-12 lg:py-8 lg:pb-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/25 bg-background/95 px-2 py-2 backdrop-blur-md lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href === "/" && pathname === "/");
            return (
              <Link
                key={`mobile-${item.href}`}
                href={item.href}
                className={`flex flex-col items-center justify-center rounded-lg py-2 text-[11px] font-semibold ${
                  isActive ? "bg-surface-container text-primary" : "text-on-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined text-[19px]">{item.icon}</span>
                <span className="mt-0.5 w-full truncate px-0.5 text-center">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
