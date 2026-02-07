/**
 * Shared formatting utilities for tweet/user display.
 * Field names use SDK camelCase conventions (authorId, publicMetrics, etc.).
 */

import type { Schemas } from "@xdevplatform/xdk";

type Tweet = Schemas.Tweet;
type User = Schemas.User;

/** Build a lookup map from an API includes.users array. */
export function buildUserMap(users?: User[]): Map<string, User> {
  const map = new Map<string, User>();
  if (users) {
    for (const user of users) {
      if (user.id) map.set(user.id, user);
    }
  }
  return map;
}

/** Format a single tweet for human-readable terminal output. */
export function formatTweet(
  tweet: Tweet,
  usersById?: Map<string, User>,
): string {
  const lines: string[] = [];

  // Author line
  const author = tweet.authorId
    ? usersById?.get(tweet.authorId)
    : undefined;
  if (author) {
    lines.push(`@${author.username} (${author.name})`);
  }

  // Tweet text (indent continuation lines)
  const text = tweet.text ?? "";
  lines.push(`  ${text.replace(/\n/g, "\n  ")}`);

  // Engagement metrics (publicMetrics is Record<string, any>)
  const m = tweet.publicMetrics as Record<string, number> | undefined;
  if (m) {
    const parts: string[] = [];
    if (m.likeCount) parts.push(`${m.likeCount} likes`);
    if (m.retweetCount) parts.push(`${m.retweetCount} RTs`);
    if (m.replyCount) parts.push(`${m.replyCount} replies`);
    if (m.quoteCount) parts.push(`${m.quoteCount} quotes`);
    if (parts.length > 0) {
      lines.push(`  ${parts.join(" · ")}`);
    }
  }

  // Timestamp and post ID
  const meta: string[] = [];
  if (tweet.createdAt) {
    meta.push(new Date(tweet.createdAt).toLocaleString());
  }
  if (tweet.id) {
    meta.push(`id:${tweet.id}`);
  }
  if (meta.length > 0) {
    lines.push(`  ${meta.join(" · ")}`);
  }

  return lines.join("\n");
}

/** Format a list of tweets with blank lines between them. */
export function formatTweetList(
  tweets: Tweet[],
  usersById?: Map<string, User>,
): string {
  return tweets.map((t) => formatTweet(t, usersById)).join("\n\n");
}
