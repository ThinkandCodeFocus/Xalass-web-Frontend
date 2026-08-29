---
id: 6c07bc00-530c-4389-9f09-aea3902d41f7
title: Git lesson from 7b2b4ed9ba0c
tags:
- git
- lesson
created: 2026-08-29
updated: 2026-08-29
filenames:
- xalass-feed.html
- xalass-search.html
links: []
kind: lesson
status: proposed
superseded_by: null
deprecated_at: null
review_after: 2026-08-29
source_chat_id: null
created_at: 2026-08-29T14:13:18.733886900+00:00
summary: null
description: null
entities: []
related_files: []
related_entities: []
content_hash: 269247e6f8fdba214504ddef8eabaa7c8d5cae59abdbf84993cadb1c728062cb
source_tool: buddy_memory_lifecycle:git
source_confidence: 0.8600000143051147
source_trajectory_id: null
source_message_range: null
source_commit: 7b2b4ed9ba0cf9b56d0ee85e9546fc303fa6c729
topic: null
last_used_at: null
use_count: 0
last_injected_at: null
dismissed_count: 0
source_content_hash: 269247e6f8fdba214504ddef8eabaa7c8d5cae59abdbf84993cadb1c728062cb
review_needed: true
occurrences: 0
---

Git lesson from 7b2b4ed9ba0c

Source commit: 7b2b4ed9ba0c
Paths: xalass-feed.html, xalass-search.html
Summary: fix(#23): unifier la recherche sur xalass-search.html avec debounce et filtres Deux implementations de recherche coexistaient : un filtrage substring cote client dans la SPA du fil (xalass-feed.html, vue #search) et une vraie recherche serveur dans la page autonome xalass-search.html. On unifie sur la recherche serveur