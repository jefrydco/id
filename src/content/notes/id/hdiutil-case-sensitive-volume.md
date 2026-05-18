---
title: "Sparse Image APFS Case-Sensitive dengan hdiutil"
description: "Perintah hdiutil untuk membuat sparse disk image APFS yang case-sensitive di macOS, beserta cara memasang dan melepasnya."
publishedAt: 2026-05-18
tags:
  - macos
  - hdiutil
  - apfs
  - filesystem
---

_Filesystem_ macOS bawaan bersifat _case-insensitive_. _Volume_ terpisah ini berguna untuk _codebase_ yang punya _file_ dengan nama yang hanya berbeda di kapitalisasinya, misalnya kode sumber kernel Linux. Dibahas di [Cara Saya Mengompilasi dan Menjalankan Kernel Linux untuk RISC-V di Mac Apple Silicon](https://jefrydco.id/blog/compile-run-linux-kernel-riscv-apple-silicon-mac-qemu).

## Buat Sparse Image

```bash
hdiutil create -size 20g -fs "Case-sensitive APFS" \
  -volname linuxkernel ~/Learning/LINUX/linuxkernel.dmg
```

## Pasang Image

Terpasang di `/Volumes/<volname>`.

```bash
hdiutil attach ~/Learning/LINUX/linuxkernel.dmg
```

## Lepas Image

```bash
hdiutil detach /Volumes/linuxkernel
```
