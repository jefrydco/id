---
title: "File Shim macOS untuk Build Kernel Linux"
description: "Stub header untuk host tool kernel Linux dapat di-compile di macOS, beserta HOSTCFLAGS-nya."
publishedAt: 2026-05-18
tags:
  - linux
  - kernel
  - macos
  - shim
---

macOS tidak memiliki beberapa _header_ yang dibutuhkan _host tool_ kernel Linux. _Stub_ berikut mengisi kekurangan tersebut supaya _build_ tetap bisa berjalan. Pendekatannya berasal dari [Building Linux Kernel on macOS Natively](https://seiya.me/blog/building-linux-on-macos-natively) oleh Seiya, dan dibahas di [Cara Saya Mengompilasi dan Menjalankan Kernel Linux untuk RISC-V di Mac Apple Silicon](https://jefrydco.id/blog/compile-run-linux-kernel-riscv-apple-silicon-mac-qemu).

## scripts/macos-include/elf.h

Mem-_proxy_ macOS ke libelf dan menambahkan konstanta _relocation_ yang hilang dari `elf.h` Linux.

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

Memetakan _macro_ `bswap_*` Linux ke _builtin_ _clang_.

```c
#pragma once
#define bswap_16 __builtin_bswap16
#define bswap_32 __builtin_bswap32
#define bswap_64 __builtin_bswap64
```

## scripts/macos-include/gethostuuid.h

_Stub_ kosong. Mencegah `<gethostuuid.h>` macOS merujuk ke _typedef_ `uuid_t` yang sudah kita blokir.

```c
#pragma once
```

## scripts/macos-include/fcntl.h

Mendefinisikan `O_LARGEFILE` yang khas Linux menjadi nol.

```c
#pragma once
#include_next <fcntl.h>
#define O_LARGEFILE 0
```

## scripts/macos-include/unistd.h

Mem-_stub_ `copy_file_range` agar pemanggilnya beralih ke `read`/`write` biasa.

```c
#pragma once
#include_next <unistd.h>
#include <sys/types.h>
static inline ssize_t copy_file_range(int a, void *b, int c, void *d, size_t e, unsigned int f) { return -1; }
```

## HOSTCFLAGS

Berikan ke `gmake` supaya _build_ kernel memakai _shim_-nya:

```bash
HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types -D_UUID_T"
```
