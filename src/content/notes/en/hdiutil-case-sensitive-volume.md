---
title: "Case-Sensitive APFS Sparse Image with hdiutil"
description: "Create, attach, and detach a case-sensitive APFS sparse disk image on macOS using hdiutil."
publishedAt: 2026-05-18
tags:
  - macos
  - hdiutil
  - apfs
  - filesystem
---

macOS's default filesystem is case-insensitive. A separate case-sensitive volume is useful for codebases with files whose names differ only by capitalization, like the Linux kernel source. Walked through in [How I Compiled and Ran a Linux Kernel for RISC-V on My Apple Silicon Mac](https://jefrydco.id/blog/compile-run-linux-kernel-riscv-apple-silicon-mac-qemu).

## Create a Sparse Image

```bash
hdiutil create -size 20g -fs "Case-sensitive APFS" \
  -volname linuxkernel ~/Learning/LINUX/linuxkernel.dmg
```

## Attach the Image

Mounts at `/Volumes/<volname>`.

```bash
hdiutil attach ~/Learning/LINUX/linuxkernel.dmg
```

## Detach the Image

```bash
hdiutil detach /Volumes/linuxkernel
```
