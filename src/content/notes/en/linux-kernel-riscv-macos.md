---
title: "Linux Kernel for RISC-V Build Commands on macOS"
description: "Common commands for building, booting, and debugging a Linux kernel for RISC-V on an Apple Silicon Mac with QEMU and LLDB."
publishedAt: 2026-05-18
tags:
  - linux
  - kernel
  - riscv
  - qemu
  - lldb
  - macos
---

Quick reference for the workflow walked through in [How I Compiled and Ran a Linux Kernel for RISC-V on My Apple Silicon Mac](https://jefrydco.id/blog/compile-run-linux-kernel-riscv-apple-silicon-mac-qemu).

## Generate a Starting Config

```bash
cd /Volumes/linuxkernel/linux
gmake ARCH=riscv LLVM=1 defconfig
```

## Toggle Config Options

```bash
./scripts/config --enable NONPORTABLE
./scripts/config --enable HVC_RISCV_SBI
gmake ARCH=riscv LLVM=1 olddefconfig
```

## Verify a Config Option

```bash
grep -E "^CONFIG_HVC_RISCV_SBI" .config
```

## Build the Kernel

```bash
gmake ARCH=riscv LLVM=1 -j$(nproc) \
  HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types -D_UUID_T"
```

## Build the Init Binary

```bash
clang --target=riscv64-linux-gnu -static -nostdlib -fuse-ld=lld \
  -o /Volumes/linuxkernel/initramfs/init \
  /Volumes/linuxkernel/initramfs/init.c
```

## Repack the Initramfs

```bash
/Volumes/linuxkernel/linux/usr/gen_init_cpio /Volumes/linuxkernel/initramfs.txt \
  | gzip > /Volumes/linuxkernel/initramfs.cpio.gz
```

## Boot in QEMU

```bash
qemu-system-riscv64 -M virt -nographic \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -append "earlycon=sbi console=hvc0"
```

## Boot for Debugging

CPU paused, gdb stub on port 1234.

```bash
qemu-system-riscv64 -M virt -nographic \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -append "earlycon=sbi console=hvc0" \
  -s -S
```

## Attach LLDB

Run in another terminal while QEMU is paused.

```bash
lldb /Volumes/linuxkernel/linux/vmlinux
# Then inside lldb:
#   gdb-remote localhost:1234
#   breakpoint set --name start_kernel
#   continue
```
