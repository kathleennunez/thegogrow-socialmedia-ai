import type { Post } from "@/types";
import { PostCard } from "./PostCard";

export function PostList({ posts }: { posts: Post[] }) {
  if (!posts.length) {
    return (
      <p className="rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-lowest p-5 text-sm text-on-surface-variant">
        No posts yet.
      </p>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </section>
  );
}
