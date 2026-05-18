---
title: "Perintah Build Kernel Linux untuk RISC-V di macOS"
description: "Perintah-perintah umum untuk mem-build, mem-boot, dan men-debug kernel Linux untuk RISC-V di Mac Apple Silicon dengan QEMU dan LLDB."
publishedAt: 2026-05-18
tags:
  - linux
  - kernel
  - riscv
  - qemu
  - lldb
  - macos
---

Referensi cepat untuk alur kerja yang dibahas di [Cara Saya Mengompilasi dan Menjalankan Kernel Linux untuk RISC-V di Mac Apple Silicon](https://jefrydco.id/blog/compile-run-linux-kernel-riscv-apple-silicon-mac-qemu).

## Buat Config Awal

```bash
cd /Volumes/linuxkernel/linux
gmake ARCH=riscv LLVM=1 defconfig
```

## Aktifkan Opsi Konfigurasi

```bash
./scripts/config --enable NONPORTABLE
./scripts/config --enable HVC_RISCV_SBI
gmake ARCH=riscv LLVM=1 olddefconfig
```

## Verifikasi Opsi Konfigurasi

```bash
grep -E "^CONFIG_HVC_RISCV_SBI" .config
```

## Build Kernel

```bash
gmake ARCH=riscv LLVM=1 -j$(nproc) \
  HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types -D_UUID_T"
```

## Build Binary Init

```bash
clang --target=riscv64-linux-gnu -static -nostdlib -fuse-ld=lld \
  -o /Volumes/linuxkernel/initramfs/init \
  /Volumes/linuxkernel/initramfs/init.c
```

## Repack Initramfs

```bash
/Volumes/linuxkernel/linux/usr/gen_init_cpio /Volumes/linuxkernel/initramfs.txt \
  | gzip > /Volumes/linuxkernel/initramfs.cpio.gz
```

## Boot di QEMU

```bash
qemu-system-riscv64 -M virt -nographic \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -append "earlycon=sbi console=hvc0"
```

## Boot untuk Debugging

CPU dijeda, _gdb stub_ di port 1234.

```bash
qemu-system-riscv64 -M virt -nographic \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -append "earlycon=sbi console=hvc0" \
  -s -S
```

## Sambungkan LLDB

Jalankan di _terminal_ terpisah ketika QEMU sedang dijeda.

```bash
lldb /Volumes/linuxkernel/linux/vmlinux
# Lalu di dalam lldb:
#   gdb-remote localhost:1234
#   breakpoint set --name start_kernel
#   continue
```
