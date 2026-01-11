---
title: "Konfigurasi Sinkronisasi & Ukuran History Zsh"
description: "Konfigurasi Zsh untuk sinkronisasi history antar sesi, perbesar ukuran ke 10000 entri, dan cegah duplikat"
publishedAt: 2026-01-11
tags:
  - zsh
  - terminal
---

```bash
# Konfigurasi history
HISTFILE=~/.zsh_history
HISTSIZE=10000
SAVEHIST=10000

# Sinkronisasi history ke semua sesi
setopt SHARE_HISTORY

# Opsi tambahan
setopt INC_APPEND_HISTORY    # Langsung tulis ke file history
setopt HIST_IGNORE_DUPS      # Abaikan entri duplikat
setopt HIST_FIND_NO_DUPS     # Sembunyikan duplikat saat pencarian
```
