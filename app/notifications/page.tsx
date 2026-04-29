"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppUser } from "@/components/UserProvider";

type AppNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  kind: "info" | "success" | "warning";
  createdAt: string;
  read: boolean;
};

const kindStyleMap: Record<AppNotification["kind"], string> = {
  info: "bg-[#d6e8ff] text-[#0b3f8a]",
  success: "bg-[#d7f2e2] text-[#11663b]",
  warning: "bg-[#ffe9d6] text-[#9a4a05]",
};

export default function NotificationsPage() {
  const { user, isReady } = useAppUser();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/notifications?userId=${encodeURIComponent(user.id)}`);
      const data = (await response.json()) as { notifications?: AppNotification[]; error?: string };

      if (!response.ok || !Array.isArray(data.notifications)) {
        throw new Error(data.error ?? "Failed to load notifications.");
      }

      setNotifications(data.notifications);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load notifications.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isReady) {
      void loadNotifications();
    }
  }, [isReady, loadNotifications]);

  const markAllRead = async () => {
    if (!user?.id) {
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, action: "mark-all-read" }),
      });

      const data = (await response.json()) as { notifications?: AppNotification[]; error?: string };
      if (!response.ok || !Array.isArray(data.notifications)) {
        throw new Error(data.error ?? "Failed to update notifications.");
      }

      setNotifications(data.notifications);
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Failed to update notifications.";
      setError(message);
    } finally {
      setIsUpdating(false);
    }
  };

  const markOneRead = async (notificationId: string) => {
    if (!user?.id) {
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, action: "mark-read", notificationId }),
      });

      const data = (await response.json()) as { notifications?: AppNotification[]; error?: string };
      if (!response.ok || !Array.isArray(data.notifications)) {
        throw new Error(data.error ?? "Failed to update notifications.");
      }

      setNotifications(data.notifications);
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Failed to update notifications.";
      setError(message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="studio-page max-w-[900px]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
            Notifications
          </h1>
        </div>
        <button
          type="button"
          onClick={markAllRead}
          disabled={isUpdating || unreadCount === 0}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Mark All Read
        </button>
      </div>

      <section className="studio-card p-5">
        <div className="mb-4 flex items-center justify-between rounded-xl bg-surface-container p-3">
          <p className="text-sm font-semibold text-on-surface">Unread</p>
          <span className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold text-on-primary-fixed">
            {unreadCount}
          </span>
        </div>

        {isLoading ? <p className="text-sm text-on-surface-variant">Loading notifications...</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {!isLoading && notifications.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/25 bg-surface-container p-4 text-sm text-on-surface-variant">
            No notifications yet.
          </div>
        ) : null}

        <div className="space-y-3">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className={`rounded-xl border p-4 transition ${
                notification.read
                  ? "border-outline-variant/25 bg-surface-container"
                  : "border-primary/20 bg-primary-fixed/20"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${kindStyleMap[notification.kind]}`}>
                  {notification.kind}
                </span>
                <span className="text-xs text-on-surface-variant">
                  {new Date(notification.createdAt).toLocaleString("en-US", {
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-sm font-semibold text-on-surface">{notification.title}</p>
              <p className="mt-1 text-sm text-on-surface-variant">{notification.message}</p>

              {!notification.read ? (
                <button
                  type="button"
                  onClick={() => markOneRead(notification.id)}
                  disabled={isUpdating}
                  className="mt-3 rounded-lg border border-outline-variant/40 px-3 py-1.5 text-xs font-semibold text-on-surface disabled:opacity-60"
                >
                  Mark Read
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
