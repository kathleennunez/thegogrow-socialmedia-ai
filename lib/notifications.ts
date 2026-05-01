import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type AppNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  kind: "info" | "success" | "warning";
  createdAt: string;
  read: boolean;
};

const NOTIFICATIONS_FILE_PATH = path.join(process.cwd(), "data", "notifications.json");

const seedNotifications = (userId: string): AppNotification[] => {
  const now = Date.now();

  return [
    {
      id: `${userId}-notif-welcome`,
      userId,
      title: "Welcome to AI Studio",
      message: "Start by entering a topic and generating your first draft.",
      kind: "info",
      createdAt: new Date(now - 1000 * 60 * 10).toISOString(),
      read: false,
    },
    {
      id: `${userId}-notif-tip`,
      userId,
      title: "Tip: Save your drafts",
      message: "Use Save Draft so you can find your best outputs in Campaigns.",
      kind: "success",
      createdAt: new Date(now - 1000 * 60 * 60).toISOString(),
      read: false,
    },
  ];
};

const readNotifications = async (): Promise<AppNotification[]> => {
  try {
    const content = await readFile(NOTIFICATIONS_FILE_PATH, "utf-8").catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return "[]";
      }
      throw error;
    });

    return JSON.parse(content) as AppNotification[];
  } catch (error) {
    console.error("Failed to read notifications:", error);
    throw new Error("Unable to read notifications.");
  }
};

const writeNotifications = async (notifications: AppNotification[]) => {
  try {
    await writeFile(NOTIFICATIONS_FILE_PATH, JSON.stringify(notifications, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to write notifications:", error);
    throw new Error("Unable to save notifications.");
  }
};

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const notifications = await readNotifications();
  const forUser = notifications
    .filter((notification) => notification.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (forUser.length > 0) {
    return forUser;
  }

  const seeded = seedNotifications(userId);
  await writeNotifications([...notifications, ...seeded]);
  return seeded;
}

export async function markAllNotificationsRead(userId: string): Promise<AppNotification[]> {
  const notifications = await readNotifications();
  const updated = notifications.map((notification) =>
    notification.userId === userId ? { ...notification, read: true } : notification,
  );

  await writeNotifications(updated);
  return updated
    .filter((notification) => notification.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<AppNotification[]> {
  const notifications = await readNotifications();
  const updated = notifications.map((notification) =>
    notification.userId === userId && notification.id === notificationId
      ? { ...notification, read: true }
      : notification,
  );

  await writeNotifications(updated);
  return updated
    .filter((notification) => notification.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createNotification(input: {
  userId: string;
  title: string;
  message: string;
  kind?: AppNotification["kind"];
}) {
  const notifications = await readNotifications();
  const now = new Date().toISOString();
  const next: AppNotification = {
    id: randomUUID(),
    userId: input.userId,
    title: input.title,
    message: input.message,
    kind: input.kind ?? "info",
    createdAt: now,
    read: false,
  };

  notifications.push(next);
  await writeNotifications(notifications);
  return next;
}
