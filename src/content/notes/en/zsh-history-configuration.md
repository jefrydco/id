---
title: "Zsh History Sharing & Size Configuration"
description: "Configure Zsh to share history across sessions, increase size to 10000 entries, and prevent duplicates"
publishedAt: 2026-01-11
tags:
  - zsh
  - terminal
---

```bash
# History configuration
HISTFILE=~/.zsh_history
HISTSIZE=10000
SAVEHIST=10000

# Share history across all sessions
setopt SHARE_HISTORY

# Additional useful options
setopt INC_APPEND_HISTORY    # Write to history file immediately
setopt HIST_IGNORE_DUPS      # Don't record duplicate entries
setopt HIST_FIND_NO_DUPS     # Don't display duplicates when searching
```
