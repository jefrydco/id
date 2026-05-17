---
title: "How I Compiled and Ran a Linux Kernel for RISC-V on My Apple Silicon Mac"
description: "Cross-compile and boot a Linux kernel for RISC-V on an Apple Silicon Mac with LLVM, QEMU, LLDB, and a custom init binary written from scratch."
publishedAt: 2026-05-18
tags:
  - linux
  - kernel
  - riscv
  - qemu
  - macos
  - apple-silicon
  - llvm
  - c
  - lldb
---

> I wrote this while still learning the topic. I might not have fully understood everything I put here, and parts of it might be wrong. By the time you read this, I might understand it better. If you have any comments or thoughts, I would love to hear them.

## Why I Did This

I have been writing software for years but always at the higher levels. Web apps and Node apps. The kernel always felt like a black box to me. Things go in, things come out, somewhere in between something happens.

I wanted to open the box.

One thing I only understood after watching this video is that Linux is just a kernel, and a kernel alone cannot show anything to the user. The kernel boots, sets up its world, then hands control to the first userspace[^userspace] program it is given. That first program is called init[^init]. Linux itself does not ship with one. Init can be anything: systemd or sysvinit on a normal desktop, or my own 14-line C program in this article.

::youtube{id="SwIPOf2YAgI"}

From there I started looking for how to actually build the kernel. Linux is open source, so I tried reading it. The codebase was huge and I got lost. I also realized that to even start building, I needed to pick a CPU architecture to target first.

I knew almost nothing about CPU architectures. The closest I had come was knowing my Mac uses Apple Silicon[^applesilicon], which is ARM64, and that most PCs use x86. I started searching for the friendliest architecture to learn the kernel on, and the answer that kept coming up was RISC-V[^riscv]. Small, open, designed to be simple. So I picked it.

Now there was a problem. I do not have any RISC-V hardware. So I had to cross-compile[^crosscompile]: build the kernel for RISC-V on my ARM64 Mac, then boot it inside QEMU which emulates RISC-V in software.

That meant I needed a working recipe to build Linux on macOS for RISC-V. I found it in [_Building Linux Kernel on macOS Natively_](https://seiya.me/blog/building-linux-on-macos-natively) by Seiya, which handles the build side cleanly. I picked up from there: running the kernel in QEMU, writing my own init binary, and watching the boot from the inside with lldb.

This post walks through that journey error by error. Some errors were obvious; others took hours. Neither the build nor the boot worked the first time. The first program I wrote in C had a compiler bug that took me a disassembly session to spot. By the end though, I had a kernel that I built myself, booting into a userspace program that I wrote myself, both running on emulated hardware on my laptop. That moment is what makes this worth doing.

Here is what we will do:

1. Set up the toolchain
2. Get the source onto the Mac
3. Build the kernel
4. Boot it in QEMU
5. Write a tiny init program in C
6. Step through the boot with lldb

## Prerequisites

To build a kernel on a Mac, we need several tools that macOS does not ship with by default. Most of them can be installed through Homebrew. I assume you already have Homebrew. If not, follow the installation guide at [brew.sh](https://brew.sh).

Here is what we need and why:

- **LLVM (`clang` and `lld`[^lld])**: the kernel can be built with `clang` via the `LLVM=1` flag, which saves us from setting up a separate cross-gcc toolchain. macOS already ships with Apple's `clang`, but it is older and may not support all the features the kernel build needs. Homebrew gives us a modern `clang` and `lld` in one package.
- **GNU make**: macOS only ships with BSD make by default, but the kernel needs GNU make. After installation we invoke it as `gmake`.
- **coreutils**: kernel build scripts use commands like `nproc` and `head` which either are not available on macOS or have BSD versions that behave slightly differently.
- **gnu-sed**: kernel scripts assume GNU sed semantics.
- **findutils**: kernel scripts use `find -printf` which BSD find does not have.
- **libelf**: needed by some kernel host tools to parse ELF[^elf] files.
- **QEMU**: to actually run the kernel after we build it.

Install everything in one command:

```sh
brew install llvm make coreutils libelf gnu-sed findutils qemu
```

After installation, we need to set up PATH so Homebrew's `llvm` and the GNU versions of `coreutils`, `gnu-sed`, and `findutils` come before the macOS defaults. Add these lines to `~/.zshrc`:

```sh
# ~/.zshrc
LLVM_PREFIX="$(brew --prefix llvm)"
COREUTILS_PREFIX="$(brew --prefix coreutils)"
GNU_SED_PREFIX="$(brew --prefix gnu-sed)"
FINDUTILS_PREFIX="$(brew --prefix findutils)"

export PATH="$LLVM_PREFIX/bin:$PATH"
export PATH="$COREUTILS_PREFIX/libexec/gnubin:$PATH"
export PATH="$GNU_SED_PREFIX/libexec/gnubin:$PATH"
export PATH="$FINDUTILS_PREFIX/libexec/gnubin:$PATH"
```

Then run `source ~/.zshrc` or open a new terminal. To verify everything is set up correctly, run `clang --version` and `find --version | head -1`. The clang version should mention "Homebrew" rather than Apple, and find should show "GNU findutils".

## Cloning the Kernel

Now we have the toolchain. Time to get the source code. The Linux kernel lives at `git.kernel.org` and is mirrored to GitHub. Let's clone it. We use `--depth=1` so we only download the latest snapshot, not the full history. We do not need the history for this project.

```sh
git clone --depth=1 \
  git://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git
```

```text
~/Learning/LINUX
❯ git clone --depth=1 \
  git://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git
Cloning into 'linux'...
remote: Enumerating objects: 99198, done.
remote: Counting objects: 100% (99198/99198), done.
remote: Compressing objects: 100% (96420/96420), done.
remote: Total 99198 (delta 7850), reused 21828 (delta 1720), pack-reused 0 (from 0)
Receiving objects: 100% (99198/99198), 274.01 MiB | 6.43 MiB/s, done.
Resolving deltas: 100% (7850/7850), done.
Updating files: 100% (93697/93697), done.
warning: the following paths have collided (e.g. case-sensitive paths
on a case-insensitive filesystem) and only one from the same
colliding group is in the working tree:

  'include/uapi/linux/netfilter/xt_CONNMARK.h'
  'include/uapi/linux/netfilter/xt_connmark.h'
  'include/uapi/linux/netfilter/xt_DSCP.h'
  'include/uapi/linux/netfilter/xt_dscp.h'
  'include/uapi/linux/netfilter/xt_MARK.h'
  'include/uapi/linux/netfilter/xt_mark.h'
  'include/uapi/linux/netfilter/xt_RATEEST.h'
  'include/uapi/linux/netfilter/xt_rateest.h'
  'include/uapi/linux/netfilter/xt_TCPMSS.h'
  'include/uapi/linux/netfilter/xt_tcpmss.h'
  'include/uapi/linux/netfilter_ipv4/ipt_ECN.h'
  'include/uapi/linux/netfilter_ipv4/ipt_ecn.h'
  'include/uapi/linux/netfilter_ipv4/ipt_TTL.h'
  'include/uapi/linux/netfilter_ipv4/ipt_ttl.h'
  'include/uapi/linux/netfilter_ipv6/ip6t_HL.h'
  'include/uapi/linux/netfilter_ipv6/ip6t_hl.h'
  'net/netfilter/xt_DSCP.c'
  'net/netfilter/xt_dscp.c'
  'net/netfilter/xt_HL.c'
  'net/netfilter/xt_hl.c'
  'net/netfilter/xt_RATEEST.c'
  'net/netfilter/xt_rateest.c'
  'net/netfilter/xt_TCPMSS.c'
  'net/netfilter/xt_tcpmss.c'
  'tools/memory-model/litmus-tests/Z6.0+pooncelock+poonceLock+pombonce.litmus'
  'tools/memory-model/litmus-tests/Z6.0+pooncelock+pooncelock+pombonce.litmus'
```

The clone finishes, but at the very end git prints a long warning: *"the following paths have collided (e.g. case-sensitive paths on a case-insensitive filesystem) and only one from the same colliding group is in the working tree"*.

The kernel has files whose names differ only by capitalization. Look at the warning list. `xt_CONNMARK.h` and `xt_connmark.h` live in the same directory. Same for `xt_DSCP.h` and `xt_dscp.h`. The only difference between each pair is capitalization. On Linux these are two different files. On macOS's APFS[^apfs], which is case-insensitive by default, they are treated as the same file. Only one file from each colliding pair ends up on disk.

Even if we ignore the warning, this breaks the build. The header files we need are missing from disk because their case-collision twins took their place.

We need a case-sensitive filesystem.

## Creating a Case-Sensitive Workspace

macOS does not let us change the case-sensitivity of our existing disk, but it does let us create a separate volume that is case-sensitive. The `hdiutil` command makes a sparse disk image we can attach as a volume.

I create a 20 GB sparse image at `~/Learning/LINUX/linuxkernel.dmg`. Sparse means the file only grows as it is used. The kernel source plus a build directory comfortably fits in 20 GB.

```sh
hdiutil create -size 20g -fs "Case-sensitive APFS" \
  -volname linuxkernel ~/Learning/LINUX/linuxkernel.dmg

hdiutil attach ~/Learning/LINUX/linuxkernel.dmg
```

```text
~/Learning/LINUX
❯ hdiutil create -size 20g -fs "Case-sensitive APFS" \
  -volname linuxkernel ~/Learning/LINUX/linuxkernel.dmg
created: /Users/jefrydco/Learning/LINUX/linuxkernel.dmg

~/Learning/LINUX took 5s
❯ hdiutil attach ~/Learning/LINUX/linuxkernel.dmg
/dev/disk6              GUID_partition_scheme
/dev/disk6s1            EFI
/dev/disk6s2            Apple_APFS
/dev/disk7              EF57347C-0000-11AA-AA11-0030654
/dev/disk7s1            41504653-0000-11AA-AA11-0030654 /Volumes/linuxkernel
```

Once attached, the volume appears at `/Volumes/linuxkernel/`. From now on, we work inside that volume. Re-clone the kernel there:

```sh
cd /Volumes/linuxkernel
git clone --depth=1 \
  git://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git
```

This time the clone finishes without the case-collision warning. All the files are on disk.

## The allnoconfig Mistake

I wanted to start small. The kernel has thousands of options, and I thought I would learn faster if I began from nothing and added things only as needed. So I picked `allnoconfig`, which disables every option Kconfig[^kconfig] allows.

This was the wrong choice for a first build, but I did not know that yet.

```sh
gmake ARCH=riscv LLVM=1 allnoconfig
```

The first thing that happened was unexpected: clang refused to run.

```text
linux
❯ gmake ARCH=riscv LLVM=1 allnoconfig
  HOSTCC  scripts/basic/fixdep
  HOSTCC  scripts/kconfig/conf.o
  HOSTCC  scripts/kconfig/confdata.o
  HOSTCC  scripts/kconfig/expr.o
  LEX     scripts/kconfig/lexer.lex.c
  YACC    scripts/kconfig/parser.tab.[ch]
  HOSTCC  scripts/kconfig/lexer.lex.o
  HOSTCC  scripts/kconfig/menu.o
  HOSTCC  scripts/kconfig/parser.tab.o
  HOSTCC  scripts/kconfig/preprocess.o
  HOSTCC  scripts/kconfig/symbol.o
  HOSTCC  scripts/kconfig/util.o
  HOSTLD  scripts/kconfig/conf
clang: unknown C compiler
scripts/Kconfig.include:45: Sorry, this C compiler is not supported.
gmake[2]: *** [scripts/kconfig/Makefile:85: allnoconfig] Error 1
gmake[1]: *** [/Volumes/linuxkernel/linux/Makefile:755: allnoconfig] Error 2
gmake: *** [Makefile:248: __sub-make] Error 2
```

The cause was a config file I had at `~/.config/clang/arm64-apple-darwin25.cfg` from another project. Clang automatically loads this on every invocation. Here is what was inside:

```text
# ~/.config/clang/arm64-apple-darwin25.cfg
-isysroot /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk
-I/opt/homebrew/opt/llvm/include
-I/opt/homebrew/opt/boost/include
-L/opt/homebrew/opt/llvm/lib/c++
-L/opt/homebrew/opt/llvm/lib/unwind
-L/opt/homebrew/opt/boost/lib
-lunwind
-Wl,-rpath,/opt/homebrew/opt/llvm/lib/c++
-std=c++26
```

These are C++ flags I use for personal projects: a Boost include path, libc++ link paths, and `-std=c++26`. When the kernel build invoked clang, clang silently picked up these flags, tried to compile kernel C code with a C++26 standard, and broke.

The fix was to move the file aside:

```sh
mv ~/.config/clang/arm64-apple-darwin25.cfg \
   ~/.config/clang/arm64-apple-darwin25.cfg.bak
```

Now `gmake` could actually invoke clang. I re-ran `allnoconfig` to generate the `.config` file:

```sh
gmake ARCH=riscv LLVM=1 allnoconfig
```

```text
❯ gmake ARCH=riscv LLVM=1 allnoconfig
#
# configuration written to .config
#
```

This time it succeeded. Then I tried the actual build:

```sh
gmake ARCH=riscv LLVM=1 -j$(nproc)
```

The `-j$(nproc)` flag tells make how many compile jobs to run in parallel. `nproc` is part of the coreutils we installed earlier and prints the number of processors on the machine, so on an 8-core Mac this becomes `-j8`. The kernel has thousands of independent files, so parallel compilation cuts the build time significantly.

```text
linux on master took 14s
❯ gmake ARCH=riscv LLVM=1 -j$(nproc)
  WRAP    arch/riscv/include/generated/uapi/asm/errno.h
  WRAP    arch/riscv/include/generated/uapi/asm/fcntl.h
  WRAP    arch/riscv/include/generated/uapi/asm/param.h
  [... truncated ...]
  HOSTCC  scripts/elf-parse.o
In file included from scripts/elf-parse.c:12:
In file included from scripts/elf-parse.hscripts/sorttable.c::535::
10:scripts/elf-parse.h:5: 10: fatal error: 'elf.h' file not found
    5 | #include <elf.h>
      fatal error: |          ^~~~~~~'elf.h' file
 not found
    5 | #include <elf.h>
      |          ^~~~~~~
1 error generated.
1 error generated.
gmake[2]: *** [scripts/Makefile.host:131: scripts/elf-parse.o] Error 1
gmake[2]: *** Waiting for unfinished jobs....
gmake[2]: *** [scripts/Makefile.host:131: scripts/sorttable.o] Error 1
  UPD     include/config/kernel.release
  UPD     include/generated/utsrelease.h
gmake[1]: *** [/Volumes/linuxkernel/linux/Makefile:1356: scripts] Error 2
gmake[1]: *** Waiting for unfinished jobs....
  UPD     include/generated/compile.h
gmake: *** [Makefile:248: __sub-make] Error 2
```

This is the first kernel-side error. The build is calling host tools, programs that run on my Mac to prepare the kernel source for compilation. Those host tools include headers that do not exist on macOS. We need a different fix.

## The macos-include Shim

The shim approach in this section follows [Seiya's article](https://seiya.me/blog/building-linux-on-macos-natively) referenced in the intro.

The elf.h error tells us a host tool wants `<elf.h>`, but macOS does not ship elf.h. The `libelf` package we installed earlier provides the equivalent headers, just at a different path: `<libelf/gelf.h>`.

We need a layer of indirection. Create a directory `scripts/macos-include/` and add a stub `elf.h` that proxies to libelf's headers:

```c
// scripts/macos-include/elf.h
#pragma once
#include <libelf/gelf.h>
#define STT_SPARC_REGISTER 3
#define R_386_32 1
```

Then re-run gmake, telling clang where to find our shim and where libelf's headers live:

```sh
gmake ARCH=riscv LLVM=1 -j$(nproc) \
  HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include"
```

```text
linux on master took 6s
❯ gmake ARCH=riscv LLVM=1 -j$(nproc) \
    HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include"
  HOSTCC  scripts/basic/fixdep
  HOSTCC  scripts/dtc/dtc.o
  HOSTCC  scripts/dtc/flattree.o
  [... truncated ...]
  HOSTCC  scripts/elf-parse.o
In file included from scripts/elf-parse.cIn file included from :scripts/sorttable.c:3512:
:
scripts/elf-parse.hscripts/elf-parse.h::6262::2323:: error: incompatible pointer types  passing 'Elf64_Off *' error: (aka 'unsigned long *') incompatible pointerto types  parameter ofpassing  type'Elf64_Off *'  (aka 'unsigned long *') 'const uint64_t *'to
 parameter       (aka 'const unsigned long long *')of  [-Wincompatible-pointer-types]type
'const uint64_t *'
      (aka 'const unsigned long long *') [-Wincompatible-pointer-types]
   62 |         r   e62t |         urrentu renlf _eplafr_spearr.sre8r(.&re8h(d&re-h>der6-4>.ee6_4s.heo_fsfh)o;ff
)      ;|
                             ^~~~~~~~~~~~~~~~~~
[... truncated ...]
6 errors generated.
6 errors generated.
gmake[2]: *** [scripts/Makefile.host:131: scripts/elf-parse.o] Error 1
gmake[2]: *** Waiting for unfinished jobs....
gmake[2]: *** [scripts/Makefile.host:131: scripts/sorttable.o] Error 1
gmake[1]: *** [/Volumes/linuxkernel/linux/Makefile:1356: scripts] Error 2
gmake: *** [Makefile:248: __sub-make] Error 2
```

The build progresses past the elf.h error but hits pointer type warnings. libelf's gelf functions return slightly different types than what the host tool expects, and the build treats these warnings as errors. We silence them with `-Wno-incompatible-pointer-types`:

```sh
gmake ARCH=riscv LLVM=1 -j$(nproc) \
  HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types"
```

Why silence rather than fix? The mismatch is cosmetic at the C type system level. libelf's pointers point to data with the same layout as what the host tool expects, just declared with slightly different types. The tools run correctly. Fixing it properly would mean patching the kernel source files themselves, which means maintaining a local fork. Suppressing the warning only affects our build and keeps the kernel tree clean.

```text
linux on master took 4s
❯ gmake ARCH=riscv LLVM=1 -j$(nproc) \
    HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types"
  [... truncated ...]
  HOSTCC  scripts/mod/symsearch.o
In file included from scripts/mod/symsearch.c:8:
scripts/mod/modpost.h:2:10: fatal error: 'byteswap.h' file not found
    2 | #include <byteswap.h>
      |          ^~~~~~~~~~~~
In file included from scripts/mod/sumversion.c:13:
scripts/mod/modpost.h:2:10: fatal error: 'byteswap.h' file not found
    2 | #include <byteswap.h>
      |          ^~~~~~~~~~~~
In file included from scripts/mod/modpost.c:28:
scripts/mod/modpost.h:2:10: fatal error: 'byteswap.h' file not found
    2 | #include <byteswap.h>
      |          ^~~~~~~~~~~~
In file included from scripts/mod/file2alias.c:19:
scripts/mod/modpost.h:2:10: fatal error: 'byteswap.h' file not found
    2 | #include <byteswap.h>
      |          ^~~~~~~~~~~~
1 error generated.
1 error generated.
gmake[2]: *** [scripts/Makefile.host:131: scripts/mod/symsearch.o] Error 1
gmake[2]: *** Waiting for unfinished jobs....
gmake[2]: *** [scripts/Makefile.host:131: scripts/mod/sumversion.o] Error 1
1 error generated.
gmake[2]: *** [scripts/Makefile.host:131: scripts/mod/modpost.o] Error 1
1 error generated.
gmake[2]: *** [scripts/Makefile.host:131: scripts/mod/file2alias.o] Error 1
gmake[1]: *** [/Volumes/linuxkernel/linux/Makefile:1372: prepare0] Error 2
gmake: *** [Makefile:248: __sub-make] Error 2
```

Next missing header: `byteswap.h`. macOS does not have it but clang has builtins[^builtin] for byte-swapping. Stub it:

```c
// scripts/macos-include/byteswap.h
#pragma once
#define bswap_16 __builtin_bswap16
#define bswap_32 __builtin_bswap32
#define bswap_64 __builtin_bswap64
```

Re-run gmake:

```text
linux on master took 8s
❯ gmake ARCH=riscv LLVM=1 -j$(nproc) \
    HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types"
  HOSTCC  scripts/mod/modpost.o
  HOSTCC  scripts/mod/symsearch.o
  HOSTCC  scripts/mod/sumversion.o
  HOSTCC  scripts/mod/file2alias.o
scripts/mod/file2alias.c:112:3: error: typedef redefinition with different types ('struct uuid_t' vs '__darwin_uuid_t' (aka 'unsigned char[16]'))
  112 | } uuid_t;
      |   ^
/Library/Developer/CommandLineTools/SDKs/MacOSX26.sdk/usr/include/sys/_types/_uuid_t.h:31:25: note: previous definition is here
   31 | typedef __darwin_uuid_t uuid_t;
      |                         ^
scripts/mod/modpost.c:1177:7: error: use of undeclared identifier 'R_386_PC32'
 1177 |         case R_386_PC32:
      |              ^~~~~~~~~~
[... truncated ...]
17 errors generated.
gmake[2]: *** [scripts/Makefile.host:131: scripts/mod/file2alias.o] Error 1
gmake[2]: *** Waiting for unfinished jobs....
16 errors generated.
gmake[2]: *** [scripts/Makefile.host:131: scripts/mod/modpost.o] Error 1
gmake[1]: *** [/Volumes/linuxkernel/linux/Makefile:1372: prepare0] Error 2
gmake: *** [Makefile:248: __sub-make] Error 2
```

Two issues are interleaved here.

**`uuid_t` redefinition** in `file2alias.c`. Both macOS's `<unistd.h>` and the kernel's host tool define `uuid_t`, but with different shapes. macOS's is `unsigned char[16]`, while the kernel's is a struct. macOS's header guards its typedef with an `#ifndef _UUID_T` check, so if we predefine `_UUID_T` on the command line, the header sees it as already defined and skips its own typedef. The kernel's definition is the only one left. Add `-D_UUID_T` to HOSTCFLAGS.

**Many missing `R_*` relocation constants** in `modpost.c` and `file2alias.c`. The kernel's host tools handle relocations for many CPU architectures, including x86, ARM, MIPS, and AArch64. The constants come from Linux's `elf.h`. Our shim only had `R_386_32`. Update `scripts/macos-include/elf.h` with the rest:

```c
// scripts/macos-include/elf.h
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

Re-run with both fixes, expanded elf.h and added `-D_UUID_T`:

```sh
gmake ARCH=riscv LLVM=1 -j$(nproc) \
  HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types -D_UUID_T"
```

```text
linux on master took 10s
❯ gmake ARCH=riscv LLVM=1 -j$(nproc) \
    HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types -D_UUID_T"
  HOSTCC  scripts/basic/fixdep
In file included from scripts/basic/fixdep.c:94:
In file included from /Library/Developer/CommandLineTools/SDKs/MacOSX26.sdk/usr/include/unistd.h:670:
/Library/Developer/CommandLineTools/SDKs/MacOSX26.sdk/usr/include/gethostuuid.h:41:25: error: expected identifier
   41 | int gethostuuid(uuid_t, const struct timespec *) __API_AVAILABLE(macos(10.5)) __API_UNAVAILABLE(ios, tvos, watchos);
      |                         ^
1 error generated.
gmake[2]: *** [scripts/Makefile.host:114: scripts/basic/fixdep] Error 1
gmake[1]: *** [/Volumes/linuxkernel/linux/Makefile:663: scripts_basic] Error 2
gmake: *** [Makefile:248: __sub-make] Error 2
```

`-D_UUID_T` blocks macOS's `uuid_t` typedef, which is what we wanted, but `<gethostuuid.h>`, which `<unistd.h>` pulls in, references `uuid_t` and now fails. Replace the header with an empty stub:

```c
// scripts/macos-include/gethostuuid.h
#pragma once
```

Now the host tools build cleanly. The `scripts/macos-include/` directory holds three small files: `elf.h`, `byteswap.h`, and `gethostuuid.h`. Two HOSTCFLAGS additions go with them: `-Wno-incompatible-pointer-types` and `-D_UUID_T`.

```text
linux on master took 2s
❯ gmake ARCH=riscv LLVM=1 -j$(nproc) \
    HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types -D_UUID_T"
  HOSTCC  scripts/basic/fixdep
  HOSTCC  scripts/dtc/dtc.o
  [... truncated ...]
  AR      built-in.a
  AR      vmlinux.a
  LD      vmlinux.o
  MODPOST vmlinux.symvers
  CC      .vmlinux.export.o
  UPD     include/generated/utsversion.h
  CC      init/version-timestamp.o
  KSYMS   .tmp_vmlinux0.kallsyms.S
  AS      .tmp_vmlinux0.kallsyms.o
  LD      .tmp_vmlinux1
  NM      .tmp_vmlinux1.syms
  KSYMS   .tmp_vmlinux1.kallsyms.S
  AS      .tmp_vmlinux1.kallsyms.o
  LD      .tmp_vmlinux2
  NM      .tmp_vmlinux2.syms
  KSYMS   .tmp_vmlinux2.kallsyms.S
  AS      .tmp_vmlinux2.kallsyms.o
  LD      vmlinux.unstripped
  NM      System.map
  SORTTAB vmlinux.unstripped
  OBJCOPY vmlinux
  GEN     modules.builtin.modinfo
  GEN     modules.builtin
  OBJCOPY arch/riscv/boot/Image
  Kernel: arch/riscv/boot/Image is ready
  GZIP    arch/riscv/boot/Image.gz
  Kernel: arch/riscv/boot/Image.gz is ready
```

## A 14-Line Init Binary

The kernel needs a _userspace_[^userspace] program to run as PID 1[^pidone] after it finishes booting. On a real Linux system this would be systemd or sysvinit. We just need something tiny that proves our own code is running in _userspace_.

The smallest such program prints `Hello, World!` and loops forever. Here it is:

```c
// /Volumes/linuxkernel/initramfs/init.c
void _start() {
    const char msg[] = "Hello, World!\n";

    __asm__ volatile (
        "li a7, 64\n"
        "li a0, 1\n"
        "mv a1, %0\n"
        "li a2, 14\n"
        "ecall\n"
        : : "r"(msg)
    );

    while(1);
}
```

Let me walk through each piece.

`_start` instead of `main`. The kernel jumps to whatever address the ELF[^elf] binary sets as its entry point. On a normal system that entry is `_start`, provided by libc[^libc]'s startup code called crt0[^crt0], which sets up argc/argv and then calls your `main`. We are not linking libc, so we name our function `_start` directly and skip everything in between.

The `__asm__` keyword is the GCC and Clang extension that lets us embed raw assembly instructions inside C code. The `volatile` keyword tells the compiler not to remove or reorder the block. The syscall writes bytes to a file descriptor, a side effect the compiler cannot see from the C alone.

The block invokes a Linux _syscall_[^syscall] using the RISC-V ABI[^abi].

The asm uses two RISC-V instructions: `li` ("load immediate") puts a constant into a register[^register], and `mv` ("move") copies one register's value into another. In `mv a1, %0`, `%0` is a placeholder that the compiler replaces with whichever register holds `msg`. So the block sets up four register arguments and then runs `ecall`:

- `a7 = 64`: the _syscall_ number for `write` on RISC-V
- `a0 = 1`: stdout's file descriptor[^fd]
- `a1 = msg`: pointer[^pointer] to the string to write
- `a2 = 14`: the byte count of "Hello, World!\n"

`ecall`[^ecall] is the instruction that traps[^trap] from _U-mode_[^smode] into _S-mode_ to ask the kernel to run the _syscall_.

`while(1)` at the end: PID 1 cannot return. There is no caller to return to. If `_start` ever returns, the kernel panics because PID 1 has died. So we loop forever.

Build it with `clang`:

```sh
clang --target=riscv64-linux-gnu \
  -static \
  -nostdlib \
  -fuse-ld=lld \
  -o /Volumes/linuxkernel/initramfs/init \
  /Volumes/linuxkernel/initramfs/init.c
```

Each flag matters:

- `--target=riscv64-linux-gnu`: tell `clang` to produce RISC-V Linux code instead of the host's ARM64. This sets the cross-compile[^crosscompile] target.
- `-static`: link the binary statically. No dynamic loader, no shared libraries. The kernel will execute this binary directly, without any of the usual `/lib/ld-linux*.so` machinery, because our _initramfs_ does not contain those files.
- `-nostdlib`: skip libc startup objects entirely. Without this, `clang` would try to link in crt0 and libc, which would clash with our hand-written `_start`.
- `-fuse-ld=lld`: use LLVM's _lld_[^lld] instead of the host's default linker. macOS's system linker only knows Mach-O[^macho], the macOS binary format. We need an ELF binary for Linux, and _lld_ produces ELF.

We can disassemble the binary to see what `clang` produced:

```sh
llvm-objdump -d /Volumes/linuxkernel/initramfs/init
```

```text
/Volumes/linuxkernel/initramfs via C v21.0.0-clang
❯ llvm-objdump -d /Volumes/linuxkernel/initramfs/init

/Volumes/linuxkernel/initramfs/init:   file format elf64-littleriscv

Disassembly of section .text:

00000000000111fc <_start>:
   111fc: 1101          addi    sp, sp, -0x20
   111fe: ec06          sd      ra, 0x18(sp)
   11200: e822          sd      s0, 0x10(sp)
   11202: 1000          addi    s0, sp, 0x20
   11204: 4501          li      a0, 0x0
   11206: fea40723      sb      a0, -0x12(s0)
   1120a: 6505          lui     a0, 0x1
   1120c: a2150513      addi    a0, a0, -0x5df
   11210: fea41623      sh      a0, -0x14(s0)
   11214: 646c7537      lui     a0, 0x646c7
   11218: 26f50513      addi    a0, a0, 0x26f
   1121c: fea42423      sw      a0, -0x18(s0)
   11220: fffff517      auipc   a0, 0xfffff
   11224: f7050513      addi    a0, a0, -0x90
   11228: 6108          ld      a0, 0x0(a0)
   1122a: fea43023      sd      a0, -0x20(s0)
   1122e: fe040513      addi    a0, s0, -0x20
   11232: 04000893      li      a7, 0x40
   11236: 4505          li      a0, 0x1
   11238: 85aa          mv      a1, a0
   1123a: 4639          li      a2, 0xe
   1123c: 00000073      ecall
   11240: a009          j       0x11242 <_start+0x46>
   11242: a001          j       0x11242 <_start+0x46>
```

A quick word on those hex addresses before we move on, because they show up everywhere from here forward. Memory is one big array of bytes. Each byte has an index. We write those indices in hex, which is just the base-16 number system. Hex maps cleanly to binary, because each hex digit is exactly four binary bits. So `0x111fc` is the number 70140 written in hex. Same number, different notation.

One thing to flag before going further: these are virtual addresses[^mmu], not physical RAM locations. Every userspace program sees its own private address space. The kernel sets up the MMU so the program's virtual address `0x111fc` maps to whatever physical RAM byte the kernel allocated for that page. Two programs can both claim virtual `0x10000` without conflict because each has its own page table.

Why this exact virtual address for `_start`? Because `lld`, our linker, put it there. When a linker builds a program, it picks an image base[^imagebase]: the starting address in the program's own address space. For static RISC-V Linux binaries, lld's default image base is `0x10000`. From that base, the linker lays out the binary in order. First comes the ELF[^elf] header, a small block of metadata describing the file. Then come the program headers, which tell the kernel how to load each piece. After those, the `.text` section begins. `.text` holds our machine code, and our `_start` is the first function in it. So after the headers, `_start` lands at `0x111fc`.

```text
0x10000   +---------------------+  <-- lld's default image base
          | ELF header          |
          | program headers     |
          | ...                 |
0x111fc   +---------------------+  <-- _start (our code begins here)
          | addi sp, sp, -0x20  |
          | sd   ra, ...        |
          | ...                 |
          | ecall               |
          | j    .              |
0x11242   +---------------------+  <-- end of _start
```

If we made the binary longer or shorter, every address inside it would shift accordingly. Passing `-Wl,--image-base=0x12345` to clang at link time would tell `lld` to start the binary at a different base.

The kernel itself sits at high addresses like `0xffffffff80c00360`, set by the kernel's linker script. The userspace stack[^stack] lives near the top of user-accessible memory, chosen by the kernel at runtime when it creates our process. None of these are random. Every address in this article comes from somewhere concrete: a config file, a linker script, a CPU spec, or a runtime decision made by code.

The disassembly looks fine at first glance. It loads the values and runs `ecall`. I will come back to it later. There is something subtly wrong here, but I did not notice it until much later, after the kernel was running and the program was producing no output.

## Packing the initramfs

The kernel can boot from an initramfs but only if we give it one. An initramfs[^initramfs] is a `cpio`[^cpio] archive containing the files we want present at boot. The kernel ships a tool called `gen_init_cpio` that builds this archive from a simple spec file. We need to compile it ourselves and then run it.

The first compile attempt hits a familiar problem:

```sh
cc /Volumes/linuxkernel/linux/usr/gen_init_cpio.c \
  -o /Volumes/linuxkernel/linux/usr/gen_init_cpio
```

```text
linux on master [?]
❯ cc /Volumes/linuxkernel/linux/usr/gen_init_cpio.c \
  -o /Volumes/linuxkernel/linux/usr/gen_init_cpio
/Volumes/linuxkernel/linux/usr/gen_init_cpio.c:460:16: error: call to undeclared function 'copy_file_range'; ISO C99 and later do not
      support implicit function declarations [-Wimplicit-function-declaration]
  460 |                         this_read = copy_file_range(file, NULL, outfd, NULL, size, 0);
      |                                     ^
/Volumes/linuxkernel/linux/usr/gen_init_cpio.c:677:31: error: use of undeclared identifier 'O_LARGEFILE'
  677 |                                      O_WRONLY | O_CREAT | O_LARGEFILE | O_TRUNC,
      |                                                           ^~~~~~~~~~~
2 errors generated.
```

`O_LARGEFILE` is a Linux-specific fcntl flag. macOS does not need it because all file operations are 64-bit by default. We add a shim that wraps macOS's `<fcntl.h>` and defines the missing flag as 0:

```c
// scripts/macos-include/fcntl.h
#pragma once
#include_next <fcntl.h>
#define O_LARGEFILE 0
```

Re-compile, this time pointing at our shim:

```sh
cc -I/Volumes/linuxkernel/linux/scripts/macos-include \
  /Volumes/linuxkernel/linux/usr/gen_init_cpio.c \
  -o /Volumes/linuxkernel/linux/usr/gen_init_cpio
```

```text
linux on master
❯ cc -I/Volumes/linuxkernel/linux/scripts/macos-include \
  /Volumes/linuxkernel/linux/usr/gen_init_cpio.c \
  -o /Volumes/linuxkernel/linux/usr/gen_init_cpio
/Volumes/linuxkernel/linux/usr/gen_init_cpio.c:460:16: error: call to undeclared function 'copy_file_range'; ISO C99 and later do not
      support implicit function declarations [-Wimplicit-function-declaration]
  460 |                         this_read = copy_file_range(file, NULL, outfd, NULL, size, 0);
      |                                     ^
1 error generated.
```

Next: `copy_file_range`. It is a Linux syscall that macOS's libc does not have. We stub it as an always-failing function so `gen_init_cpio`'s code falls back to plain `read`/`write`:

```c
// scripts/macos-include/unistd.h
#pragma once
#include_next <unistd.h>
#include <sys/types.h>
static inline ssize_t copy_file_range(int a, void *b, int c, void *d, size_t e, unsigned int f) { return -1; }
```

Re-compile. No errors. Now we have `gen_init_cpio`. Write the [spec file](https://docs.kernel.org/driver-api/early-userspace/early_userspace_support.html) describing what should be in the archive:

```text
# /Volumes/linuxkernel/initramfs.txt
dir  /dev 755 0 0
nod  /dev/console 644 0 0 c 5 1
file /init /Volumes/linuxkernel/initramfs/init 755 0 0
```

The `nod` line is the key. Reading the fields: `/dev/console` is the path, `644` is the file mode, the two `0`s set the owner and group to root, `c` marks it as a character device, and `5 1` are the [major and minor numbers](https://docs.kernel.org/admin-guide/devices.html) that Linux reserves for the system console. `gen_init_cpio` records all of this inside the cpio archive directly, without needing a device node on the macOS filesystem at all. macOS does ship `mknod`[^mknod], but on a modern Mac it cannot create device nodes on regular filesystems anyway, so the cpio approach sidesteps the question entirely.

The node only needs to exist inside the archive, which Linux unpacks into its own tmpfs at boot. The kernel needs this device file to exist because, when it starts our init process, it opens `/dev/console` to wire up stdin, stdout, and stderr. Without the device, our `write` syscall to fd 1 would have nowhere to go.

Pack it:

```sh
/Volumes/linuxkernel/linux/usr/gen_init_cpio /Volumes/linuxkernel/initramfs.txt \
  | gzip > /Volumes/linuxkernel/initramfs.cpio.gz
```

The pipeline writes the cpio archive into `/Volumes/linuxkernel/initramfs.cpio.gz` and produces no terminal output. We are ready to boot.

## A Silent First Boot

We have an `Image`, an `initramfs.cpio.gz`, and a tiny init binary inside it. Let's run it.

QEMU boots with the RISC-V virt[^virt] machine, takes our kernel, our initramfs, and redirects all I/O to our terminal:

```sh
qemu-system-riscv64 \
  -M virt \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image.gz \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -nographic \
  -append "console=ttyS0"
```

```text
/Volumes/linuxkernel
❯ qemu-system-riscv64 \
  -M virt \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image.gz \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -nographic \
  -append "console=ttyS0"

OpenSBI v1.7
   ____                    _____ ____ _____
  / __ \                  / ____|  _ \_   _|
 | |  | |_ __   ___ _ __ | (___ | |_) || |
 | |  | | '_ \ / _ \ '_ \ \___ \|  _ < | |
 | |__| | |_) |  __/ | | |____) | |_) || |_
  \____/| .__/ \___|_| |_|_____/|____/_____|
        | |
        |_|

Platform Name               : riscv-virtio,qemu
Platform Features           : medeleg
Platform HART Count         : 1
Platform IPI Device         : aclint-mswi
Platform Timer Device       : aclint-mtimer @ 10000000Hz
Platform Console Device     : uart8250
Platform HSM Device         : ---
Platform PMU Device         : ---
Platform Reboot Device      : syscon-reboot
Platform Shutdown Device    : syscon-poweroff
Platform Suspend Device     : ---
Platform CPPC Device        : ---
Firmware Base               : 0x80000000
Firmware Size               : 317 KB
Firmware RW Offset          : 0x40000
Firmware RW Size            : 61 KB
Firmware Heap Offset        : 0x46000
Firmware Heap Size          : 37 KB (total), 2 KB (reserved), 11 KB (used), 23 KB (free)
Firmware Scratch Size       : 4096 B (total), 1400 B (used), 2696 B (free)
Runtime SBI Version         : 3.0
Standard SBI Extensions     : time,rfnc,ipi,base,hsm,srst,pmu,dbcn,fwft,legacy,dbtr,sse
Experimental SBI Extensions : none

Domain0 Name                : root
Domain0 Boot HART           : 0
Domain0 HARTs               : 0*
Domain0 Region00            : 0x0000000000100000-0x0000000000100fff M: (I,R,W) S/U: (R,W)
Domain0 Region01            : 0x0000000010000000-0x0000000010000fff M: (I,R,W) S/U: (R,W)
Domain0 Region02            : 0x0000000002000000-0x000000000200ffff M: (I,R,W) S/U: ()
Domain0 Region03            : 0x0000000080040000-0x000000008004ffff M: (R,W) S/U: ()
Domain0 Region04            : 0x0000000080000000-0x000000008003ffff M: (R,X) S/U: ()
Domain0 Region05            : 0x000000000c400000-0x000000000c5fffff M: (I,R,W) S/U: (R,W)
Domain0 Region06            : 0x000000000c000000-0x000000000c3fffff M: (I,R,W) S/U: (R,W)
Domain0 Region07            : 0x0000000000000000-0xffffffffffffffff M: () S/U: (R,W,X)
Domain0 Next Address        : 0x0000000080200000
Domain0 Next Arg1           : 0x0000000087e00000
Domain0 Next Mode           : S-mode
Domain0 SysReset            : yes
Domain0 SysSuspend          : yes

Boot HART ID                : 0
Boot HART Domain            : root
Boot HART Priv Version      : v1.12
Boot HART Base ISA          : rv64imafdch
Boot HART ISA Extensions    : sstc,zicntr,zihpm,zicboz,zicbom,sdtrig,svadu
Boot HART PMP Count         : 16
Boot HART PMP Granularity   : 2 bits
Boot HART PMP Address Bits  : 54
Boot HART MHPM Info         : 16 (0x0007fff8)
Boot HART Debug Triggers    : 2 triggers
Boot HART MIDELEG           : 0x0000000000001666
Boot HART MEDELEG           : 0x0000000000f4b509
```

OpenSBI[^opensbi] starts up, prints its banner with platform info, and then the screen just stops. No kernel boot messages. No "Hello, World!". Nothing.

I had no idea what was wrong. The kernel was supposed to take over from OpenSBI and print its own boot messages. It did not. I searched through the kernel documentation and Stack Overflow looking for an answer.

The pattern that kept coming up was clear: almost nobody starts a kernel build from `allnoconfig`. With `allnoconfig` we had turned off everything Kconfig would let us, which includes the parts of the kernel needed to even talk to the user. No [`HVC_RISCV_SBI`](https://github.com/torvalds/linux/blob/master/drivers/tty/hvc/Kconfig) so no console output. No [`BLK_DEV_INITRD`](https://docs.kernel.org/admin-guide/initrd.html) so no initramfs support. No [`BINFMT_ELF`](https://github.com/torvalds/linux/blob/master/fs/Kconfig.binfmt) so no way to run our compiled init binary. The recommended starting point is `defconfig`[^defconfig], a per-architecture default config that has all the basics enabled.

So I started over with `defconfig`.

## Starting Fresh with defconfig

Switching to `defconfig` means wiping the current kernel tree and starting again. But we do not want to lose the `scripts/macos-include/` directory we just built. Those shim files are local additions, not part of the kernel source, so they would disappear with a fresh clone.

Before deleting the tree, I copy the `macos-include/` directory out of it into `~/Learning/LINUX/macos-include/`. From now on, the shim files live there and I link them back into the kernel tree with a symlink. That way, any time I re-clone, the shims survive. The `init.c` and the packed `initramfs.cpio.gz` live in `/Volumes/linuxkernel/initramfs/` and `/Volumes/linuxkernel/`, outside the kernel tree, so they survive the reset too. Only the `.config` and the build artifacts get wiped.

```sh
rm -rf /Volumes/linuxkernel/linux
cd /Volumes/linuxkernel
git clone --depth=1 https://github.com/torvalds/linux.git
ln -s ~/Learning/LINUX/macos-include linux/scripts/macos-include
cd linux
gmake ARCH=riscv LLVM=1 defconfig
```

What this does:

- `rm -rf` deletes the `allnoconfig` tree
- `git clone --depth=1` brings in a fresh kernel
- `ln -s` symlinks our preserved shim directory back into `scripts/macos-include/`
- `gmake ... defconfig` generates a fresh `.config` from the RISC-V default config

`defconfig` first builds the kconfig[^kconfig] tools, then runs them to generate the `.config` file:

```text
linux on master
❯ gmake ARCH=riscv LLVM=1 defconfig
  HOSTCC  scripts/basic/fixdep
  HOSTCC  scripts/kconfig/conf.o
  HOSTCC  scripts/kconfig/confdata.o
  HOSTCC  scripts/kconfig/expr.o
  LEX     scripts/kconfig/lexer.lex.c
  YACC    scripts/kconfig/parser.tab.[ch]
  HOSTCC  scripts/kconfig/lexer.lex.o
  HOSTCC  scripts/kconfig/menu.o
  HOSTCC  scripts/kconfig/parser.tab.o
  HOSTCC  scripts/kconfig/preprocess.o
  HOSTCC  scripts/kconfig/symbol.o
  HOSTCC  scripts/kconfig/util.o
  HOSTLD  scripts/kconfig/conf
*** Default configuration is based on 'defconfig'
#
# configuration written to .config
#
```

## Missing defconfig Flags

With `defconfig` in place, I rebuild the kernel with the `macos-include` shims still pointed to via HOSTCFLAGS:

```sh
gmake ARCH=riscv LLVM=1 -j$(nproc) \
  HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types -D_UUID_T"
```

This build takes considerably longer than the `allnoconfig` one. `defconfig` enables a lot of drivers and features, so there is a lot more code to compile. Good time for a break.

The build runs through without errors. Image and Image.gz are ready. Time to boot:

```sh
qemu-system-riscv64 \
  -M virt \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image.gz \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -nographic \
  -append "console=ttyS0"
```

Still silent. OpenSBI banner, then nothing. The same silence we saw before.

Back to searching. The answer came from reading [QEMU's virt machine documentation](https://www.qemu.org/docs/master/system/riscv/virt.html) alongside the kernel's [HVC Kconfig file](https://github.com/torvalds/linux/blob/master/drivers/tty/hvc/Kconfig). For QEMU's RISC-V virt machine, the right console driver is `HVC_RISCV_SBI`[^hvc], which talks through OpenSBI's SBI[^sbi] debug console called DBCN[^dbcn]. It turns out `defconfig` also does not enable this driver by default, and it depends on a config option called `NONPORTABLE` which is also off by default.

Enable both:

```sh
./scripts/config --enable NONPORTABLE
./scripts/config --enable HVC_RISCV_SBI
```

Verify they are on in `.config`:

```sh
grep -E "^CONFIG_NONPORTABLE|^CONFIG_HVC_RISCV_SBI" .config
```

```text
linux on master [?]
❯ grep -E "^CONFIG_NONPORTABLE|^CONFIG_HVC_RISCV_SBI" .config
CONFIG_NONPORTABLE=y
CONFIG_HVC_RISCV_SBI=y
```

There is one more thing to do before rebuilding. Enabling `NONPORTABLE` unlocks a handful of new config options that have to be answered. If we just start the build, `gmake` will pause and ask each question on the terminal, one at a time. To accept the defaults for all of them at once, run `olddefconfig` first:

```sh
gmake ARCH=riscv LLVM=1 olddefconfig
```

This is also the routine recovery step to run whenever you switch kernel versions, checkout a different commit, or toggle config options. It walks the existing `.config` and silently accepts the default for any option that is new or has changed, so the next build starts from a consistent state.

```text
linux on master took 3m18s
❯ gmake ARCH=riscv LLVM=1 olddefconfig
  HOSTCC  scripts/basic/fixdep
  HOSTCC  scripts/kconfig/conf.o
  HOSTCC  scripts/kconfig/confdata.o
  HOSTCC  scripts/kconfig/expr.o
  HOSTCC  scripts/kconfig/lexer.lex.o
  HOSTCC  scripts/kconfig/menu.o
  HOSTCC  scripts/kconfig/parser.tab.o
  HOSTCC  scripts/kconfig/preprocess.o
  HOSTCC  scripts/kconfig/symbol.o
  HOSTCC  scripts/kconfig/util.o
  HOSTLD  scripts/kconfig/conf
#
# configuration written to .config
#
```

Now rebuild the kernel with the new config:

```sh
gmake ARCH=riscv LLVM=1 -j$(nproc) \
  HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types -D_UUID_T"
```

## Image vs Image.gz

With `HVC_RISCV_SBI` enabled, the kernel can talk through the SBI debug console. We update the QEMU command line to use it. `console=hvc0` selects the SBI console as the main console; `earlycon=sbi`[^earlycon] adds an early-stage console for messages that come before the main one initializes, so we do not miss anything in early boot.

```sh
qemu-system-riscv64 \
  -M virt \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image.gz \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -nographic \
  -append "earlycon=sbi console=hvc0"
```

Still silent. OpenSBI banner, then nothing.

This took a while to figure out. The answer is in QEMU's source code. The function that loads the kernel for RISC-V is `riscv_load_kernel` in [`hw/riscv/boot.c`](https://gitlab.com/qemu-project/qemu/-/blob/master/hw/riscv/boot.c#L244-309). It tries three loaders in order:

1. `load_elf_ram_sym` reads the first bytes and checks for ELF's magic bytes[^magicbytes]. Our `Image.gz` is gzipped, so it has gzip's magic bytes, not ELF's. The ELF loader rejects it.
2. `load_uimage_as` checks for U-Boot uImage magic bytes. Same story, our file is not a uImage. Rejected.
3. `load_image_targphys_as` is the unconditional fallback. It does not check any magic. It just copies the file bytes into emulated RAM at the kernel load address.

By the third step the file has loaded successfully, but it loaded as raw gzipped bytes. After OpenSBI hands off, the CPU jumps to the kernel address and tries to decode the gzip header as RISC-V instructions. Those bytes are nonsense as instructions. The CPU faults, but no console driver is alive yet to tell us about it. So we see silence.

The fix is simple: use the uncompressed `Image` instead of `Image.gz`. Both files are produced by the build. `Image` is the same kernel, just not gzipped:

```sh
qemu-system-riscv64 \
  -M virt \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -nographic \
  -append "earlycon=sbi console=hvc0"
```

```text
linux on master took 12s
❯ qemu-system-riscv64 \
  -M virt \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -nographic \
  -append "earlycon=sbi console=hvc0"

OpenSBI v1.7
   ____                    _____ ____ _____
  / __ \                  / ____|  _ \_   _|
 | |  | |_ __   ___ _ __ | (___ | |_) || |
 | |  | | '_ \ / _ \ '_ \ \___ \|  _ < | |
 | |__| | |_) |  __/ | | |____) | |_) || |_
  \____/| .__/ \___|_| |_|_____/|____/_____|
        | |
        |_|

Platform Name               : riscv-virtio,qemu
Platform HART Count         : 1
[... truncated ...]
Runtime SBI Version         : 3.0
Standard SBI Extensions     : time,rfnc,ipi,base,hsm,srst,pmu,dbcn,fwft,legacy,dbtr,sse
[... truncated ...]
Boot HART ID                : 0
Boot HART Base ISA          : rv64imafdch
[... truncated ...]
[    0.000000] Booting Linux on hartid 0
[    0.000000] Linux version 7.1.0-rc3 (jefrydco@jefrydco-macbook-personal.local) (Homebrew clang version 22.1.4, Homebrew LLD 22.1.4) #1 SMP PREEMPT Mon May 11 08:01:53 WIB 2026
[    0.000000] Machine model: riscv-virtio,qemu
[    0.000000] SBI specification v3.0 detected
[    0.000000] SBI DBCN extension detected
[    0.000000] earlycon: sbi0 at I/O port 0x0 (options '')
[    0.000000] printk: legacy bootconsole [sbi0] enabled
[    0.000000] Kernel command line: earlycon=sbi console=hvc0
[... truncated ...]
[    0.256876] Unpacking initramfs...
[... truncated ...]
[    1.123813] Freeing unused kernel image (initmem) memory: 2484K
[    1.124509] Run /init as init process
```

Output! The kernel boots, prints its early messages like "Booting Linux on hartid[^hartid] 0", mounts the initramfs, finds `/init`, and runs it.

## The Silent Hello World

After `Run /init as init process` the screen showed nothing else. No "Hello, World!", no crash, no panic. The init binary ran, did not crash, and looped forever in `while(1)`, exactly as written. The kernel could not tell me what was wrong because there was no error to print. So I went to look at what the compiler actually produced for the asm block. The `llvm-objdump`[^disassembly] tool turns a binary back into readable assembly:

```sh
llvm-objdump -d /Volumes/linuxkernel/initramfs/init
```

```text {25,27,28}
/Volumes/linuxkernel/initramfs via C v21.0.0-clang
❯ llvm-objdump -d /Volumes/linuxkernel/initramfs/init

/Volumes/linuxkernel/initramfs/init:   file format elf64-littleriscv

Disassembly of section .text:

00000000000111fc <_start>:
   111fc: 1101          addi    sp, sp, -0x20
   111fe: ec06          sd      ra, 0x18(sp)
   11200: e822          sd      s0, 0x10(sp)
   11202: 1000          addi    s0, sp, 0x20
   11204: 4501          li      a0, 0x0
   11206: fea40723      sb      a0, -0x12(s0)
   1120a: 6505          lui     a0, 0x1
   1120c: a2150513      addi    a0, a0, -0x5df
   11210: fea41623      sh      a0, -0x14(s0)
   11214: 646c7537      lui     a0, 0x646c7
   11218: 26f50513      addi    a0, a0, 0x26f
   1121c: fea42423      sw      a0, -0x18(s0)
   11220: fffff517      auipc   a0, 0xfffff
   11224: f7050513      addi    a0, a0, -0x90
   11228: 6108          ld      a0, 0x0(a0)
   1122a: fea43023      sd      a0, -0x20(s0)
   1122e: fe040513      addi    a0, s0, -0x20
   11232: 04000893      li      a7, 0x40
   11236: 4505          li      a0, 0x1
   11238: 85aa          mv      a1, a0
   1123a: 4639          li      a2, 0xe
   1123c: 00000073      ecall
   11240: a009          j       0x11242 <_start+0x46>
   11242: a001          j       0x11242 <_start+0x46>
```

It took me a while to read through the disassembly. The crucial line in my asm was `mv a1, %0`. I had thought `%0` would somehow stand for `msg` itself, but what it actually does is get replaced by the compiler with whatever register holds `msg`.

Here is what really happened:

- The constraint `"r"(msg)` told the compiler to put `msg` into some register, without saying which one.
- The compiler picked `a0`. Look at `addi a0, s0, -0x20` right before the asm body. That is the compiler putting the stack address of `msg` into `a0`.
- The asm body then ran in order: `li a7, 64`, then `li a0, 1`. The second instruction loaded the number 1 into `a0`, overwriting the address of `msg`.
- `mv a1, %0` got replaced with `mv a1, a0`, copying the now-overwritten value 1 into `a1`. So `a1` held 1, not the address of `msg`.

When `ecall` ran, the registers held `a0=1, a1=1, a2=14, a7=64`. The kernel saw this as `write(1, (char *)1, 14)`: write 14 bytes from address 1 to file descriptor 1. Address 1 is not real memory. The syscall returned `-EFAULT`, an error code meaning "bad address", and nothing was printed.

What I needed was a way to tell the compiler exactly which register each value should be in. I looked up how to do this and found the syntax. The `register` keyword in C is a hint to the compiler to keep a variable in a register. On its own it does not do much; compilers manage registers automatically without it. When you combine it with an `asm(...)` clause naming a specific register, like `asm("a0")`, after the variable name, the two together become a GCC and Clang extension called local register variables[^registerasm]. They pin the variable to that specific hardware register. Both keywords have to be there together: `asm(...)` after a variable declaration only works if you also write `register` in front.

The RISC-V Linux syscall convention tells us which register each value needs to be in. `a7` holds the syscall number, and `a0` through `a5` hold the arguments. For `write(fd, buf, count)`, that means `a0` is the fd, `a1` is the buffer pointer, and `a2` is the byte count. With each value pinned to its named register, the asm body itself only needs to do the `ecall`:

```c
// /Volumes/linuxkernel/initramfs/init.c
void _start() {
    const char msg[] = "Hello, World!\n";

    register long a0 asm("a0") = 1;
    register const char *a1 asm("a1") = msg;
    register long a2 asm("a2") = 14;
    register long a7 asm("a7") = 64;

    __asm__ volatile (
        "ecall\n"
        : "+r"(a0)
        : "r"(a1), "r"(a2), "r"(a7)
        : "memory"
    );

    while(1);
}
```

Rebuild, disassemble again:

```sh
clang --target=riscv64-linux-gnu \
  -static \
  -nostdlib \
  -fuse-ld=lld \
  -o /Volumes/linuxkernel/initramfs/init \
  /Volumes/linuxkernel/initramfs/init.c
```

```sh
llvm-objdump -d /Volumes/linuxkernel/initramfs/init
```

```text {33-37}
/Volumes/linuxkernel/initramfs via C v21.0.0-clang
❯ llvm-objdump -d /Volumes/linuxkernel/initramfs/init

/Volumes/linuxkernel/initramfs/init:   file format elf64-littleriscv

Disassembly of section .text:

00000000000111fc <_start>:
   111fc: 7139          addi    sp, sp, -0x40
   111fe: fc06          sd      ra, 0x38(sp)
   11200: f822          sd      s0, 0x30(sp)
   11202: 0080          addi    s0, sp, 0x40
   11204: 4501          li      a0, 0x0
   11206: fea40723      sb      a0, -0x12(s0)
   1120a: 6505          lui     a0, 0x1
   1120c: a2150513      addi    a0, a0, -0x5df
   11210: fea41623      sh      a0, -0x14(s0)
   11214: 646c7537      lui     a0, 0x646c7
   11218: 26f50513      addi    a0, a0, 0x26f
   1121c: fea42423      sw      a0, -0x18(s0)
   11220: fffff517      auipc   a0, 0xfffff
   11224: f7050513      addi    a0, a0, -0x90
   11228: 6108          ld      a0, 0x0(a0)
   1122a: fea43023      sd      a0, -0x20(s0)
   1122e: 4505          li      a0, 0x1
   11230: fca43c23      sd      a0, -0x28(s0)
   11234: fe040513      addi    a0, s0, -0x20
   11238: fca43823      sd      a0, -0x30(s0)
   1123c: 4539          li      a0, 0xe
   1123e: fca43423      sd      a0, -0x38(s0)
   11242: 04000513      li      a0, 0x40
   11246: fca43023      sd      a0, -0x40(s0)
   1124a: fd843503      ld      a0, -0x28(s0)
   1124e: fd043583      ld      a1, -0x30(s0)
   11252: fc843603      ld      a2, -0x38(s0)
   11256: fc043883      ld      a7, -0x40(s0)
   1125a: 00000073      ecall
   1125e: fca43c23      sd      a0, -0x28(s0)
   11262: a009          j       0x11264 <_start+0x68>
   11264: a001          j       0x11264 <_start+0x68>
```

Look at the four `ld` instructions right before `ecall`. Each one loads a value into a specific named register: `a0` for the fd, `a1` for the buffer pointer, `a2` for the byte count, `a7` for the syscall number. The pinning worked.

Before booting, we need to repack the initramfs so the new `init` binary lands inside the cpio archive that the kernel reads. The on-disk binary is fresh, but the cpio archive still contains the old one until we rebuild it:

```sh
/Volumes/linuxkernel/linux/usr/gen_init_cpio /Volumes/linuxkernel/initramfs.txt \
  | gzip > /Volumes/linuxkernel/initramfs.cpio.gz
```

Boot once more:

```sh
qemu-system-riscv64 \
  -M virt \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -nographic \
  -append "earlycon=sbi console=hvc0"
```

```text {41}
linux on master took 4m28s
❯ qemu-system-riscv64 \
  -M virt \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -nographic \
  -append "earlycon=sbi console=hvc0"

OpenSBI v1.7
   ____                    _____ ____ _____
  / __ \                  / ____|  _ \_   _|
 | |  | |_ __   ___ _ __ | (___ | |_) || |
 | |  | | '_ \ / _ \ '_ \ \___ \|  _ < | |
 | |__| | |_) |  __/ | | |____) | |_) || |_
  \____/| .__/ \___|_| |_|_____/|____/_____|
        | |
        |_|

Platform Name               : riscv-virtio,qemu
Platform HART Count         : 1
[... truncated ...]
Runtime SBI Version         : 3.0
Standard SBI Extensions     : time,rfnc,ipi,base,hsm,srst,pmu,dbcn,fwft,legacy,dbtr,sse
[... truncated ...]
Boot HART ID                : 0
Boot HART Base ISA          : rv64imafdch
[... truncated ...]
[    0.000000] Booting Linux on hartid 0
[    0.000000] Linux version 7.1.0-rc3 (jefrydco@jefrydco-macbook-personal.local) (Homebrew clang version 22.1.4, Homebrew LLD 22.1.4) #1 SMP PREEMPT Mon May 11 08:01:53 WIB 2026
[    0.000000] Machine model: riscv-virtio,qemu
[    0.000000] SBI specification v3.0 detected
[    0.000000] SBI DBCN extension detected
[    0.000000] earlycon: sbi0 at I/O port 0x0 (options '')
[    0.000000] printk: legacy bootconsole [sbi0] enabled
[    0.000000] Kernel command line: earlycon=sbi console=hvc0
[... truncated ...]
[    0.263436] Unpacking initramfs...
[... truncated ...]
[    1.167737] Freeing unused kernel image (initmem) memory: 2484K
[    1.168408] Run /init as init process
Hello, World!
```

The first program I wrote in C ran on a kernel I built myself, on RISC-V emulated by QEMU on my ARM64 Mac. The message printed. That is the moment that made the whole journey worth it.

## Reading init/main.c

Hello, World prints. Everything from CPU power-on to our 14 lines of assembly ran. The kernel did a lot of work in between, almost all of it inside `init/main.c`. This section walks through that file. By recognizing the parts while things work, you will know where to look when something breaks.

Everything between firmware and our `/init` lives in one file: `init/main.c`. The file has two functions worth knowing about: `start_kernel` and `kernel_init`.

`start_kernel` is the kernel's `main`. It does most of the setup work:

- Sets up memory: figures out what RAM is available so the kernel can hand out memory to anything that asks for it later.
- Sets up interrupts: tells the CPU how to handle timer ticks, page faults, and system calls.
- Sets up the scheduler: the part that decides which task gets to run on the CPU next.
- Sets up the console: the reason we see boot messages on our terminal.

By the time `start_kernel` finishes, the kernel is alive and printing to our console. But there is no `/init` running yet. That happens next.

`kernel_init` is the function that runs after `start_kernel`. It is the bridge from "kernel running on bare hardware" to "our userspace program running". It:

- Waits for `initramfs.cpio.gz` to unpack into memory.
- Opens `/dev/console` so that file descriptors 0, 1, 2 work for any program it runs.
- Calls `run_init_process("/init")`, the function that prints `Run /init as init process` and then hands control to our binary.

Below are common symptoms, each paired with where to look in the source code:

- **No kernel messages at all, only the OpenSBI banner**: the early console did not come up. Look at `setup_arch` in `arch/riscv/kernel/setup.c` and the `earlycon=sbi` parsing in `setup_earlycon` inside `drivers/tty/serial/earlycon.c`. This is the same fix we used when we first added `earlycon=sbi`.
- **Boot stops somewhere between OpenSBI and `Run /init`**: something in `start_kernel` or `kernel_init` panicked or hung. The last line printed before silence is your landmark. Open `init/main.c`, grep for the exact text, and read what runs immediately after.
- **`Run /init as init process` and then silence**: the kernel did its job. The bug is in your `/init` binary. We just experienced this in the previous section.
- **`Warning: unable to open an initial console`**: `console_on_rootfs` failed. Either `/dev/console` is missing from your initramfs, or the console driver was not built into the kernel. Our work on `HVC_RISCV_SBI` covered the second case.
- **Kernel panic with `No working init found`**: the kernel finished its setup but could not find `/init` in your initramfs. Check that you actually packed it in.

Knowing these landmarks turns "the boot is broken" into a much shorter list of places to check.

The kernel has its own version of `printf` called `printk`[^printk]. Modern kernel code usually calls it through wrappers such as `pr_info`, `pr_warn`, and `pr_err`. Each wrapper calls `printk` at a different log level. The output goes to the same console our boot log uses. You can add `pr_info("hello from my code\n");` anywhere in the kernel, rebuild, boot, and look for the line. This is the fastest way to confirm a landmark you found in the source actually ran.

Let me show this with the two landmarks we just named. Open `init/main.c` and find the `start_kernel` function. Near the end of it, just before it calls `rest_init`, add:

```c
pr_info("hello from start_kernel\n");
```

Now find `kernel_init` lower in the same file. At the top of the function body, just before the call to `wait_for_completion(&kthreadd_done)`, add:

```c
pr_info("hello from kernel_init\n");
```

Rebuild the kernel:

```sh
gmake ARCH=riscv LLVM=1 -j$(nproc) \
  HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types -D_UUID_T"
```

Boot it:

```sh
qemu-system-riscv64 \
  -M virt \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -nographic \
  -append "earlycon=sbi console=hvc0"
```

The boot log now carries two new lines, one from each function:

```text {37,38}
linux on master took 22s
❯ qemu-system-riscv64 \
  -M virt \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -nographic \
  -append "earlycon=sbi console=hvc0"

OpenSBI v1.7
   ____                    _____ ____ _____
  / __ \                  / ____|  _ \_   _|
 | |  | |_ __   ___ _ __ | (___ | |_) || |
 | |  | | '_ \ / _ \ '_ \ \___ \|  _ < | |
 | |__| | |_) |  __/ | | |____) | |_) || |_
  \____/| .__/ \___|_| |_|_____/|____/_____|
        | |
        |_|

Platform Name               : riscv-virtio,qemu
Platform HART Count         : 1
[... truncated ...]
Runtime SBI Version         : 3.0
Standard SBI Extensions     : time,rfnc,ipi,base,hsm,srst,pmu,dbcn,fwft,legacy,dbtr,sse
[... truncated ...]
Boot HART ID                : 0
Boot HART Base ISA          : rv64imafdch
[... truncated ...]
[    0.000000] Booting Linux on hartid 0
[    0.000000] Linux version 7.1.0-rc3-dirty (jefrydco@jefrydco-macbook-personal.local) (Homebrew clang version 22.1.4, Homebrew LLD 22.1.4) #2 SMP PREEMPT Mon May 11 09:42:18 WIB 2026
[    0.000000] Machine model: riscv-virtio,qemu
[    0.000000] SBI specification v3.0 detected
[    0.000000] SBI DBCN extension detected
[    0.000000] earlycon: sbi0 at I/O port 0x0 (options '')
[    0.000000] printk: legacy bootconsole [sbi0] enabled
[    0.000000] Kernel command line: earlycon=sbi console=hvc0
[... truncated ...]
[    0.031952] hello from start_kernel
[    0.039693] hello from kernel_init
[... truncated ...]
[    0.267852] Unpacking initramfs...
[... truncated ...]
[    1.177287] Freeing unused kernel image (initmem) memory: 2484K
[    1.178003] Run /init as init process
Hello, World!
```

You can add a `pr_info` anywhere and learn whether that code path runs. That is the whole technique.

`printk` is enough to answer "did this run?". For "what value is in this register?" or "we want to pause the kernel mid-boot", the next section attaches `lldb` to a running QEMU.

## Watching the Boot from Inside

`printk` answers "did this run?". For deeper questions, like "what is the value of this register?" or "we want to pause the kernel and look at memory", we need a debugger. `lldb` plus QEMU's gdb stub gives us that.

The setup has four steps:

1. Build the kernel with debug symbols so the debugger knows the names of functions and variables.
2. Start QEMU with its gdb stub turned on and the CPU paused, so we can attach the debugger before any kernel code runs.
3. Attach `lldb` to the gdb stub.
4. Walk through the boot.

For `lldb` to map addresses to source lines, the kernel must be built with DWARF[^dwarf] symbols. It turns out `defconfig` ships with `DEBUG_INFO_NONE` turned on, which strips symbols away. We need to turn that off and enable `DEBUG_INFO_DWARF_TOOLCHAIN_DEFAULT` instead. While we are there, `GDB_SCRIPTS` adds helper scripts that gdb-compatible debuggers can load:

```sh
./scripts/config --disable DEBUG_INFO_NONE
./scripts/config --enable DEBUG_INFO_DWARF_TOOLCHAIN_DEFAULT
./scripts/config --enable GDB_SCRIPTS
```

Verify both are on in `.config`:

```sh
grep -E "^CONFIG_DEBUG_INFO_DWARF_TOOLCHAIN_DEFAULT|^CONFIG_GDB_SCRIPTS" .config
```

```text
linux on master [?]
❯ grep -E "^CONFIG_DEBUG_INFO_DWARF_TOOLCHAIN_DEFAULT|^CONFIG_GDB_SCRIPTS" .config
CONFIG_DEBUG_INFO_DWARF_TOOLCHAIN_DEFAULT=y
CONFIG_GDB_SCRIPTS=y
```

Then run `olddefconfig` and rebuild:

```sh
gmake ARCH=riscv LLVM=1 olddefconfig

gmake ARCH=riscv LLVM=1 -j$(nproc) \
  HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types -D_UUID_T"
```

`olddefconfig` reconciles the three toggles with any other config options that depend on them, accepting the default for anything new. Then the build runs against a consistent `.config`.

This produces a new `vmlinux`[^vmlinux] in the kernel tree alongside `Image`. `vmlinux` is the unstripped ELF kernel binary, with all symbol tables intact. `lldb` reads `vmlinux` to learn where each function lives. The `Image` file we have been booting from is `vmlinux` with debug info stripped and the ELF wrapper removed.

Now start QEMU with two new flags:

```sh
qemu-system-riscv64 \
  -M virt \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -nographic \
  -append "earlycon=sbi console=hvc0" \
  -s -S
```

The new flags:

- `-s` turns on QEMU's gdbstub[^gdbstub] on TCP port 1234. Any debugger that speaks the GDB protocol can connect.
- `-S` with a capital S tells QEMU to start the guest CPU paused. Without this, the kernel would run past `start_kernel` and beyond before we have any chance to attach.

The terminal sits there waiting. QEMU has loaded the kernel into RAM and is paused at the reset vector[^resetvector]. No instructions have executed yet.

Open a second terminal. Start `lldb` with the unstripped kernel binary:

```sh
lldb /Volumes/linuxkernel/linux/vmlinux
```

```text
linux on master via 🐍 v3.14.5
❯ lldb /Volumes/linuxkernel/linux/vmlinux
(lldb) target create "/Volumes/linuxkernel/linux/vmlinux"
Current executable set to '/Volumes/linuxkernel/linux/vmlinux' (riscv64).
```

`lldb` reads `vmlinux`, learns every function in the kernel, and shows a prompt. It is not yet connected to QEMU.

Connect to QEMU's gdb stub and set a breakpoint[^breakpoint] at the kernel's entry C function:

```
(lldb) gdb-remote localhost:1234
(lldb) breakpoint set --name start_kernel
(lldb) continue
```

`gdb-remote localhost:1234` opens a TCP connection to QEMU. `lldb` tells QEMU "stop when you reach this address" using the GDB wire protocol. `continue` releases the paused CPU. QEMU runs from the reset vector, through the architecture-specific assembly in `head.S` whose details I am still learning, and stops at `start_kernel`:

```text
(lldb) gdb-remote localhost:1234
Process 1 stopped
* thread #1, stop reason = signal SIGTRAP
    frame #0: 0x0000000000001000
->  0x1000: auipc  t0, 0x0
    0x1004: addi   a2, t0, 0x28
    0x1008: csrr   a0, mhartid
    0x100c: ld     a1, 0x20(t0)
(lldb) breakpoint set --name start_kernel
Breakpoint 1: where = vmlinux`start_kernel + 12 at main.c:1019:8, address = 0xffffffff80c00360
(lldb) continue
Process 1 resuming
Process 1 stopped
* thread #1, stop reason = breakpoint 1.1
    frame #0: 0xffffffff80c00360 vmlinux`start_kernel at main.c:1019:8
   1016 asmlinkage __visible __init __no_sanitize_address __noreturn __no_stack_protector
   1017 void start_kernel(void)
   1018 {
-> 1019         char *command_line;
   1020         char *after_dashes;
   1021
   1022         set_task_stack_end_magic(&init_task);
```

We are standing inside the kernel's first C function. Every register value, every variable, every memory address is inspectable from this point.

Let me jump to a more interesting place. `run_init_process` is the function we named in the previous section as the one that prints `Run /init as init process` and hands off to our binary. Set a breakpoint there, continue, and inspect the argument:

```
(lldb) breakpoint set --name run_init_process
(lldb) continue
(lldb) register read a0
(lldb) memory read --format s --count 1 $a0
```

When the breakpoint hits, we are at the moment the kernel is about to call our init binary. The first argument is in `a0` per the RISC-V calling convention[^abi]. `run_init_process` takes one argument, `const char *init_filename`, so `a0` should hold a pointer to the string `/init`:

```text
(lldb) breakpoint set --name run_init_process
Breakpoint 2: where = vmlinux`run_init_process + 18 at main.c:1507:15, address = 0xffffffff80002012
(lldb) continue
Process 1 resuming
Process 1 stopped
* thread #1, stop reason = breakpoint 2.1
    frame #0: 0xffffffff80002012 vmlinux`run_init_process(init_filename="/init") at main.c:1507:15
   1504 {
   1505         const char *const *p;
   1506
-> 1507         argv_init[0] = init_filename;
   1508         pr_info("Run %s as init process\n", init_filename);
   1509         pr_debug("  with arguments:\n");
   1510         for (p = argv_init; *p; p++)
(lldb) register read a0
      a0 = 0xffffffff8134d295
(lldb) memory read --format s --count 1 $a0
0xffffffff8134d295: "/init"
```

`memory read --format s` reads the address in `$a0` and interprets the bytes as a null-terminated string. The kernel really is about to run `/init`, not some other binary.

One more stop. `start_thread` is the architecture-specific function the kernel calls to set up a new userspace thread's state before the CPU returns to U-mode[^smode]. On RISC-V it takes three arguments: a pointer to the task's saved register state, the program counter[^pc] where userspace should begin executing, and the initial stack pointer[^sp]. Set the breakpoint and read the three argument registers:

```
(lldb) breakpoint set --name start_thread
(lldb) continue
(lldb) register read a0 a1 a2
```

```text
(lldb) breakpoint set --name start_thread
Breakpoint 3: where = vmlinux`start_thread + 24 at process.c:147:15, address = 0xffffffff8001411c
(lldb) continue
Process 1 resuming
Process 1 stopped
* thread #1, stop reason = breakpoint 3.1
    frame #0: 0xffffffff8001411c vmlinux`start_thread(regs=0xff2000000000bee0, pc=70140, sp=140737414192480) at process.c:147:15
   144  void start_thread(struct pt_regs *regs, unsigned long pc,
   145          unsigned long sp)
   146  {
-> 147          regs->status = SR_PIE;
   148          if (has_fpu()) {
   149                  regs->status |= SR_FS_INITIAL;
   150                  /*
(lldb) register read a0 a1 a2
      a0 = 0x0000000000000020
      a1 = 0x00000000000111fc
      a2 = 0x00007ffffb945d60
```

`a1` is the program counter, which is the entry address of `_start` from our init ELF. `a2` is the top of the userspace stack the kernel allocated for the new process.

After `start_thread` returns and the kernel transitions back to U-mode via `sret`[^sret], the CPU's program counter becomes the value from `a1` and execution jumps into our 14 lines of inline assembly. Hello World prints.

We just watched the boot from the inside: reset vector through `start_kernel`, through `kernel_init`, through `run_init_process`, through `start_thread`, into userspace. Every transition we read about in the previous section just happened live, with breakpoints and register reads as proof.

## Where to Go from Here

What I built works, but understanding it deeply is its own journey. Here is what I am looking at next, in case it helps you pick a direction.

**Run a real userspace.** Our 14-line init proves the kernel can hand off to userspace, but it can only print one line. Replace it with BusyBox to get a working shell along with `ls`, `cat`, and the rest. Build BusyBox statically for RISC-V, drop the binary into the initramfs, point `/init` at BusyBox's init, and reboot.
Reference: <https://busybox.net/>

**Add a custom syscall.** Pick an unused number, add an entry in `arch/riscv/kernel/syscall_table.c`, implement a `SYSCALL_DEFINE` function, rebuild. From userspace, call it through `syscall(NR_my_call, ...)`. This is the cleanest way to feel the userspace-to-kernel contract from both sides.
Reference: <https://docs.kernel.org/process/adding-syscalls.html>

I am still working through the fundamentals myself. The textbooks on my list:

- **Computer Systems: A Programmer's Perspective** by Bryant and O'Hallaron for how registers, memory, and assembly fit together
- **xv6** from MIT for a kernel small enough to read end to end
- **The RISC-V Reader** by Waterman and Patterson for a compact overview of the ISA
- **The C Programming Language** by Kernighan and Ritchie for the language

I got this far. I have done the hardest part: opened the box and looked inside. Everything from here is exploring the contents, one piece at a time.

## References

- [Building Linux Kernel on macOS Natively](https://seiya.me/blog/building-linux-on-macos-natively) by Seiya
- [BusyBox](https://busybox.net/)
- [Homebrew](https://brew.sh)
- [Linux kernel: Adding a New System Call](https://docs.kernel.org/process/adding-syscalls.html)
- [Linux kernel: Early Userspace Support](https://docs.kernel.org/driver-api/early-userspace/early_userspace_support.html)
- [Linux kernel: HVC Kconfig](https://github.com/torvalds/linux/blob/master/drivers/tty/hvc/Kconfig)
- [Linux kernel: Linux Allocated Devices](https://docs.kernel.org/admin-guide/devices.html)
- [QEMU: RISC-V virt Machine](https://www.qemu.org/docs/master/system/riscv/virt.html)
- [QEMU source: riscv_load_kernel in hw/riscv/boot.c](https://gitlab.com/qemu-project/qemu/-/blob/master/hw/riscv/boot.c)

[^riscv]: An open-source CPU architecture. Anyone can implement a
chip without paying licensing fees. The instruction set is small
and readable, which makes it popular for learning.
Reference: <https://riscv.org/about/>

[^abi]: Application Binary Interface. Where an API tells you what
functions exist, an ABI tells you exactly how to call them: which
registers hold arguments, which holds the return value, how the
stack is laid out.
Reference: <https://github.com/riscv-non-isa/riscv-elf-psabi-doc>

[^syscall]: System call. The way a regular program asks the kernel
to do something it can't do on its own, like reading a file or
writing to a screen. On RISC-V, you put the number in register a7,
the arguments in a0 to a5, then run `ecall`.
Reference: <https://man7.org/linux/man-pages/man2/syscalls.2.html>

[^elf]: Executable and Linkable Format. The standard binary format
on Linux. A compiled program, a shared library, even an object file
are all ELF.
Reference: <https://man7.org/linux/man-pages/man5/elf.5.html>

[^builtin]: Compiler intrinsics provided by clang and gcc that map
directly to CPU instructions. `__builtin_bswap16`,
`__builtin_bswap32`, and `__builtin_bswap64` swap byte order in
16-, 32-, and 64-bit integers respectively.
Reference: <https://clang.llvm.org/docs/LanguageExtensions.html#builtin-bswap16-builtin-bswap32-builtin-bswap64>

[^macho]: The native binary format on macOS and iOS. Different from
ELF used on Linux. Mach-O binaries have their own magic bytes and
structure, so a linker for one format cannot produce the other.
Reference: <https://developer.apple.com/library/archive/documentation/DeveloperTools/Conceptual/MachORuntime/>

[^mmu]: Memory Management Unit. The hardware that translates
virtual addresses, which are the ones your program sees, into
physical addresses, which are the actual locations of the data in
RAM. Every program has its own virtual address space, so two
programs can both use the address `0x10000` without conflict.
The MMU translates each program's virtual address into a
different physical RAM location behind the scenes, and also
enforces permissions like read-only.
Reference: Privileged Architecture spec at
<https://github.com/riscv/riscv-isa-manual>

[^stack]: A region of memory that holds temporary data with
last-in-first-out rules. Picture a stack of plates fresh from the
dishwasher: every new plate goes on top, and when someone wants a
plate they take from the top. Programs use the stack to track
function calls, local variables, and the return path to the
caller. The stack pointer is the marker at the top: every push
moves it down, every pop moves it back up.
Reference: RISC-V calling convention at
<https://github.com/riscv-non-isa/riscv-elf-psabi-doc>

[^hartid]: Hardware Thread ID. RISC-V's name for a CPU core's
identifier. Hart is short for hardware thread. Hart 0 is the first
core.
Reference: <https://github.com/riscv/riscv-isa-manual>

[^smode]: RISC-V has three privilege levels. M-mode is the machine
mode, used by the firmware. S-mode is the supervisor mode, used by
the kernel. U-mode is the user mode, used by regular programs. M
is most privileged, U is least.
Reference: Privileged Architecture spec at
<https://github.com/riscv/riscv-isa-manual>

[^sbi]: Supervisor Binary Interface. The contract between the
kernel (in S-mode) and the firmware (in M-mode). When the kernel
needs to do something only firmware can do, it calls into SBI.
Reference: <https://github.com/riscv-non-isa/riscv-sbi-doc>

[^opensbi]: An open-source implementation of SBI. What QEMU uses
by default. It runs first at boot, then hands off to the kernel.
Reference: <https://github.com/riscv-software-src/opensbi>

[^dbcn]: Debug Console Extension. A part of SBI 2.0+ that lets the
kernel print characters via the firmware.
Reference: DBCN extension chapter at
<https://github.com/riscv-non-isa/riscv-sbi-doc>

[^virt]: QEMU's generic virtual platform. `-M virt` gives you a
synthetic board with a CPU, memory, a UART, and a PCIe bus.
Reference: <https://www.qemu.org/docs/master/system/riscv/virt.html>

[^gdbstub]: A small piece of code that speaks the GDB Remote Serial
Protocol over a TCP socket. QEMU has one built in. A debugger can
connect to it and step through code running inside QEMU.
Reference: <https://www.qemu.org/docs/master/system/gdb.html>

[^dwarf]: A standard format for storing source-level debug info
inside a compiled binary: function names, variable types, line
numbers. With DWARF, a debugger can tell us we are at line 42 of
`init/main.c` instead of just an address like 0xffffffff80123456.
Reference: <https://dwarfstd.org/>

[^vmlinux]: The unstripped ELF version of the Linux kernel produced
by the build. Contains all symbol tables and debug info. The
`Image` file we boot from is `vmlinux` with the debug info
stripped and the ELF wrapper removed.
Reference: <https://docs.kernel.org/admin-guide/bug-hunting.html>

[^resetvector]: The address the CPU jumps to on power-up or reset.
The very first instruction the system runs lives there. On QEMU's
RISC-V virt machine, the reset vector points into a small ROM
containing a few instructions that hand off to OpenSBI.
Reference: <https://www.qemu.org/docs/master/system/riscv/virt.html>

[^pointer]: A number that holds the memory address of some data,
not the data itself. Picture a sticky note with a locker number
on it: the note is tiny, but the locker is where the stuff
actually lives. To get the stuff, you read the number, walk to
that locker, and open it. In our asm, `a1 = msg` writes the
locker number where "Hello, World!\n" lives into `a1`. The
kernel then uses that number to walk to the locker and read the
bytes there.
Reference: <https://en.cppreference.com/w/c/language/pointer>

[^pc]: Program Counter. A special CPU register that holds the
address of the next instruction to execute. After the CPU finishes
one instruction, it reads the next one from the address in the
program counter.
Reference: RISC-V Unprivileged ISA spec at
<https://github.com/riscv/riscv-isa-manual>

[^register]: A small storage cell built directly into the CPU.
Reading or writing a register is much faster than memory, because
the register lives inside the CPU itself while memory sits
outside. An analogy: memory is the pantry, huge but you have to
walk to it; the register is the small workspace on the counter
next to the stove, tiny but instantly within reach. RISC-V has 32
general-purpose registers, named `x0` through `x31`, with ABI
names like `a0`-`a7` for arguments, `t0`-`t6` for temporaries,
and `s0`-`s11` for saved values.
Reference: RISC-V Unprivileged ISA spec at
<https://github.com/riscv/riscv-isa-manual>

[^sp]: Stack Pointer. A CPU register holding the current top of
the stack. Pushing data onto the stack moves the stack pointer
down. Popping data moves it back up.
Reference: RISC-V calling convention at
<https://github.com/riscv-non-isa/riscv-elf-psabi-doc>

[^breakpoint]: A marker that tells the debugger to pause execution
when the program reaches a specific function or address. While
paused, the debugger can inspect registers, memory, and variables
before letting the program continue.
Reference: <https://lldb.llvm.org/use/tutorial.html>

[^ecall]: Environment Call instruction. The RISC-V trap instruction.
From U-mode it traps into S-mode, where the kernel runs. It's how
a syscall is initiated.
Reference: Unprivileged ISA spec at
<https://github.com/riscv/riscv-isa-manual>

[^sret]: Supervisor Return instruction. The return half of `ecall`.
It drops privilege from S-mode back to U-mode and resumes execution
in userspace.
Reference: Privileged Architecture spec at
<https://github.com/riscv/riscv-isa-manual>

[^trap]: A controlled jump from a less-privileged mode to a more-
privileged one. Triggered by exceptions, interrupts, or the `ecall`
instruction.
Reference: Privileged Architecture spec at
<https://github.com/riscv/riscv-isa-manual>

[^initramfs]: Initial RAM Filesystem. A cpio archive the kernel
unpacks into memory at boot. The kernel runs `/init` from it.
Reference: <https://docs.kernel.org/filesystems/ramfs-rootfs-initramfs.html>

[^cpio]: Copy In, Out. A simple Unix archive format. Used for the
kernel initramfs because the kernel's unpacker doesn't need a real
filesystem yet.
Reference: <https://www.gnu.org/software/cpio/manual/cpio.html>

[^hvc]: Hypervisor Virtual Console. A Linux console framework used
by consoles that don't fit the regular UART model, including the
SBI debug console on RISC-V.
Reference: <https://github.com/torvalds/linux/blob/master/drivers/tty/hvc/Kconfig>

[^earlycon]: A kernel boot parameter that turns on a minimal console
driver very early in boot, before the main console is registered.
Useful for capturing crash messages and configuration errors that
would otherwise be lost during early startup.
Reference: <https://docs.kernel.org/admin-guide/kernel-parameters.html>

[^kconfig]: The kernel's configuration system. Files literally
named `Kconfig` describe options. Tools in `scripts/kconfig/`
parse them and produce a `.config` file.
Reference: <https://docs.kernel.org/kbuild/kconfig-language.html>

[^defconfig]: A default `.config` for an architecture, living at
`arch/<arch>/configs/defconfig`. Running `make defconfig` resets
to that baseline.
Reference: <https://docs.kernel.org/kbuild/kconfig.html>

[^printk]: The kernel's `printf`. It writes to a ring buffer in
memory.
Reference: <https://docs.kernel.org/core-api/printk-basics.html>

[^apfs]: Apple File System. The default filesystem on modern
macOS. Case-insensitive by default.
Reference: <https://support.apple.com/guide/disk-utility/file-system-formats-dsku19ed921c/mac>

[^applesilicon]: Apple's branding for ARM-based Macs starting with
the M1. The CPU architecture is ARM64.
Reference: <https://support.apple.com/en-us/HT211814>

[^crosscompile]: Building a binary for a different architecture
than the machine you're building on. Compiling a RISC-V kernel on
an ARM Mac is cross-compilation.
Reference: <https://clang.llvm.org/docs/CrossCompilation.html>

[^pidone]: Process ID 1. The first userspace process the kernel
runs. If PID 1 dies, the kernel panics.
Reference: <https://man7.org/linux/man-pages/man7/boot.7.html>

[^init]: The first userspace program the kernel runs after
booting. The kernel looks for `/init` in the initramfs and
executes it. Common implementations on real Linux systems are
systemd, sysvinit, and OpenRC.
Reference: <https://man7.org/linux/man-pages/man7/boot.7.html>

[^lld]: LLVM's linker. Comes with clang. On macOS it's already
installed once you `brew install llvm`.
Reference: <https://lld.llvm.org/index.html>

[^imagebase]: The starting address where the linker places a
program in memory. `lld` picks a default based on the target
platform. The default can be overridden with
`-Wl,--image-base=ADDR` at link time.
Reference: <https://lld.llvm.org/>

[^libc]: C standard library. Provides functions like `printf`,
`malloc`, `strcpy`, plus the startup code that calls your `main`.
We skip it in our init to keep the binary tiny.
Reference: <https://sourceware.org/glibc/manual/2.39/html_node/Introduction.html>

[^crt0]: Tiny startup code linked into a binary by default. It
sets up the stack, calls `main`, then calls `exit` when main
returns. Without crt0, you have to write `_start` yourself.
Reference: <https://sourceware.org/git/?p=glibc.git;a=tree;f=csu>

[^fd]: A small integer the kernel hands back when a program opens
something. The thing opened can be a regular file, a device
driver, a network socket, a pipe, or the console. The shell `|`
operator works because the kernel can connect one program's
output fd 1 to the next program's input fd 0. Every process
starts with three fds already open: 0 for input, 1 for output, 2
for errors.
Reference: <https://man7.org/linux/man-pages/man2/open.2.html>

[^disassembly]: Reading a compiled binary by translating its
machine code back into assembly instructions. Useful for checking
what the compiler actually produced.
Reference: <https://llvm.org/docs/CommandGuide/llvm-objdump.html>

[^registerasm]: A GCC and Clang extension that pins a C variable
to a specific hardware register. Written as
`register long var asm("a0") = value;`. The `register` keyword
and the `asm(...)` clause must both be present.
Reference: <https://gcc.gnu.org/onlinedocs/gcc/Local-Register-Variables.html>

[^mknod]: A Unix command that creates special files like device
nodes. For example, `mknod /dev/console c 5 1` makes a character
device named `/dev/console` with major number 5 and minor number 1.
Reference: <https://man7.org/linux/man-pages/man1/mknod.1.html>

[^userspace]: The world where regular programs run, separate from
the kernel. The CPU enforces a hard boundary: userspace code runs
at a lower privilege level and cannot directly touch hardware or
kernel memory. To do anything across that boundary, like reading a
file, writing to the screen, or exiting the program, userspace
asks the kernel through a syscall.
Reference: <https://man7.org/linux/man-pages/man2/intro.2.html>

[^magicbytes]: A unique sequence at the start of a file that
identifies its format. ELF starts with `7F 45 4C 46`, gzip with
`1F 8B 08`, PNG with `89 50 4E 47`. Tools that handle multiple
formats check these bytes to know which format the file is.
Reference: <https://man7.org/linux/man-pages/man1/file.1.html>
