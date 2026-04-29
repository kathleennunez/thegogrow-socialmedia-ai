import { NextResponse } from "next/server";
import { deletePost, getPosts, savePost } from "@/lib/store";
import type { Post } from "@/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing query param: userId" }, { status: 400 });
    }

    const posts = await getPosts(userId);
    return NextResponse.json({ posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load posts.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Post;

    if (!body?.id || !body?.userId || !body?.text || !body?.topic) {
      return NextResponse.json({ error: "Invalid post payload." }, { status: 400 });
    }

    await savePost(body);

    return NextResponse.json({ success: true, post: body }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save post.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { userId?: string; postId?: string };
    const userId = body.userId?.trim();
    const postId = body.postId?.trim();

    if (!userId || !postId) {
      return NextResponse.json({ error: "Missing required fields: userId, postId" }, { status: 400 });
    }

    const removed = await deletePost(userId, postId);
    if (!removed) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete post.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
