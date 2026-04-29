import { NextResponse } from "next/server";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId")?.trim();

    if (!userId) {
      return NextResponse.json({ error: "Missing query param: userId" }, { status: 400 });
    }

    const notifications = await getNotifications(userId);
    const unreadCount = notifications.filter((notification) => !notification.read).length;
    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load notifications.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: string;
      action?: "mark-all-read" | "mark-read";
      notificationId?: string;
    };

    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId in request body." }, { status: 400 });
    }

    if (body.action === "mark-read") {
      const notificationId = body.notificationId?.trim();
      if (!notificationId) {
        return NextResponse.json({ error: "Missing notificationId for mark-read action." }, { status: 400 });
      }

      const notifications = await markNotificationRead(userId, notificationId);
      const unreadCount = notifications.filter((notification) => !notification.read).length;
      return NextResponse.json({ notifications, unreadCount });
    }

    const notifications = await markAllNotificationsRead(userId);
    return NextResponse.json({ notifications, unreadCount: 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update notifications.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
