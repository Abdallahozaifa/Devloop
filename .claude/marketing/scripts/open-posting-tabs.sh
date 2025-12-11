#!/bin/bash
# Open all posting URLs in browser tabs
# Usage: ./scripts/open-posting-tabs.sh

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "          DevLoop Launch - Opening Posting Tabs"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Product Hunt
echo "1. PRODUCT HUNT"
echo "   Copy from: .claude/marketing/posts/producthunt.md"
open "https://www.producthunt.com/posts/new"
sleep 1

# Hacker News
echo ""
echo "2. HACKER NEWS"
echo "   Copy from: .claude/marketing/posts/hackernews.md"
open "https://news.ycombinator.com/submit"
sleep 1

# Indie Hackers
echo ""
echo "3. INDIE HACKERS"
echo "   Copy from: .claude/marketing/posts/indiehackers.md"
open "https://www.indiehackers.com/group/product-launches"
sleep 1

# Twitter
echo ""
echo "4. TWITTER"
echo "   Copy from: .claude/marketing/posts/twitter-thread.md"
open "https://twitter.com/compose/tweet"
sleep 1

# Reddit - r/SaaS
echo ""
echo "5. REDDIT r/SaaS"
echo "   Copy from: .claude/marketing/posts/reddit.md (r/SaaS section)"
open "https://www.reddit.com/r/SaaS/submit?type=TEXT"
sleep 1

# Reddit - r/webdev
echo ""
echo "6. REDDIT r/webdev"
echo "   Copy from: .claude/marketing/posts/reddit.md (r/webdev section)"
open "https://www.reddit.com/r/webdev/submit?type=TEXT"
sleep 1

# Reddit - r/SideProject
echo ""
echo "7. REDDIT r/SideProject"
echo "   Copy from: .claude/marketing/posts/reddit.md (r/SideProject section)"
open "https://www.reddit.com/r/SideProject/submit?type=TEXT"
sleep 1

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "All tabs opened! Content files to copy:"
echo ""
echo "  cat .claude/marketing/posts/producthunt.md"
echo "  cat .claude/marketing/posts/hackernews.md"
echo "  cat .claude/marketing/posts/indiehackers.md"
echo "  cat .claude/marketing/posts/twitter-thread.md"
echo "  cat .claude/marketing/posts/reddit.md"
echo ""
echo "═══════════════════════════════════════════════════════════"
