---
title: "LLVM Homebrew Configuration on macOS"
description: "Configure LLVM from Homebrew on macOS with PATH, LDFLAGS, and CPPFLAGS environment variables"
publishedAt: 2026-01-11
tags:
  - llvm
  - homebrew
  - macos
---

```bash
export PATH="/opt/homebrew/opt/llvm/bin:$PATH"
export LDFLAGS="-L/opt/homebrew/opt/llvm/lib/c++ -L/opt/homebrew/opt/llvm/lib/unwind -lunwind -Wl,-rpath,/opt/homebrew/opt/llvm/lib/c++"
export CPPFLAGS="-I/opt/homebrew/opt/llvm/include"
export CMAKE_PREFIX_PATH="/opt/homebrew/opt/llvm"
```
