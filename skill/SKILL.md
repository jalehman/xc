---
name: xc
description: X/Twitter CLI using the official API v2 with OAuth 2.0. Read, search, post, manage DMs, bookmarks, lists, followers, and track API costs.
homepage: https://github.com/jalehman/xc
metadata: {"clawdbot":{"emoji":"𝕏","requires":{"bins":["xc"]}}}
---

# xc — X API v2 CLI

Use `xc` to interact with X (Twitter) via the official API. Pay-per-use with built-in cost tracking — no cookie scraping.

## Prerequisites

- Must be authenticated first: `xc auth status` to check
- If not authenticated: `xc auth login --client-id <CLIENT_ID>` (requires X Developer Portal app)
- Config stored in `~/.config/xc/`

## Quick Reference

```bash
# Identity
xc whoami                          # Who am I?
xc auth status                     # Auth status for all accounts

# Reading
xc search "query" -n 10            # Search recent posts (7-day window)
xc search "from:username" -n 5     # Search by author
xc user <username>                 # Look up user profile
xc timeline -n 10                  # Home timeline
xc timeline <username> -n 10       # User's posts

# Posting
xc post "Hello world"              # Create a post
xc post "Reply" --reply <post-id>  # Reply to a post
xc post "Look" --quote <post-id>   # Quote a post
xc post "1/3" --thread "2/3" "3/3" # Post a thread
xc post "Photo" --media image.jpg  # Post with media (paid tier)
xc delete <post-id>                # Delete a post

# Engagement
xc like <post-id>                  # Like a post
xc unlike <post-id>                # Unlike a post
xc bookmark <post-id>              # Bookmark a post
xc unbookmark <post-id>            # Remove bookmark
xc bookmarks                      # List bookmarks

# Social
xc followers <username> -n 20     # List followers
xc following <username> -n 20     # List following
xc follow <username>               # Follow a user
xc unfollow <username>             # Unfollow a user

# Lists
xc lists                           # List owned lists
xc list <list-id>                  # View posts in a list

# DMs (paid tier required)
xc dm list                         # List DM conversations
xc dm history <username>           # DM history with user
xc dm send <username> "message"    # Send a DM

# Streaming (requires Bearer Token auth)
xc stream rules                    # List stream rules
xc stream add "query"              # Add filter rule
xc stream remove <rule-id>         # Remove rule
xc stream clear                    # Remove all rules
xc stream connect                  # Connect to live stream

# Cost tracking
xc cost                            # Spending summary (1h/24h/7d/30d)
xc cost --daily                    # Day-by-day breakdown
xc cost log                        # Raw request log

# Budget
xc budget show                     # Current budget and spend
xc budget set --daily 2.00         # Set $2/day limit (warns when exceeded)
xc budget set --daily 5.00 --action block  # Block when over budget

# API usage
xc usage                           # X API usage stats (Bearer Token only)
```

## Important Notes

- **Cost footer**: Every command prints estimated cost. Suppress with `--quiet`.
- **JSON output**: Most commands support `--json` for machine-readable output.
- **Multi-account**: Use `--account <name>` on any command, or `xc auth switch <name>`.
- **Rate limits**: The X API has rate limits per endpoint. If you hit 429 errors, wait and retry.
- **Paid tier features**: DMs and media upload require a paid X API plan (Basic or higher). Free tier returns 403.
- **Bearer Token features**: `stream` and `usage` commands require app-only Bearer Token auth (`xc auth token <TOKEN>`), not OAuth 2.0.
- **Search minimum**: X API returns a minimum of 10 results regardless of `-n` value.

## Posting Guidelines

**Always confirm with the user before posting.** Never post, like, follow, or send DMs without explicit approval. Read operations (search, timeline, user lookup) are safe to run freely.

When composing posts:
- X limit is 280 characters (or 25,000 for Premium subscribers)
- Use `--thread` for longer content
- Delete test posts after verification: `xc delete <id>`

## Common Patterns

```bash
# Search and summarize recent discussion about a topic
xc search "topic" -n 10 --json | jq '.[] | {text: .text, author: .author}'

# Post a thread
xc post "1/ Here's a thread about..." --thread "2/ Second point" "3/ Final thought"

# Check spending before a batch operation
xc budget show
xc cost --daily
```
