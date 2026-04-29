import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureSchemaOnce, hasDatabase, query } from "@/lib/db";
import type { Post } from "@/types";

const POSTS_FILE_PATH = path.join(process.cwd(), "data", "posts.json");
const workspaceIdForUser = (userId: string) => `ws_${userId}`;

export async function savePost(post: Post): Promise<void> {
  if (hasDatabase()) {
    await ensureSchemaOnce();
    await query(
      `
      insert into posts (id, workspace_id, user_id, topic, body, media_url, created_at)
      values ($1,$2,$3,$4,$5,$6,now())
      on conflict (id) do update set
        topic = excluded.topic,
        body = excluded.body,
        media_url = excluded.media_url
    `,
      [post.id, workspaceIdForUser(post.userId), post.userId, post.topic, post.text, post.media?.imageUrl ?? null],
    );
    return;
  }

  try {
    const fileContent = await readFile(POSTS_FILE_PATH, "utf-8").catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return "[]";
      throw error;
    });
    const posts = JSON.parse(fileContent) as Post[];
    const nextPosts = [...posts.filter((item) => item.id !== post.id), post];
    await writeFile(POSTS_FILE_PATH, JSON.stringify(nextPosts, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save post:", error);
    throw new Error("Unable to save post.");
  }
}

export async function getPosts(userId: string): Promise<Post[]> {
  if (hasDatabase()) {
    await ensureSchemaOnce();
    const result = await query<{
      id: string;
      topic: string;
      body: string;
      media_url: string | null;
      created_at: string;
    }>(
      `
      select id, topic, body, media_url, created_at
      from posts
      where workspace_id = $1 and user_id = $2
      order by created_at desc
    `,
      [workspaceIdForUser(userId), userId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId,
      topic: row.topic,
      text: row.body,
      imageIdea: "",
      platforms: [],
      savedAt: row.created_at,
      media: row.media_url ? { provider: "openrouter", status: "ready", imageUrl: row.media_url } : undefined,
    }));
  }

  try {
    const fileContent = await readFile(POSTS_FILE_PATH, "utf-8").catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return "[]";
      throw error;
    });
    const posts = JSON.parse(fileContent) as Post[];
    return posts.filter((post) => post.userId === userId);
  } catch (error) {
    console.error("Failed to get posts:", error);
    throw new Error("Unable to get posts.");
  }
}

export async function getPostById(userId: string, postId: string): Promise<Post | null> {
  const posts = await getPosts(userId);
  return posts.find((post) => post.id === postId) ?? null;
}

export async function deletePost(userId: string, postId: string): Promise<boolean> {
  if (hasDatabase()) {
    await ensureSchemaOnce();
    const result = await query(
      `
      delete from posts
      where workspace_id = $1 and user_id = $2 and id = $3
    `,
      [workspaceIdForUser(userId), userId, postId],
    );
    return result.rowCount > 0;
  }

  try {
    const fileContent = await readFile(POSTS_FILE_PATH, "utf-8").catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return "[]";
      throw error;
    });
    const posts = JSON.parse(fileContent) as Post[];
    const nextPosts = posts.filter((post) => !(post.userId === userId && post.id === postId));
    const removed = nextPosts.length !== posts.length;
    if (removed) await writeFile(POSTS_FILE_PATH, JSON.stringify(nextPosts, null, 2), "utf-8");
    return removed;
  } catch (error) {
    console.error("Failed to delete post:", error);
    throw new Error("Unable to delete post.");
  }
}
