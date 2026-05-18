---
title: "macOS Shim Files for Linux Kernel Build"
description: "Header stub files placed in scripts/macos-include/ so the Linux kernel host tools compile on macOS, plus the HOSTCFLAGS to use them."
publishedAt: 2026-05-18
tags:
  - linux
  - kernel
  - macos
  - shim
---

macOS does not have several headers the Linux kernel's host tools depend on. The stubs below fill those gaps so the build can run. The approach originated in [Building Linux Kernel on macOS Natively](https://seiya.me/blog/building-linux-on-macos-natively) by Seiya, and is walked through in [How I Compiled and Ran a Linux Kernel for RISC-V on My Apple Silicon Mac](https://jefrydco.id/blog/compile-run-linux-kernel-riscv-apple-silicon-mac-qemu).

## scripts/macos-include/elf.h

Proxies macOS to libelf and adds missing relocation constants from Linux's `elf.h`.

```c
#pragma once
#include <libelf/gelf.h>
#define STT_SPARC_REGISTER 3
#define R_386_32 1
#define R_386_PC32 2
#define R_MIPS_HI16 5
#define R_MIPS_LO16 6
#define R_MIPS_26 4
#define R_MIPS_32 2
#define R_ARM_ABS32 2
#define R_ARM_REL32 3
#define R_ARM_PC24 1
#define R_ARM_CALL 28
#define R_ARM_JUMP24 29
#define R_ARM_THM_JUMP24 30
#define R_ARM_THM_PC22 10
#define R_ARM_MOVW_ABS_NC 43
#define R_ARM_MOVT_ABS 44
#define R_ARM_THM_MOVW_ABS_NC 47
#define R_ARM_THM_MOVT_ABS 48
#define R_ARM_THM_JUMP19 51
#define R_AARCH64_ABS64 257
#define R_AARCH64_PREL64 260
```

## scripts/macos-include/byteswap.h

Maps Linux's `bswap_*` macros to clang builtins.

```c
#pragma once
#define bswap_16 __builtin_bswap16
#define bswap_32 __builtin_bswap32
#define bswap_64 __builtin_bswap64
```

## scripts/macos-include/gethostuuid.h

Empty stub. Prevents macOS's `<gethostuuid.h>` from referencing the suppressed `uuid_t` typedef.

```c
#pragma once
```

## scripts/macos-include/fcntl.h

Defines Linux-only `O_LARGEFILE` as a no-op.

```c
#pragma once
#include_next <fcntl.h>
#define O_LARGEFILE 0
```

## scripts/macos-include/unistd.h

Stubs `copy_file_range` so callers fall back to plain `read`/`write`.

```c
#pragma once
#include_next <unistd.h>
#include <sys/types.h>
static inline ssize_t copy_file_range(int a, void *b, int c, void *d, size_t e, unsigned int f) { return -1; }
```

## HOSTCFLAGS

Pass to `gmake` so the kernel build picks up the shims:

```bash
HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types -D_UUID_T"
```
