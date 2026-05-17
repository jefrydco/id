---
title: "Cara Saya Mengompilasi dan Menjalankan Kernel Linux untuk RISC-V di Mac Apple Silicon"
description: "Cross-compile dan boot kernel Linux untuk RISC-V di Mac Apple Silicon dengan LLVM, QEMU, LLDB, dan binary init yang ditulis dari nol."
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

> Saya menulis ini saat masih mempelajari topik ini. Mungkin saya belum sepenuhnya memahami semua yang saya tulis di sini, dan beberapa bagiannya mungkin keliru. Saat Kamu membacanya, mungkin saya sudah memahaminya lebih baik. Jika Kamu memiliki komentar atau masukan, saya akan sangat senang mendengarnya.

## Mengapa Saya Melakukan Ini

Saya sudah menulis _software_ selama bertahun-tahun, tetapi selalu di level tinggi. _Web apps_ dan _Node apps_. Kernel selalu terasa seperti kotak hitam bagi saya. Saya mengetik di _keyboard_, menggerakkan _mouse_, sesuatu muncul di layar. Tetapi di antara semua itu, banyak hal terjadi di dalam kernel, dan saya tidak pernah memahami bagian itu.

Saya ingin membuka kotak itu.

Satu hal mendasar yang baru saya pahami dari video ini adalah Linux hanyalah sebuah kernel, dan kernel saja belum bisa menampilkan apa pun ke pengguna. Kernel mem-_boot_, menyiapkan dirinya, lalu menyerahkan kendali ke program _userspace_[^userspace] pertama yang diberikan. Program pertama itulah yang disebut init[^init]. Linux sendiri tidak membawa init. Init bisa apa saja: _systemd_ atau _sysvinit_ pada _desktop_ biasa, atau program C 14 baris buatan saya sendiri di artikel ini.

::youtube{id="SwIPOf2YAgI"}

Dari situ saya mulai mencari cara mem-_build_ kernel sendiri. Linux _open source_, jadi saya coba membacanya. _Codebase_-nya sangat besar dan saya tersesat. Saya juga sadar bahwa untuk mulai mem-_build_, saya harus memilih satu arsitektur CPU dulu sebagai target.

Pengetahuan saya tentang arsitektur CPU hampir nol. Yang saya tahu, Mac saya menggunakan Apple Silicon[^applesilicon], yang berarti ARM64, dan sebagian besar PC menggunakan x86. Saya mulai mencari arsitektur yang paling ramah untuk pemula, dan jawaban yang terus muncul adalah RISC-V[^riscv]. Kecil, dirancang agar sederhana, dan tidak perlu membayar apa pun untuk membaca spesifikasinya. Akhirnya saya memilih RISC-V.

Masalahnya, saya tidak memiliki _hardware_ RISC-V. Jadi saya harus _cross-compile_[^crosscompile]: mem-_build_ kernel untuk RISC-V di Mac ARM64 saya, lalu mem-_boot_-nya di dalam QEMU yang mengemulasi RISC-V.

Itu berarti saya butuh panduan yang sudah teruji untuk mem-_build_ Linux di macOS untuk RISC-V. Saya menemukannya di [_Building Linux Kernel on macOS Natively_](https://seiya.me/blog/building-linux-on-macos-natively) oleh Seiya, yang menangani sisi _build_-nya dengan rapi. Saya melanjutkan dari sana: menjalankan kernel di QEMU, menulis _binary_ init sendiri, dan menelusuri _boot_-nya dengan _lldb_.

Artikel ini menjelaskan perjalanan saya, _error_ demi _error_. Sebagian _error_ langsung terlihat jelas, sebagian lagi butuh waktu berjam-jam untuk dipahami. _Build_ dan _boot_-nya sama-sama gagal di percobaan pertama. Program pertama yang saya tulis dalam bahasa C terkena _compiler bug_, dan saya harus menelusuri _disassembly_-nya cukup lama untuk menemukan penyebabnya. Tetapi pada akhirnya, saya memiliki kernel yang saya _build_ sendiri yang mem-_boot_ program _userspace_ yang juga saya tulis sendiri, keduanya berjalan di _hardware_ yang diemulasikan di _laptop_ saya. Momen tersebutlah yang membuat semua ini layak dilakukan.

Berikut yang akan kita lakukan:

1. Menyiapkan _toolchain_
2. Mengunduh kode sumber kernel ke Mac
3. Mengompilasi kernel
4. Mem-_boot_-nya di QEMU
5. Menulis program init kecil dengan bahasa C
6. Menelusuri _boot_ dari dalam menggunakan _lldb_

## Prasyarat

Untuk membangun kernel di Mac, kita membutuhkan beberapa _tool_ yang tidak ada secara bawaan di macOS. Sebagian besar dapat dipasang melalui Homebrew. Saya mengasumsikan Kamu sudah memiliki Homebrew. Jika belum, ikuti panduan pemasangan di [brew.sh](https://brew.sh).

Berikut yang kita butuhkan dan alasannya:

- **LLVM (`clang` dan `lld`[^lld])**: kernel dapat dibangun menggunakan _clang_ dengan _flag_ `LLVM=1`, sehingga kita tidak perlu memasang _cross-gcc toolchain_ secara terpisah. macOS sudah memiliki _clang_ bawaan dari Apple, namun versinya lebih lama dan mungkin belum mendukung semua fitur yang dibutuhkan _build_ kernel. Homebrew memberi kita _clang_ dan _lld_ versi terbaru dalam satu paket.
- **GNU make**: macOS hanya memiliki _BSD make_ secara bawaan, sedangkan kernel membutuhkan _GNU make_. Setelah dipasang, kita akan memanggilnya sebagai `gmake`.
- **coreutils**: _script build_ kernel menggunakan beberapa perintah seperti `nproc` dan `head` yang tidak tersedia di macOS, atau tersedia tetapi dalam versi BSD yang perilakunya sedikit berbeda.
- **gnu-sed**: _script_ kernel mengasumsikan _sed_ versi GNU.
- **findutils**: _script_ kernel menggunakan `find -printf` yang tidak ada di _BSD find_.
- **libelf**: dibutuhkan oleh beberapa _tool_ kernel untuk mengurai _file_ ELF[^elf].
- **QEMU**: untuk menjalankan kernel yang sudah kita bangun.

Pasang semuanya sekaligus dengan satu perintah:

```sh
brew install llvm make coreutils libelf gnu-sed findutils qemu
```

Setelah pemasangan selesai, kita perlu mengatur PATH agar `llvm` dari Homebrew dan versi GNU dari `coreutils`, `gnu-sed`, dan `findutils` didahulukan daripada versi bawaan macOS. Tambahkan baris berikut ke `~/.zshrc`:

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

Setelah itu, jalankan `source ~/.zshrc` atau buka _terminal_ baru. Untuk memastikan semuanya sudah benar, jalankan `clang --version` dan `find --version | head -1`. Versi _clang_ seharusnya menyebutkan "Homebrew" bukan Apple, sementara _find_ menunjukkan "GNU findutils".

## Meng-_clone_ Kernel

Sekarang kita sudah memiliki _toolchain_-nya. Saatnya mengunduh kode sumbernya. Kernel Linux berada di `git.kernel.org` dan di-_mirror_ ke GitHub. Mari kita _clone_. Kita menggunakan _flag_ `--depth=1` agar yang diunduh hanya _snapshot_ terbaru saja, bukan seluruh _history_-nya. Kita tidak membutuhkan _history_-nya untuk proyek ini.

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

Proses _clone_ selesai, namun di bagian akhir git memberi peringatan panjang: *"the following paths have collided (e.g. case-sensitive paths on a case-insensitive filesystem) and only one from the same colliding group is in the working tree"*.

Kernel memiliki _file-file_ yang namanya hanya berbeda pada kapitalisasinya. Perhatikan daftar pada peringatan tersebut. `xt_CONNMARK.h` dan `xt_connmark.h` berada di direktori yang sama. Begitu juga dengan `xt_DSCP.h` dan `xt_dscp.h`. Perbedaan antara setiap pasangan _file_ tersebut hanyalah kapitalisasinya. Di Linux, keduanya adalah dua _file_ yang berbeda. Di APFS[^apfs] macOS, yang bersifat _case-insensitive_ secara _default_, keduanya dianggap sebagai _file_ yang sama. Hanya satu _file_ dari setiap pasangan yang bertabrakan tersebut yang akhirnya tersimpan di _disk_.

Bahkan jika kita mengabaikan peringatan tersebut, hal ini tetap membuat _build_ gagal. _File header_ yang kita butuhkan tidak ada di _disk_ karena sudah digantikan oleh pasangan _case-collision_-nya.

Kita membutuhkan _filesystem_ yang _case-sensitive_.

## Membuat Ruang Kerja yang _Case-Sensitive_

macOS tidak memungkinkan kita mengubah _case-sensitivity_ pada _disk_ yang sudah ada, namun kita masih bisa membuat _volume_ terpisah yang bersifat _case-sensitive_. Perintah `hdiutil` bisa membuat _sparse disk image_ yang kemudian dapat kita _attach_ sebagai _volume_.

Saya membuat _sparse image_ berukuran 20 GB di `~/Learning/LINUX/linuxkernel.dmg`. _Sparse_ artinya _file_-nya hanya akan membesar seiring penggunaannya. Kode sumber kernel beserta direktori _build_-nya cukup muat dalam 20 GB.

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

Setelah di-_attach_, _volume_-nya muncul di `/Volumes/linuxkernel/`. Mulai sekarang, kita bekerja di dalam _volume_ tersebut. Mari kita _clone_ ulang kernel di sana:

```sh
cd /Volumes/linuxkernel
git clone --depth=1 \
  git://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git
```

Kali ini proses _clone_ selesai tanpa peringatan _case-collision_. Semua _file_ sudah berada di _disk_.

## Kesalahan Memilih _allnoconfig_

Saya ingin memulai dari skala kecil. Kernel memiliki ribuan opsi, dan saya pikir akan belajar lebih cepat jika memulai dari nol dan menambahkan sesuatu hanya saat dibutuhkan. Jadi saya memilih `allnoconfig`, yang menonaktifkan setiap opsi yang dikenali oleh Kconfig[^kconfig].

Ini adalah pilihan yang salah untuk _build_ pertama, namun saat itu saya belum tahu.

```sh
gmake ARCH=riscv LLVM=1 allnoconfig
```

Hal pertama yang terjadi di luar dugaan: _clang_ menolak dijalankan.

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

Penyebabnya adalah sebuah _file_ konfigurasi di `~/.config/clang/arm64-apple-darwin25.cfg` yang saya gunakan untuk proyek lain. _Clang_ secara otomatis memuat konfigurasi ini pada setiap pemanggilan. Berikut isinya:

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

Ini adalah _flag-flag_ C++ yang saya gunakan untuk proyek pribadi: _include path_ Boost, _link path_ libc++, dan `-std=c++26`. Ketika _build_ kernel memanggil _clang_, _clang_ secara otomatis mengambil _flag-flag_ tersebut, mencoba mengompilasi kode C kernel dengan standar C++26, dan _build_-nya pun gagal.

Solusinya adalah memindahkan _file_ tersebut:

```sh
mv ~/.config/clang/arm64-apple-darwin25.cfg \
   ~/.config/clang/arm64-apple-darwin25.cfg.bak
```

Sekarang `gmake` dapat memanggil _clang_. Saya menjalankan ulang `allnoconfig` untuk menghasilkan _file_ `.config`:

```sh
gmake ARCH=riscv LLVM=1 allnoconfig
```

```text
❯ gmake ARCH=riscv LLVM=1 allnoconfig
#
# configuration written to .config
#
```

Kali ini berhasil. Setelah itu saya mencoba _build_-nya:

```sh
gmake ARCH=riscv LLVM=1 -j$(nproc)
```

_Flag_ `-j$(nproc)` memberi tahu _make_ berapa _job_ kompilasi yang harus dijalankan secara paralel. `nproc` adalah bagian dari _coreutils_ yang sudah kita pasang sebelumnya, dan akan mencetak jumlah _processor_ di mesin. Di Mac dengan 8 _core_, ini menjadi `-j8`. Kernel memiliki ribuan _file_ yang independen, jadi kompilasi paralel memangkas waktu _build_ secara signifikan.

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

Ini adalah _error_ pertama yang berasal dari kernel. _Build_-nya memanggil _host tools_, program-program yang berjalan di Mac saya untuk menyiapkan kode sumber kernel agar dapat dikompilasi. _Host tools_ tersebut menyertakan _header_ yang tidak tersedia di macOS. Kita membutuhkan solusi yang berbeda.

## _Shim_ `macos-include`

Pendekatan _shim_ di bagian ini mengikuti [artikel Seiya](https://seiya.me/blog/building-linux-on-macos-natively) yang saya rujuk di pendahuluan.

_Error_ elf.h tersebut memberi tahu kita bahwa salah satu _host tool_ mencari `<elf.h>`, namun macOS tidak menyediakan elf.h. Paket `libelf` yang sudah kita pasang sebelumnya menyediakan _header_ yang setara, hanya saja _path_-nya berbeda: `<libelf/gelf.h>`.

Kita membutuhkan lapisan _indirection_. Buat direktori `scripts/macos-include/` dan tambahkan _stub_ `elf.h` yang mengarahkan ke _header_ libelf:

```c
// scripts/macos-include/elf.h
#pragma once
#include <libelf/gelf.h>
#define STT_SPARC_REGISTER 3
#define R_386_32 1
```

Kemudian jalankan ulang gmake, dengan memberi tahu _clang_ lokasi _shim_ kita dan _header_ libelf:

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

_Build_-nya berhasil melewati _error_ elf.h, namun kini mendapatkan peringatan _pointer types_. Fungsi-fungsi gelf milik libelf mengembalikan tipe yang sedikit berbeda dari yang diharapkan _host tool_, dan _build_-nya memperlakukan peringatan ini sebagai _error_. Kita matikan dengan `-Wno-incompatible-pointer-types`:

```sh
gmake ARCH=riscv LLVM=1 -j$(nproc) \
  HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types"
```

Mengapa kita memilih mematikan peringatannya, bukan memperbaikinya? Ketidakcocokan ini hanyalah masalah kosmetik di level _C type system_. _Pointer_ dari libelf menunjuk ke data dengan _layout_ yang sama dengan yang diharapkan _host tool_, hanya dideklarasikan dengan tipe yang sedikit berbeda. _Tool_-nya tetap berjalan dengan benar. Memperbaikinya dengan benar akan membutuhkan _patching_ kode sumber kernel itu sendiri, yang berarti memelihara _fork_ lokal. Mematikan peringatan hanya berdampak pada _build_ kita sendiri dan menjaga direktori kernel tetap bersih.

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

_Header_ berikutnya yang hilang: `byteswap.h`. macOS tidak memilikinya, tetapi _clang_ menyediakan _builtin_[^builtin] untuk _byte-swapping_. Kita tambahkan _stub_-nya:

```c
// scripts/macos-include/byteswap.h
#pragma once
#define bswap_16 __builtin_bswap16
#define bswap_32 __builtin_bswap32
#define bswap_64 __builtin_bswap64
```

Jalankan ulang gmake:

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

Ada dua _error_ berbeda yang muncul bersamaan di sini.

**`uuid_t` _redefinition_** di `file2alias.c`. Baik `<unistd.h>` milik macOS maupun _host tool_ kernel mendefinisikan `uuid_t`, namun dengan bentuk yang berbeda. Versi macOS adalah `unsigned char[16]`, sedangkan versi kernel adalah _struct_. _Header_ macOS membungkus _typedef_-nya dengan pemeriksaan `#ifndef _UUID_T`, jadi jika kita mendefinisikan `_UUID_T` terlebih dahulu di _command line_, _header_ tersebut akan menganggap `_UUID_T` sudah ada dan melewati _typedef_-nya. Hanya definisi versi kernel yang tersisa. Tambahkan `-D_UUID_T` ke HOSTCFLAGS.

**Banyak konstanta _relocation_ `R_*` yang hilang** di `modpost.c` dan `file2alias.c`. _Host tool_ kernel menangani _relocation_ untuk berbagai arsitektur CPU, termasuk x86, ARM, MIPS, dan AArch64. Konstantanya berasal dari `elf.h` Linux. _Shim_ kita baru berisi `R_386_32` saja. Perbarui `scripts/macos-include/elf.h` dengan sisanya:

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

Jalankan ulang dengan kedua perbaikan: konstanta tambahan di elf.h dan `-D_UUID_T` di HOSTCFLAGS:

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

`-D_UUID_T` memblokir _typedef_ `uuid_t` milik macOS, persis seperti yang kita inginkan. Tetapi `<gethostuuid.h>`, yang ikut di-_include_ oleh `<unistd.h>`, juga merujuk ke `uuid_t` dan kini gagal. Ganti _header_ tersebut dengan _stub_ kosong:

```c
// scripts/macos-include/gethostuuid.h
#pragma once
```

Sekarang _host tool_ berhasil di-_build_ tanpa masalah. Direktori `scripts/macos-include/` berisi tiga _file_ kecil: `elf.h`, `byteswap.h`, dan `gethostuuid.h`, ditambah dua _flag_ untuk HOSTCFLAGS: `-Wno-incompatible-pointer-types` dan `-D_UUID_T`.

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

## _Binary_ Init 14 Baris

Kernel membutuhkan sebuah program _userspace_[^userspace] untuk dijalankan sebagai PID 1[^pidone] setelah _boot_-nya selesai. Pada sistem Linux yang sebenarnya, biasanya berupa _systemd_ atau _sysvinit_. Kita hanya butuh sesuatu yang kecil untuk membuktikan kode kita sendiri sedang berjalan di _userspace_.

Bentuk paling kecilnya adalah program yang mencetak `Hello, World!` lalu melakukan _loop_ tanpa henti. Ini programnya:

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

Mari kita telusuri tiap bagiannya.

`_start` bukan `main`. Kernel akan melompat ke alamat _entry point_ yang ditunjuk oleh _binary_ ELF[^elf]. Pada sistem normal, _entry_ tersebut adalah `_start`. `_start` disediakan oleh kode _startup_ libc[^libc] bernama crt0[^crt0], yang menyiapkan argc/argv lalu memanggil `main` kita. Karena kita tidak me-_link_ libc, kita menamai fungsi kita `_start` secara langsung tanpa melalui crt0.

_Keyword_ `__asm__` adalah ekstensi GCC dan Clang yang memungkinkan kita menyematkan instruksi _assembly_ di dalam kode C. _Keyword_ `volatile` memberi tahu _compiler_ agar tidak menghapus atau memindahkan blok ini. _Syscall_ menulis _byte_ ke _file descriptor_, dan efek samping ini tidak terlihat oleh _compiler_ jika hanya membaca kode C-nya.

Blok ini memanggil _syscall_[^syscall] Linux menggunakan ABI[^abi] RISC-V.

Bagian _asm_-nya menggunakan dua instruksi RISC-V: `li` ("load immediate") menaruh konstanta ke dalam _register_[^register], dan `mv` ("move") menyalin nilai sebuah _register_ ke _register_ lain. Pada `mv a1, %0`, `%0` adalah _placeholder_ yang digantikan _compiler_ dengan _register_ yang menampung `msg`. Jadi blok ini menyiapkan empat argumen pada _register_ lalu menjalankan `ecall`:

- `a7 = 64`: nomor _syscall_ untuk `write` di RISC-V
- `a0 = 1`: _file descriptor_[^fd] stdout
- `a1 = msg`: _pointer_[^pointer] ke _string_ yang ingin ditulis
- `a2 = 14`: jumlah _byte_ dari "Hello, World!\n"

`ecall`[^ecall] adalah instruksi yang memicu _trap_[^trap] dari _U-mode_[^smode] ke _S-mode_ untuk meminta kernel menjalankan _syscall_ tersebut.

`while(1)` di akhir: PID 1 tidak boleh _return_. Tidak ada fungsi yang memanggilnya, jadi tidak ada tempat untuk kembali. Jika `_start` tetap _return_, kernel akan _panic_ karena PID 1 telah berhenti. Karena itu kita melakukan _loop_ tanpa henti.

Kompilasi dengan `clang`:

```sh
clang --target=riscv64-linux-gnu \
  -static \
  -nostdlib \
  -fuse-ld=lld \
  -o /Volumes/linuxkernel/initramfs/init \
  /Volumes/linuxkernel/initramfs/init.c
```

Setiap _flag_ memiliki peran masing-masing:

- `--target=riscv64-linux-gnu`: memberi tahu `clang` agar menghasilkan kode RISC-V Linux, bukan ARM64 milik _host_. Ini yang menentukan target _cross-compile_[^crosscompile]-nya.
- `-static`: me-_link_ _binary_ secara statis. Tanpa _dynamic loader_, tanpa _shared library_. Kernel akan mengeksekusi _binary_ ini secara langsung, tanpa mekanisme `/lib/ld-linux*.so` yang biasa, karena _initramfs_ kita tidak berisi _file-file_ tersebut.
- `-nostdlib`: melewati _libc startup objects_ seluruhnya. Tanpa ini, `clang` akan mencoba me-_link_ crt0 dan libc, yang akan bentrok dengan `_start` buatan kita.
- `-fuse-ld=lld`: gunakan _lld_[^lld] dari LLVM dan bukan _linker_ bawaan _host_. _Linker_ bawaan macOS hanya mengenal _Mach-O_[^macho], format _binary_ macOS. Kita membutuhkan _binary_ ELF untuk Linux, dan _lld_ menghasilkan ELF.

Mari kita _disassemble_ _binary_-nya untuk melihat apa yang dihasilkan `clang`:

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

Sebelum kita lanjut, sedikit pembahasan tentang alamat-alamat _hex_ tersebut, karena akan terus muncul mulai dari sini. Memori adalah satu _array_ besar yang berisi _byte_. Setiap _byte_ memiliki indeks. Kita menuliskan indeks tersebut dalam _hex_, yaitu sistem bilangan basis 16. _Hex_ dipetakan dengan rapi ke biner karena setiap digit _hex_ setara dengan empat _bit_ biner. Jadi `0x111fc` sebenarnya hanya angka 70140 yang ditulis dalam _hex_. Angka yang sama, notasi yang berbeda.

Satu hal penting sebelum kita lanjut: alamat-alamat ini adalah _virtual address_[^mmu], bukan lokasi RAM fisik. Setiap program _userspace_ memiliki ruang alamatnya sendiri. Kernel mengatur MMU agar _virtual address_ `0x111fc` di program kita dipetakan ke _byte_ RAM fisik mana pun yang dialokasikan kernel untuk _page_ tersebut. Dua program bisa sama-sama mengklaim _virtual_ `0x10000` tanpa bentrok karena masing-masing memiliki _page table_-nya sendiri.

Mengapa _virtual address_ inilah yang dipilih untuk `_start`? Karena `lld`, _linker_ kita, yang menaruhnya di sana. Ketika _linker_ membangun program, ia memilih sebuah _image base_[^imagebase], yaitu alamat awal di ruang alamat program itu sendiri. Untuk _binary static_ di RISC-V Linux, _image base_ bawaan _lld_ adalah `0x10000`. Dari _base_ tersebut, _linker_ menata _binary_-nya secara berurutan. Pertama, _header_ ELF[^elf], sebuah blok kecil _metadata_ yang menggambarkan _file_-nya. Setelah itu, _program headers_, yang memberi tahu kernel cara memuat setiap bagiannya. Berikutnya, _section_ `.text` dimulai. `.text` berisi kode mesin kita, dan `_start` adalah fungsi pertama di dalamnya. Jadi setelah _headers_-nya selesai, `_start` ditempatkan di `0x111fc`.

```text
0x10000   +---------------------+  <-- image base bawaan lld
          | ELF header          |
          | program headers     |
          | ...                 |
0x111fc   +---------------------+  <-- _start (kode kita dimulai)
          | addi sp, sp, -0x20  |
          | sd   ra, ...        |
          | ...                 |
          | ecall               |
          | j    .              |
0x11242   +---------------------+  <-- akhir _start
```

Jika kita membuat _binary_-nya lebih panjang atau lebih pendek, setiap alamat di dalamnya akan bergeser. Menambahkan _flag_ `-Wl,--image-base=0x12345` ke _clang_ saat _linking_ akan memberi tahu `lld` agar memulai _binary_-nya dari _base_ yang berbeda.

Kernel sendiri berada di alamat tinggi seperti `0xffffffff80c00360`, ditentukan oleh _linker script_ kernel. _Stack_[^stack] di _userspace_ berada di dekat puncak memori yang dapat diakses _userspace_, dipilih oleh kernel saat _runtime_ ketika membuat proses kita. Tidak ada yang acak. Setiap alamat di artikel ini berasal dari tempat yang konkret: _file_ konfigurasi, _linker script_, spesifikasi CPU, atau keputusan yang dibuat oleh kode saat _runtime_.

Sekilas, _disassembly_-nya terlihat baik: nilai-nilai dimuat lalu `ecall` dijalankan. Saya akan kembali ke bagian ini nanti, karena ada _bug_ tersembunyi yang baru saya sadari jauh setelah kernel sudah berjalan dan program-nya tidak menghasilkan _output_ apa pun.

## Mengemas _initramfs_

Kernel dapat melakukan _boot_ dari _initramfs_[^initramfs], tetapi hanya jika kita menyediakannya. _Initramfs_ adalah arsip _cpio_[^cpio] yang berisi _file-file_ yang harus tersedia saat _boot_. Kernel sudah menyertakan _tool_ bernama `gen_init_cpio` yang akan membangun arsip ini dari _file_ spek sederhana. Kita perlu mengompilasinya sendiri lalu menjalankannya.

Percobaan kompilasi pertama mengalami masalah yang sudah tidak asing:

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

`O_LARGEFILE` adalah _fcntl flag_ khusus Linux. macOS tidak membutuhkannya karena semua operasi _file_ secara _default_ sudah 64-bit. Kita tambahkan _shim_ yang membungkus `<fcntl.h>` milik macOS dan mendefinisikan _flag_ yang hilang sebagai 0:

```c
// scripts/macos-include/fcntl.h
#pragma once
#include_next <fcntl.h>
#define O_LARGEFILE 0
```

Kompilasi ulang, kali ini sambil mengarahkan ke _shim_ kita:

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

Berikutnya: `copy_file_range`. Ini adalah _syscall_ Linux yang tidak dimiliki libc macOS. Kita buat _stub_-nya sebagai fungsi yang selalu gagal sehingga kode `gen_init_cpio` akan beralih ke `read`/`write` biasa:

```c
// scripts/macos-include/unistd.h
#pragma once
#include_next <unistd.h>
#include <sys/types.h>
static inline ssize_t copy_file_range(int a, void *b, int c, void *d, size_t e, unsigned int f) { return -1; }
```

Kompilasi ulang. Tanpa _error_. Sekarang kita memiliki `gen_init_cpio`. Tulis [_file_ spek](https://docs.kernel.org/driver-api/early-userspace/early_userspace_support.html) yang menjelaskan isi arsipnya:

```text
# /Volumes/linuxkernel/initramfs.txt
dir  /dev 755 0 0
nod  /dev/console 644 0 0 c 5 1
file /init /Volumes/linuxkernel/initramfs/init 755 0 0
```

Baris `nod` inilah kuncinya. Dari kiri ke kanan: `/dev/console` adalah _path_-nya, `644` adalah _mode file_-nya, dua angka `0` mengatur _owner_ dan _group_ ke root, `c` menandakan ini adalah _character device_, dan `5 1` adalah [_major_ dan _minor number_](https://docs.kernel.org/admin-guide/devices.html) yang Linux peruntukkan untuk konsol sistem. `gen_init_cpio` mencatat semua ini di dalam arsip _cpio_ secara langsung, tanpa perlu _device node_-nya ada di _filesystem_ macOS sama sekali. macOS sebenarnya menyertakan `mknod`[^mknod], tetapi pada Mac modern, perintah ini tidak bisa membuat _device node_ di _filesystem_ biasa. Pendekatan _cpio_ kita tidak memerlukan `mknod` sama sekali.

_Node_-nya cukup ada di dalam arsip, yang akan Linux _unpack_ ke _tmpfs_-nya sendiri saat _boot_. Kernel membutuhkan _device file_ ini karena saat menjalankan proses init kita, ia akan membuka `/dev/console` untuk menyambungkan _stdin_, _stdout_, dan _stderr_. Tanpa _device_ tersebut, _syscall_ `write` ke _fd_ 1 tidak punya tujuan untuk menulis.

Kemas:

```sh
/Volumes/linuxkernel/linux/usr/gen_init_cpio /Volumes/linuxkernel/initramfs.txt \
  | gzip > /Volumes/linuxkernel/initramfs.cpio.gz
```

_Pipeline_ ini menulis arsip _cpio_-nya ke `/Volumes/linuxkernel/initramfs.cpio.gz` dan tidak menghasilkan _output_ di _terminal_. Kita siap mem-_boot_.

## _Boot_ Pertama yang Senyap

Kita sudah memiliki `Image` dan `initramfs.cpio.gz` dengan _binary_ init kecil di dalamnya. Saatnya benar-benar menjalankannya.

QEMU mem-_boot_ menggunakan _virt machine_[^virt] RISC-V, dengan kernel dan _initramfs_ kita, lalu mengarahkan semua I/O ke _terminal_:

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

OpenSBI[^opensbi] mulai berjalan, mencetak _banner_-nya beserta info _platform_, lalu layarnya terdiam begitu saja. Tidak ada _boot message_ kernel. Tidak ada "Hello, World!". Tidak ada apa-apa.

Saya tidak tahu apa yang salah. Kernel seharusnya mengambil alih dari OpenSBI dan mencetak _boot message_-nya sendiri. Tetapi tidak ada yang terjadi. Saya menggali dokumentasi kernel dan Stack Overflow untuk mencari jawaban.

Polanya jelas: hampir tidak ada yang memulai _build_ kernel dari `allnoconfig`. Dengan `allnoconfig` kita sudah mematikan semua yang diizinkan oleh Kconfig, termasuk bagian-bagian kernel yang dibutuhkan untuk sekadar berkomunikasi dengan pengguna. Tidak ada [`HVC_RISCV_SBI`](https://github.com/torvalds/linux/blob/master/drivers/tty/hvc/Kconfig), jadi tidak ada _output_ konsol. Tidak ada [`BLK_DEV_INITRD`](https://docs.kernel.org/admin-guide/initrd.html), jadi tidak ada dukungan _initramfs_. Tidak ada [`BINFMT_ELF`](https://github.com/torvalds/linux/blob/master/fs/Kconfig.binfmt), jadi tidak ada cara untuk menjalankan _binary_ init yang sudah kita _compile_. Titik awal yang direkomendasikan adalah `defconfig`[^defconfig], _default config_ per arsitektur dengan semua opsi dasarnya sudah aktif.

Jadi saya memulai dari awal dengan `defconfig`.

## Memulai dari Awal dengan _defconfig_

Beralih ke `defconfig` berarti menghapus direktori kernel saat ini dan memulai dari awal. Tetapi kita tidak ingin kehilangan direktori `scripts/macos-include/` yang baru saja kita bangun. _File-file_ _shim_ tersebut adalah tambahan lokal, bukan bagian dari kode sumber kernel, sehingga akan hilang ketika kita melakukan _clone_ ulang.

Sebelum menghapus direktorinya, saya menyalin direktori `macos-include/` keluar dari sana ke `~/Learning/LINUX/macos-include/`. Mulai sekarang, _file-file_ _shim_ disimpan di sana dan saya menghubungkannya kembali ke direktori kernel dengan _symlink_. Dengan begitu, kapan pun saya melakukan _clone_ ulang, _shim_-nya akan tetap ada. `init.c` dan `initramfs.cpio.gz` yang sudah dikemas berada di `/Volumes/linuxkernel/initramfs/` dan `/Volumes/linuxkernel/`, di luar direktori kernel, sehingga keduanya juga selamat dari _reset_ ini. Hanya `.config` dan _build artifact_ yang terhapus.

```sh
rm -rf /Volumes/linuxkernel/linux
cd /Volumes/linuxkernel
git clone --depth=1 https://github.com/torvalds/linux.git
ln -s ~/Learning/LINUX/macos-include linux/scripts/macos-include
cd linux
gmake ARCH=riscv LLVM=1 defconfig
```

Apa yang dilakukan perintah-perintah ini:

- `rm -rf` menghapus direktori `allnoconfig`-nya
- `git clone --depth=1` membawa kernel yang baru
- `ln -s` mem-_symlink_ direktori _shim_ yang kita simpan kembali ke `scripts/macos-include/`
- `gmake ... defconfig` menghasilkan `.config` baru dari _default config_ RISC-V

`defconfig` akan mem-_build_ _tools_ Kconfig[^kconfig] terlebih dahulu, lalu menjalankannya untuk menghasilkan _file_ `.config`:

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

## _Flag_ `defconfig` yang Hilang

Setelah `defconfig` siap, saya mem-_build_ ulang kernel dengan _shim_ `macos-include` yang masih dirujuk melalui HOSTCFLAGS:

```sh
gmake ARCH=riscv LLVM=1 -j$(nproc) \
  HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types -D_UUID_T"
```

_Build_ ini memakan waktu jauh lebih lama dibandingkan _build_ `allnoconfig` sebelumnya. `defconfig` mengaktifkan banyak _driver_ dan fitur, sehingga ada lebih banyak kode yang harus dikompilasi. Saat yang tepat untuk istirahat sejenak.

_Build_-nya berjalan tanpa _error_. _Image_ dan _Image.gz_ sudah siap. Saatnya mem-_boot_:

```sh
qemu-system-riscv64 \
  -M virt \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image.gz \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -nographic \
  -append "console=ttyS0"
```

Masih senyap. _Banner_ OpenSBI, lalu tidak ada apa-apa. Sama persis seperti sebelumnya.

Saya kembali mencari. Jawabannya muncul setelah membaca [dokumentasi _virt machine_ QEMU](https://www.qemu.org/docs/master/system/riscv/virt.html) bersama [_file_ Kconfig HVC](https://github.com/torvalds/linux/blob/master/drivers/tty/hvc/Kconfig) di kernel. Untuk _virt machine_ RISC-V milik QEMU, _driver_ konsol yang tepat adalah `HVC_RISCV_SBI`[^hvc], yang berkomunikasi dengan konsol _debug_ SBI[^sbi] milik OpenSBI yang disebut DBCN[^dbcn]. Ternyata `defconfig` juga tidak mengaktifkan _driver_ ini secara _default_, dan _driver_ ini bergantung pada opsi konfigurasi bernama `NONPORTABLE` yang juga tidak diaktifkan secara _default_.

Aktifkan keduanya:

```sh
./scripts/config --enable NONPORTABLE
./scripts/config --enable HVC_RISCV_SBI
```

Verifikasi keduanya sudah aktif di `.config`:

```sh
grep -E "^CONFIG_NONPORTABLE|^CONFIG_HVC_RISCV_SBI" .config
```

```text
linux on master [?]
❯ grep -E "^CONFIG_NONPORTABLE|^CONFIG_HVC_RISCV_SBI" .config
CONFIG_NONPORTABLE=y
CONFIG_HVC_RISCV_SBI=y
```

Ada satu hal lagi yang harus dilakukan sebelum mem-_build_ ulang. Mengaktifkan `NONPORTABLE` membuka sejumlah opsi konfigurasi baru yang harus dijawab. Jika kita langsung memulai _build_-nya, `gmake` akan menjeda _build_ dan menanyakan tiap pertanyaan di _terminal_ satu per satu. Untuk menerima _default_ semuanya sekaligus, jalankan `olddefconfig` terlebih dahulu:

```sh
gmake ARCH=riscv LLVM=1 olddefconfig
```

Perintah ini juga merupakan langkah pemulihan rutin setiap kali kita berpindah versi kernel, melakukan _checkout_ ke _commit_ lain, atau mengubah opsi konfigurasi. `olddefconfig` membaca `.config` yang sudah ada dan secara otomatis menerima nilai _default_ untuk setiap opsi yang baru atau berubah, sehingga _build_ berikutnya dimulai dari kondisi yang konsisten.

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

Sekarang bangun ulang kernel dengan konfigurasi yang baru:

```sh
gmake ARCH=riscv LLVM=1 -j$(nproc) \
  HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types -D_UUID_T"
```

## _Image_ vs _Image.gz_

Dengan `HVC_RISCV_SBI` yang sudah aktif, kernel sekarang bisa berkomunikasi melalui konsol _debug_ SBI. Kita ubah _kernel command line_ QEMU untuk menggunakannya. `console=hvc0` memilih konsol SBI sebagai konsol utama; `earlycon=sbi`[^earlycon] menambahkan konsol tahap awal untuk pesan-pesan yang muncul sebelum konsol utama terinisialisasi, supaya kita tidak melewatkan apa pun di tahap awal _boot_.

```sh
qemu-system-riscv64 \
  -M virt \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image.gz \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -nographic \
  -append "earlycon=sbi console=hvc0"
```

Masih senyap. _Banner_ OpenSBI, lalu tidak ada apa-apa.

Butuh waktu cukup lama untuk menemukan penyebabnya. Jawabannya ada di kode sumber QEMU. Fungsi yang memuat kernel untuk RISC-V adalah `riscv_load_kernel` di [`hw/riscv/boot.c`](https://gitlab.com/qemu-project/qemu/-/blob/master/hw/riscv/boot.c#L244-309). Fungsi ini mencoba tiga _loader_ secara berurutan:

1. `load_elf_ram_sym` membaca _byte_ pertama _file_ dan memeriksa _magic bytes_[^magicbytes] ELF. _File_ `Image.gz` kita sudah di-_gzip_, sehingga _magic bytes_-nya adalah milik _gzip_, bukan ELF. _Loader_ ELF menolaknya.
2. `load_uimage_as` memeriksa _magic bytes_ format _uImage_ milik U-Boot. _File_ kita bukan _uImage_, jadi _loader_ ini juga menolaknya.
3. `load_image_targphys_as` adalah _fallback_ tanpa syarat. _Loader_ ini tidak memeriksa _magic_ apa pun, hanya menyalin isi _file_-nya ke RAM yang diemulasikan di alamat _load_ kernel.

Di langkah ketiga, _file_-nya berhasil dimuat, tetapi yang termuat adalah _byte gzip_ yang belum di-_decompress_. Setelah OpenSBI menyerahkan kendali, CPU melompat ke alamat kernel dan mencoba mendekode _gzip header_ sebagai instruksi RISC-V. _Byte-byte_ itu tidak masuk akal sebagai instruksi. CPU mengalami _fault_, tetapi belum ada _driver_ konsol yang aktif untuk memberi tahu kita. Jadi tidak ada apa pun yang muncul di layar.

Perbaikannya sederhana: gunakan _Image_ yang tidak dikompres alih-alih _Image.gz_. Kedua _file_ tersebut sama-sama dihasilkan oleh _build_. _Image_ adalah kernel yang sama, hanya saja tidak di-_gzip_:

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

_Output_! Kernel mem-_boot_, mencetak pesan-pesan awalnya seperti "Booting Linux on hartid[^hartid] 0", me-_mount_ _initramfs_-nya, menemukan `/init`, dan menjalankannya.

## _Hello World_ yang Senyap

Setelah `Run /init as init process`, layar tidak menampilkan apa pun lagi. Tidak ada "Hello, World!", tidak ada _crash_, tidak ada _panic_. _Binary_ init berjalan, tidak mengalami _crash_, dan melakukan _loop_ tanpa henti di `while(1)`, persis seperti yang saya tulis. Kernel tidak dapat memberi tahu saya apa yang salah karena memang tidak ada _error_ yang bisa dicetak. Jadi saya mencoba melihat apa yang sebenarnya dihasilkan _compiler_ untuk blok asm tersebut. _Tool_ `llvm-objdump`[^disassembly] mengubah _binary_ kembali ke _assembly_ yang dapat dibaca:

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

Saya perlu beberapa saat untuk memahami isi _disassembly_-nya. Baris yang paling penting di asm saya adalah `mv a1, %0`. Saya kira `%0` akan otomatis merujuk ke `msg`, tetapi sebenarnya `%0` digantikan oleh _compiler_ dengan _register_ mana pun yang menampung `msg`.

Berikut alur yang sebenarnya terjadi:

- _Constraint_ `"r"(msg)` memberi tahu _compiler_ agar meletakkan `msg` ke sebuah _register_, tanpa menentukan _register_ yang mana.
- _Compiler_ memilih `a0`. Lihat `addi a0, s0, -0x20` tepat sebelum bagian asm, instruksi ini yang meletakkan alamat `msg` di _stack_ ke `a0`.
- Baris asm berjalan berurutan: `li a7, 64`, lalu `li a0, 1`. Instruksi kedua memuat angka 1 ke `a0`, menimpa alamat `msg`.
- `mv a1, %0` lalu digantikan menjadi `mv a1, a0`, yang menyalin `a0` (sekarang berisi 1) ke `a1`. Jadi `a1` menampung 1, bukan alamat `msg`.

Saat `ecall` dijalankan, _register_ menampung `a0=1, a1=1, a2=14, a7=64`. Kernel membaca ini sebagai `write(1, (char *)1, 14)`, yaitu menulis 14 _byte_ dari alamat 1 ke _file descriptor_ 1. Alamat 1 bukan alamat memori yang valid. _Syscall_ mengembalikan `-EFAULT`, kode _error_ yang berarti "alamat yang salah", dan tidak ada yang tercetak.

Yang saya butuhkan adalah cara untuk memberi tahu _compiler_ secara tepat _register_ mana yang harus diisi oleh setiap nilai. Saya mencari tahu cara melakukannya dan menemukan sintaks yang tepat. _Keyword_ `register` di C adalah petunjuk bagi _compiler_ agar menjaga variabel di dalam _register_. Jika berdiri sendiri, _keyword_ ini tidak banyak berpengaruh; _compiler_ mengatur _register_ secara otomatis tanpanya. Ketika digabungkan dengan klausa `asm(...)` yang menamai _register_ tertentu, seperti `asm("a0")`, setelah nama variabel, keduanya menjadi ekstensi GCC dan Clang yang disebut _local register variables_[^registerasm]. Kombinasi ini mengikat variabel ke _register hardware_ tertentu. _Keyword_ `register` dan klausa `asm(...)` keduanya harus ada bersamaan; salah satunya saja tidak akan bekerja.

Konvensi _syscall_ RISC-V Linux memberi tahu kita _register_ mana yang harus diisi setiap nilai. `a7` menampung nomor _syscall_, dan `a0` sampai `a5` menampung argumennya. Untuk `write(fd, buf, count)`, itu artinya `a0` adalah fd, `a1` adalah _pointer_ ke _buffer_, dan `a2` adalah jumlah _byte_. Dengan setiap nilai terikat ke _register_-nya, bagian asm hanya perlu menjalankan `ecall`:

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

_Compile_ ulang, lalu _disassemble_ kembali:

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

Lihat empat instruksi `ld` tepat sebelum `ecall`. Setiap instruksi memuat satu nilai ke _register_ bernama tertentu: `a0` untuk _fd_, `a1` untuk _pointer buffer_, `a2` untuk jumlah _byte_, `a7` untuk nomor _syscall_. _Pinning_-nya berfungsi.

Sebelum mem-_boot_, kita perlu mengemas ulang _initramfs_ supaya _binary_ `init` yang baru masuk ke dalam arsip _cpio_ yang dibaca kernel. _Binary_ di _disk_ memang sudah baru, tetapi arsip _cpio_-nya masih menyimpan _binary_ yang lama sampai kita mengemasnya ulang:

```sh
/Volumes/linuxkernel/linux/usr/gen_init_cpio /Volumes/linuxkernel/initramfs.txt \
  | gzip > /Volumes/linuxkernel/initramfs.cpio.gz
```

_Boot_ sekali lagi:

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

Program C pertama yang saya tulis berjalan di kernel buatan saya sendiri, di atas RISC-V yang diemulasi QEMU pada Mac ARM64 saya. Pesannya tercetak. Momen itulah yang membuat seluruh perjalanan ini layak dijalani.

## Membaca _init/main.c_

_Hello, World_ tercetak. Semuanya berjalan, dari saat CPU dinyalakan sampai 14 baris _assembly_ kita. Di antara keduanya, kernel melakukan banyak pekerjaan, dan hampir semuanya ada di dalam `init/main.c`. Bagian ini menelusuri _file_ tersebut. Dengan mengenali bagian-bagiannya saat semuanya berjalan normal, kita akan tahu di mana harus mencari ketika sesuatu rusak.

Semua yang terjadi antara _firmware_ dan `/init` kita berada dalam satu _file_: `init/main.c`. _File_ tersebut memiliki dua fungsi yang perlu kita ketahui: `start_kernel` dan `kernel_init`.

`start_kernel` adalah `main`-nya kernel. Fungsi ini melakukan sebagian besar pekerjaan penyiapan:

- Menyiapkan memori: mencari tahu RAM mana yang tersedia agar kernel bisa membagikan memori ke siapa saja yang memintanya nanti.
- Menyiapkan _interrupt_: memberi tahu CPU bagaimana menangani _timer tick_, _page fault_, dan _system call_.
- Menyiapkan _scheduler_: bagian yang memutuskan _task_ mana yang akan berjalan di CPU selanjutnya.
- Menyiapkan konsol: alasan kita bisa melihat pesan _boot_ di _terminal_ kita.

Saat `start_kernel` selesai, kernel sudah berjalan dan bisa mencetak ke konsol. Namun `/init` belum berjalan; tugas itu diserahkan ke fungsi berikutnya, `kernel_init`.

`kernel_init` adalah fungsi yang berjalan setelah `start_kernel`. Fungsi ini adalah jembatan dari "kernel yang berjalan di atas _hardware_" menuju "program _userspace_ kita mulai berjalan". Fungsi ini:

- Menunggu sampai `initramfs.cpio.gz` selesai diekstrak ke memori.
- Membuka `/dev/console` agar _file descriptor_ 0, 1, 2 dapat digunakan oleh program apa pun yang dijalankannya.
- Memanggil `run_init_process("/init")`, fungsi yang mencetak `Run /init as init process` lalu menyerahkan kendali ke _binary_ kita.

Berikut gejala-gejala umum, masing-masing beserta lokasinya di kode sumber:

- **Tidak ada pesan kernel sama sekali, hanya _banner_ OpenSBI**: konsol awal belum aktif. Lihat `setup_arch` di `arch/riscv/kernel/setup.c` dan _parsing_ `earlycon=sbi` di `setup_earlycon` pada `drivers/tty/serial/earlycon.c`. Ini perbaikan yang sama dengan yang kita lakukan saat menambahkan `earlycon=sbi` pertama kali.
- **_Boot_ berhenti di antara OpenSBI dan `Run /init`**: ada sesuatu di `start_kernel` atau `kernel_init` yang _panic_ atau macet. Baris terakhir yang tercetak sebelum berhenti adalah petunjuk kita. Buka `init/main.c`, cari teks tersebut, lalu baca kode yang berjalan setelahnya.
- **`Run /init as init process` lalu senyap**: kernel sudah menyelesaikan tugasnya. _Bug_-nya ada di _binary_ `/init` kita. Kita baru saja melihatnya di bagian sebelumnya.
- **Pesan `Warning: unable to open an initial console`**: `console_on_rootfs` gagal. Penyebabnya: `/dev/console` tidak ada di _initramfs_, atau _driver_ konsolnya tidak di-_build_ ke dalam kernel. Pekerjaan kita dengan `HVC_RISCV_SBI` mengatasi kasus yang kedua.
- **_Kernel panic_ dengan pesan `No working init found`**: kernel sudah menyelesaikan _setup_-nya, tetapi tidak menemukan `/init` di _initramfs_. Pastikan _binary_-nya sudah masuk ke dalam _initramfs_.

Dengan petunjuk-petunjuk ini, "_boot_-nya rusak" tidak lagi terasa membingungkan, melainkan menjadi daftar pendek tempat yang harus diperiksa.

Kernel memiliki versi `printf`-nya sendiri yang bernama `printk`[^printk]. Kode kernel modern biasanya memanggilnya melalui _wrapper_ seperti `pr_info`, `pr_warn`, dan `pr_err`. Setiap _wrapper_ memanggil `printk` pada _log level_ yang berbeda. _Output_-nya menuju ke konsol yang sama dengan _boot log_ kita. Kita dapat menambahkan `pr_info("hello from my code\n");` di mana saja dalam kode kernel, mem-_build_ ulang, mem-_boot_, dan mencari baris tersebut. Inilah cara tercepat untuk memastikan bagian kode yang kita curigai benar-benar berjalan.

Mari kita coba ini di dua tempat yang baru saja kita sebutkan. Buka `init/main.c` dan temukan fungsi `start_kernel`. Menjelang akhir fungsi tersebut, tepat sebelum memanggil `rest_init`, tambahkan:

```c
pr_info("hello from start_kernel\n");
```

Sekarang temukan `kernel_init` di bagian bawah _file_ yang sama. Di awal _body_ fungsinya, tepat sebelum panggilan ke `wait_for_completion(&kthreadd_done)`, tambahkan:

```c
pr_info("hello from kernel_init\n");
```

_Build_ ulang kernel:

```sh
gmake ARCH=riscv LLVM=1 -j$(nproc) \
  HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types -D_UUID_T"
```

_Boot_:

```sh
qemu-system-riscv64 \
  -M virt \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -nographic \
  -append "earlycon=sbi console=hvc0"
```

_Boot log_ sekarang menampilkan dua baris baru, satu dari masing-masing fungsi:

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

Kita dapat menambahkan `pr_info` di mana saja dan mengetahui apakah _code path_ tersebut benar-benar berjalan. Itu inti tekniknya.

`printk` sudah cukup untuk menjawab "apakah ini berjalan?". Untuk "nilai apa yang ada di _register_ ini?" atau "kita ingin menjeda kernel di tengah _boot_", bagian berikutnya akan menghubungkan _lldb_ ke QEMU yang sedang berjalan.

## Menelusuri _Boot_ dengan _lldb_

`printk` menjawab pertanyaan "apakah ini berjalan?". Untuk pertanyaan yang lebih dalam, seperti "berapa nilai _register_ ini?" atau "kita ingin menjeda kernel dan melihat memori", kita membutuhkan _debugger_. `lldb` bersama _gdb stub_ milik QEMU memberikan kemampuan itu.

_Setup_-nya terdiri dari empat langkah:

1. Mem-_build_ kernel dengan _debug symbols_ supaya _debugger_ mengetahui nama fungsi dan variabel.
2. Menjalankan QEMU dengan _gdb stub_-nya aktif dan CPU yang menunggu, supaya kita bisa menyambungkan _debugger_ sebelum kode kernel berjalan.
3. Menyambungkan `lldb` ke _gdb stub_.
4. Menelusuri _boot_-nya.

Untuk membuat `lldb` bisa memetakan alamat ke baris kode sumber, kernel harus di-_build_ dengan _DWARF symbols_[^dwarf]. Ternyata `defconfig` secara bawaan mengaktifkan `DEBUG_INFO_NONE`, yang menghapus _symbol_ dari kernel. Kita perlu mematikan opsi itu dan mengaktifkan `DEBUG_INFO_DWARF_TOOLCHAIN_DEFAULT` sebagai gantinya. Sekalian, `GDB_SCRIPTS` akan menambahkan _script_ pendukung yang bisa dimuat oleh _debugger_ yang kompatibel dengan gdb:

```sh
./scripts/config --disable DEBUG_INFO_NONE
./scripts/config --enable DEBUG_INFO_DWARF_TOOLCHAIN_DEFAULT
./scripts/config --enable GDB_SCRIPTS
```

Verifikasi keduanya sudah aktif di `.config`:

```sh
grep -E "^CONFIG_DEBUG_INFO_DWARF_TOOLCHAIN_DEFAULT|^CONFIG_GDB_SCRIPTS" .config
```

```text
linux on master [?]
❯ grep -E "^CONFIG_DEBUG_INFO_DWARF_TOOLCHAIN_DEFAULT|^CONFIG_GDB_SCRIPTS" .config
CONFIG_DEBUG_INFO_DWARF_TOOLCHAIN_DEFAULT=y
CONFIG_GDB_SCRIPTS=y
```

Lalu jalankan `olddefconfig` dan _build_ ulang:

```sh
gmake ARCH=riscv LLVM=1 olddefconfig

gmake ARCH=riscv LLVM=1 -j$(nproc) \
  HOSTCFLAGS="-Iscripts/macos-include -I$(brew --prefix libelf)/include -Wno-incompatible-pointer-types -D_UUID_T"
```

`olddefconfig` menyesuaikan ketiga _toggle_ tersebut dengan opsi-opsi lain yang bergantung kepadanya, sambil menerima nilai _default_ untuk opsi baru. _Build_ kemudian berjalan dengan `.config` yang konsisten.

_Build_ ini menghasilkan _file_ `vmlinux`[^vmlinux] baru di direktori kernel di samping _file_ `Image`. `vmlinux` adalah versi lengkap _binary_ ELF kernel, dengan tabel _symbol_ yang masih utuh. `lldb` membaca `vmlinux` untuk mengetahui di mana setiap fungsi berada. _File_ `Image` yang selama ini kita _boot_ adalah `vmlinux` yang sudah dihilangkan _debug info_-nya dan _wrapper_ ELF-nya dilepas.

Sekarang jalankan QEMU dengan dua _flag_ baru:

```sh
qemu-system-riscv64 \
  -M virt \
  -kernel /Volumes/linuxkernel/linux/arch/riscv/boot/Image \
  -initrd /Volumes/linuxkernel/initramfs.cpio.gz \
  -nographic \
  -append "earlycon=sbi console=hvc0" \
  -s -S
```

_Flag_ barunya:

- `-s` mengaktifkan _gdb stub_[^gdbstub] milik QEMU di _port_ TCP 1234. _Debugger_ apa pun yang menggunakan _GDB protocol_ dapat tersambung ke sana.
- `-S` dengan huruf S besar memerintahkan QEMU agar memulai CPU _guest_ dalam keadaan terhenti. Tanpa _flag_ ini, kernel akan berjalan melewati `start_kernel` dan seterusnya sebelum kita sempat menyambungkan _debugger_.

_Terminal_-nya diam menunggu. QEMU sudah memuat kernel ke RAM dan terhenti di _reset vector_[^resetvector]. Belum ada satu instruksi pun yang dieksekusi.

Buka _terminal_ kedua. Jalankan `lldb` dengan versi lengkap _binary_ kernel:

```sh
lldb /Volumes/linuxkernel/linux/vmlinux
```

```text
linux on master via 🐍 v3.14.5
❯ lldb /Volumes/linuxkernel/linux/vmlinux
(lldb) target create "/Volumes/linuxkernel/linux/vmlinux"
Current executable set to '/Volumes/linuxkernel/linux/vmlinux' (riscv64).
```

`lldb` membaca `vmlinux`, mempelajari setiap fungsi di dalam kernel, lalu menampilkan _prompt_. `lldb` belum tersambung ke QEMU.

Sambungkan ke _gdb stub_ milik QEMU dan pasang _breakpoint_[^breakpoint] di fungsi C pertama yang dijalankan kernel:

```
(lldb) gdb-remote localhost:1234
(lldb) breakpoint set --name start_kernel
(lldb) continue
```

`gdb-remote localhost:1234` membuka koneksi TCP ke QEMU. `lldb` memberi tahu QEMU "berhenti saat mencapai alamat ini" melalui _GDB wire protocol_. `continue` melepaskan CPU yang tadi terhenti. QEMU berjalan dari _reset vector_, melewati kode _assembly_ di `head.S` yang detailnya masih saya pelajari, dan akhirnya berhenti di `start_kernel`:

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

Kita sekarang berada di dalam fungsi C pertama kernel. Setiap nilai _register_, setiap variabel, setiap alamat memori dapat kita periksa dari titik ini.

Mari kita lompat ke tempat yang lebih menarik. `run_init_process` adalah fungsi yang sudah kita bahas di bagian sebelumnya, yaitu fungsi yang mencetak `Run /init as init process` lalu menyerahkan kendali ke _binary_ kita. Pasang _breakpoint_ di sana, lanjutkan, dan periksa argumennya:

```
(lldb) breakpoint set --name run_init_process
(lldb) continue
(lldb) register read a0
(lldb) memory read --format s --count 1 $a0
```

Ketika _breakpoint_-nya tercapai, kita berada pada saat kernel akan memanggil _binary_ init kita. Argumen pertama berada di `a0` sesuai _calling convention_ RISC-V[^abi]. `run_init_process` menerima satu argumen, yaitu `const char *init_filename`, sehingga `a0` seharusnya berisi _pointer_ ke _string_ `/init`:

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

`memory read --format s` membaca alamat di `$a0` dan menafsirkan _byte-byte_-nya sebagai _string_ yang diakhiri dengan _null_. Kernel benar-benar akan menjalankan `/init`, bukan _binary_ lain.

Satu pemberhentian lagi. `start_thread` adalah fungsi yang spesifik untuk arsitektur, yang kernel panggil untuk menyiapkan _state_ untuk _thread userspace_ baru sebelum CPU kembali ke _U-mode_[^smode]. Di RISC-V, fungsi ini menerima tiga argumen: _pointer_ ke nilai-nilai _register_ milik _task_ yang tersimpan, _program counter_[^pc] tempat _userspace_ mulai dijalankan, dan _stack pointer_[^sp] awalnya. Pasang _breakpoint_ lalu baca ketiga _register_ argumennya:

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

`a1` adalah _program counter_, yaitu alamat _entry_ `_start` dari _binary_ init ELF kita. `a2` adalah puncak _stack_ di _userspace_ yang dialokasikan kernel untuk proses yang baru.

Setelah `start_thread` selesai dan kernel beralih kembali ke _U-mode_ melalui `sret`[^sret], _program counter_ CPU menjadi nilai dari `a1` dan eksekusi melompat ke 14 baris _inline assembly_ kita. _Hello World_ pun tercetak.

Kita baru saja menelusuri _boot_ secara langsung: dari _reset vector_, melalui `start_kernel`, `kernel_init`, `run_init_process`, `start_thread`, sampai ke _userspace_. Setiap perpindahan yang kita baca di bagian sebelumnya barusan terjadi di depan mata, dengan _breakpoint_ dan pembacaan _register_ sebagai buktinya.

## Langkah Berikutnya

Yang saya bangun di sini sudah berjalan, tetapi memahaminya sampai detail masih butuh perjalanan tersendiri. Berikut beberapa hal yang ingin saya jelajahi selanjutnya, semoga membantu Kamu memilih arah.

**Menjalankan _userspace_ yang sesungguhnya.** _Binary_ init 14 baris kita membuktikan kernel bisa menyerahkan kendali ke _userspace_, tetapi hanya bisa mencetak satu baris. Gantikan dengan BusyBox untuk mendapatkan _shell_ yang berfungsi beserta `ls`, `cat`, dan _utility_ lainnya. Mem-_build_ BusyBox secara statis untuk RISC-V, masukkan _binary_-nya ke _initramfs_, arahkan `/init` ke init milik BusyBox, lalu _reboot_.
Referensi: <https://busybox.net/>

**Menambahkan _syscall_ buatan sendiri.** Pilih nomor _syscall_ yang belum dipakai, tambahkan _entry_ di `arch/riscv/kernel/syscall_table.c`, implementasikan fungsi `SYSCALL_DEFINE`, lalu _build_ ulang. Dari _userspace_, panggil dengan `syscall(NR_my_call, ...)`. Ini cara paling bersih untuk merasakan kontrak antara _userspace_ dan kernel dari kedua sisi.
Referensi: <https://docs.kernel.org/process/adding-syscalls.html>

Saya sendiri masih mempelajari dasar-dasarnya. Buku-buku yang masuk daftar bacaan saya:

- **Computer Systems: A Programmer's Perspective** oleh Bryant dan O'Hallaron untuk memahami bagaimana _register_, memori, dan _assembly_ saling terkait
- **xv6** dari MIT, kernel yang cukup kecil untuk dibaca seluruhnya
- **The RISC-V Reader** oleh Waterman dan Patterson untuk ringkasan ISA yang padat
- **The C Programming Language** oleh Kernighan dan Ritchie untuk mempelajari bahasa C secara menyeluruh

Saya sudah sampai di sini. Bagian paling sulit sudah saya lewati: membuka kotak dan melihat ke dalam. Sisanya tinggal menjelajahi isinya satu per satu.

## Referensi

- [Building Linux Kernel on macOS Natively](https://seiya.me/blog/building-linux-on-macos-natively) oleh Seiya
- [BusyBox](https://busybox.net/)
- [Homebrew](https://brew.sh)
- [Linux kernel: Adding a New System Call](https://docs.kernel.org/process/adding-syscalls.html)
- [Linux kernel: Early Userspace Support](https://docs.kernel.org/driver-api/early-userspace/early_userspace_support.html)
- [Linux kernel: HVC Kconfig](https://github.com/torvalds/linux/blob/master/drivers/tty/hvc/Kconfig)
- [Linux kernel: Linux Allocated Devices](https://docs.kernel.org/admin-guide/devices.html)
- [QEMU: RISC-V virt Machine](https://www.qemu.org/docs/master/system/riscv/virt.html)
- [QEMU source: riscv_load_kernel in hw/riscv/boot.c](https://gitlab.com/qemu-project/qemu/-/blob/master/hw/riscv/boot.c)

[^riscv]: Arsitektur CPU yang _open-source_. Siapa saja dapat
membuat _chip_-nya tanpa harus membayar lisensi. _Instruction set_-nya
kecil dan mudah dibaca, sehingga populer untuk belajar.
Referensi: <https://riscv.org/about/>

[^abi]: _Application Binary Interface_. Kalau API menjelaskan fungsi
apa saja yang tersedia di tingkat kode sumber, ABI menjelaskan
bagaimana fungsi itu dipanggil di tingkat mesin: argumen masuk ke
_register_ mana, nilai kembalian dibaca dari _register_ mana, dan
bagaimana _stack_ disusun.
Referensi: <https://github.com/riscv-non-isa/riscv-elf-psabi-doc>

[^syscall]: _System call_. Cara sebuah program biasa meminta tolong
kernel untuk mengerjakan hal yang tidak dapat dilakukannya sendiri,
seperti membaca _file_ atau menulis ke layar. Di RISC-V, kita
meletakkan nomor _syscall_ di _register_ `a7`, argumennya di `a0`
sampai `a5`, kemudian menjalankan instruksi `ecall`.
Referensi: <https://man7.org/linux/man-pages/man2/syscalls.2.html>

[^elf]: _Executable and Linkable Format_. Format _binary_ standar
di Linux. Program yang sudah dikompilasi, _shared library_, bahkan
_file object_ pun semuanya menggunakan format ELF.
Referensi: <https://man7.org/linux/man-pages/man5/elf.5.html>

[^builtin]: Fungsi _intrinsic_ yang disediakan _compiler_ seperti
_clang_ dan _gcc_, yang langsung dipetakan ke instruksi CPU.
`__builtin_bswap16`, `__builtin_bswap32`, dan `__builtin_bswap64`
membalik urutan _byte_ pada bilangan bulat 16-, 32-, dan 64-_bit_
secara berurutan.
Referensi: <https://clang.llvm.org/docs/LanguageExtensions.html#builtin-bswap16-builtin-bswap32-builtin-bswap64>

[^macho]: Format _binary_ asli macOS dan iOS, berbeda dengan ELF
yang dipakai di Linux. _Binary_ Mach-O memiliki _magic bytes_ dan
struktur sendiri, sehingga _linker_ untuk satu format tidak bisa
menghasilkan format yang lain.
Referensi: <https://developer.apple.com/library/archive/documentation/DeveloperTools/Conceptual/MachORuntime/>

[^mmu]: _Memory Management Unit_. Perangkat keras yang
menerjemahkan alamat virtual, yaitu alamat yang dilihat
_program_, menjadi alamat fisik, yaitu lokasi data yang
sebenarnya di RAM. Setiap _program_ punya ruang alamat
virtualnya sendiri, sehingga dua _program_ bisa sama-sama
memakai alamat `0x10000` tanpa bentrok. MMU menerjemahkan
masing-masing alamat virtual ke lokasi RAM fisik yang berbeda di
balik layar, dan juga mengatur izin akses seperti _read-only_.
Referensi: _Privileged Architecture spec_ pada
<https://github.com/riscv/riscv-isa-manual>

[^stack]: Daerah memori yang menyimpan data sementara dengan
aturan LIFO, yaitu yang terakhir masuk akan keluar pertama.
Bayangkan tumpukan piring bersih: setiap piring baru ditaruh di
atas, dan saat kita butuh, kita mengambilnya dari atas juga.
_Program_ menggunakan _stack_ untuk mencatat pemanggilan fungsi,
variabel lokal, dan jalan kembali ke pemanggil. _Stack pointer_
adalah penanda posisi paling atas: setiap _push_ menggesernya
turun, setiap _pop_ menggesernya naik.
Referensi: _RISC-V calling convention_ pada
<https://github.com/riscv-non-isa/riscv-elf-psabi-doc>

[^hartid]: _Hardware Thread ID_. Cara RISC-V memberi nomor pada
setiap _core_ CPU. _Hart_ adalah singkatan dari _hardware thread_.
_Hart_ 0 adalah _core_ pertama.
Referensi: <https://github.com/riscv/riscv-isa-manual>

[^smode]: RISC-V memiliki tiga level hak akses. _M-mode_ adalah
_machine mode_, digunakan oleh _firmware_. _S-mode_ adalah
_supervisor mode_, digunakan oleh kernel. _U-mode_ adalah _user
mode_, digunakan oleh program biasa. M paling tinggi, U paling
rendah.
Referensi: _Privileged Architecture spec_ pada
<https://github.com/riscv/riscv-isa-manual>

[^sbi]: _Supervisor Binary Interface_. Aturan main antara kernel
(di _S-mode_) dan _firmware_ (di _M-mode_). Saat kernel
membutuhkan sesuatu yang hanya dapat dikerjakan oleh _firmware_,
kernel akan memanggil SBI.
Referensi: <https://github.com/riscv-non-isa/riscv-sbi-doc>

[^opensbi]: Implementasi SBI yang _open-source_ dan menjadi pilihan
bawaan QEMU. OpenSBI berjalan paling awal saat _boot_, lalu
menyerahkan kendali kepada kernel.
Referensi: <https://github.com/riscv-software-src/opensbi>

[^dbcn]: _Debug Console Extension_. Bagian dari spesifikasi SBI
2.0+ yang memungkinkan kernel mencetak karakter melalui _firmware_.
Referensi: bab ekstensi DBCN pada
<https://github.com/riscv-non-isa/riscv-sbi-doc>

[^virt]: Platform virtual umum milik QEMU. `-M virt` memberi kita
papan virtual dengan CPU, memori, sebuah UART, dan _bus_ PCIe.
Referensi: <https://www.qemu.org/docs/master/system/riscv/virt.html>

[^gdbstub]: Sepotong kode kecil yang berkomunikasi menggunakan
_GDB Remote Serial Protocol_ melalui _socket_ TCP. QEMU sudah
memilikinya secara _built-in_. _Debugger_ seperti _gdb_ atau _lldb_
dapat tersambung ke sini dan menjalankan kode di QEMU langkah demi
langkah.
Referensi: <https://www.qemu.org/docs/master/system/gdb.html>

[^dwarf]: Format standar untuk menyimpan informasi _debug_
tingkat _source_ di dalam _binary_ yang sudah di-_compile_: nama
fungsi, tipe variabel, dan nomor baris. Dengan DWARF, _debugger_
dapat memberi tahu posisi kita di baris 42 _file_ `init/main.c`
alih-alih hanya menampilkan alamat seperti 0xffffffff80123456.
Referensi: <https://dwarfstd.org/>

[^vmlinux]: Versi lengkap ELF kernel Linux hasil dari _build_,
yang belum dihilangkan _debug info_-nya. Berisi seluruh tabel
_symbol_ dan _debug info_. _File_
`Image` yang selama ini kita _boot_ adalah `vmlinux` yang sudah
dihilangkan _debug info_-nya dan _wrapper_ ELF-nya dilepas.
Referensi: <https://docs.kernel.org/admin-guide/bug-hunting.html>

[^resetvector]: Alamat pertama yang dieksekusi CPU saat dinyalakan
atau di-_reset_. Instruksi pertama dari seluruh sistem berada di
sini. Pada _machine_ virt RISC-V milik QEMU, _reset vector_
menunjuk ke ROM kecil berisi beberapa instruksi yang langsung
menyerahkan kendali ke OpenSBI.
Referensi: <https://www.qemu.org/docs/master/system/riscv/virt.html>

[^pointer]: Sebuah angka yang menyimpan alamat memori suatu data,
bukan datanya itu sendiri. Bayangkan _sticky note_ bertuliskan
nomor loker: catatannya kecil, tetapi lokerlah yang menyimpan
barangnya. Untuk mengambil barang itu, kita membaca nomornya,
mendatangi lokernya, lalu membukanya. Dalam _asm_ kita, `a1 = msg`
menulis nomor loker tempat "Hello, World!\n" tersimpan ke dalam
`a1`. Kernel lalu memakai nomor itu untuk mendatangi loker tersebut
dan membaca _byte_-nya.
Referensi: <https://en.cppreference.com/w/c/language/pointer>

[^pc]: _Program Counter_. _Register_ CPU khusus yang menampung
alamat instruksi berikutnya yang akan dieksekusi. Setelah CPU
selesai mengeksekusi satu instruksi, ia membaca instruksi
berikutnya dari alamat yang ada di _program counter_.
Referensi: _RISC-V Unprivileged ISA spec_ pada
<https://github.com/riscv/riscv-isa-manual>

[^register]: Sel penyimpanan kecil yang tertanam langsung di dalam
CPU. Membaca atau menulis _register_ jauh lebih cepat daripada
mengakses memori, karena _register_ ada di dalam CPU sendiri
sementara memori berada di luar. Sebagai analogi: memori seperti
dapur besar yang harus kita datangi setiap kali butuh sesuatu,
sedangkan _register_ seperti meja kerja kecil tepat di samping kita
yang langsung bisa diraih. RISC-V memiliki 32 _general-purpose
register_, bernama `x0` sampai `x31`, dengan nama ABI seperti
`a0`-`a7` untuk argumen, `t0`-`t6` untuk _temporary_, dan `s0`-`s11`
untuk nilai yang disimpan.
Referensi: spesifikasi _RISC-V Unprivileged ISA_ di
pada <https://github.com/riscv/riscv-isa-manual>

[^sp]: _Stack Pointer_. _Register_ CPU yang menampung posisi
puncak _stack_ saat ini. Setiap _push_ menggesernya turun, setiap
_pop_ menggesernya naik.
Referensi: _RISC-V calling convention_ pada
<https://github.com/riscv-non-isa/riscv-elf-psabi-doc>

[^breakpoint]: Penanda yang memberi tahu _debugger_ untuk
menjeda eksekusi ketika program mencapai fungsi atau alamat
tertentu. Saat dijeda, _debugger_ dapat memeriksa _register_,
memori, dan variabel sebelum membiarkan program berjalan kembali.
Referensi: <https://lldb.llvm.org/use/tutorial.html>

[^ecall]: Instruksi _Environment Call_. Instruksi _trap_ di
RISC-V. Dari _U-mode_, instruksi ini berpindah ke _S-mode_, tempat
kernel berjalan. Beginilah cara _syscall_ dimulai.
Referensi: _Unprivileged ISA spec_ pada
<https://github.com/riscv/riscv-isa-manual>

[^sret]: Instruksi _Supervisor Return_. Kebalikan dari `ecall`.
Instruksi ini menurunkan hak akses dari _S-mode_ kembali ke
_U-mode_ dan melanjutkan eksekusi di _userspace_.
Referensi: _Privileged Architecture spec_ pada
<https://github.com/riscv/riscv-isa-manual>

[^trap]: Perpindahan terkontrol dari level hak akses yang lebih
rendah ke yang lebih tinggi. Dipicu oleh _exception_, _interrupt_,
atau instruksi `ecall`.
Referensi: _Privileged Architecture spec_ pada
<https://github.com/riscv/riscv-isa-manual>

[^initramfs]: _Initial RAM Filesystem_. Sebuah arsip _cpio_ yang
diekstrak oleh kernel ke memori saat _boot_. Kernel akan
menjalankan `/init` dari sini.
Referensi: <https://docs.kernel.org/filesystems/ramfs-rootfs-initramfs.html>

[^cpio]: _Copy In, Out_. Format arsip Unix yang sederhana.
Digunakan untuk _initramfs_ kernel karena _unpacker_-nya kecil dan
belum membutuhkan _filesystem_ sungguhan.
Referensi: <https://www.gnu.org/software/cpio/manual/cpio.html>

[^hvc]: _Hypervisor Virtual Console_. _Framework_ konsol Linux
untuk konsol-konsol yang tidak cocok dengan model UART biasa,
termasuk konsol _debug_ SBI di RISC-V.
Referensi: <https://github.com/torvalds/linux/blob/master/drivers/tty/hvc/Kconfig>

[^earlycon]: Parameter _boot_ kernel yang mengaktifkan _driver_
konsol minimalis di tahap paling awal _boot_, sebelum konsol utama
siap. Berguna untuk menangkap pesan _crash_ dan kesalahan
konfigurasi yang tanpa _earlycon_ tidak akan sempat tercetak.
Referensi: <https://docs.kernel.org/admin-guide/kernel-parameters.html>

[^kconfig]: Sistem konfigurasi kernel. _File-file_ yang bernama
`Kconfig` berisi daftar opsi-opsi yang tersedia. _Tools_ di `scripts/kconfig/`
mengurai _file_ tersebut dan menghasilkan _file_ `.config`.
Referensi: <https://docs.kernel.org/kbuild/kconfig-language.html>

[^defconfig]: _File_ `.config` _default_ untuk sebuah arsitektur,
berlokasi di `arch/<arch>/configs/defconfig`. Menjalankan
`make defconfig` mengembalikan konfigurasi ke _default_ tersebut.
Referensi: <https://docs.kernel.org/kbuild/kconfig.html>

[^printk]: Versi `printf` milik kernel. Menulis ke _ring buffer_ di
memori.
Referensi: <https://docs.kernel.org/core-api/printk-basics.html>

[^apfs]: _Apple File System_. _Filesystem_ bawaan pada macOS
modern. Bersifat _case-insensitive_ secara _default_.
Referensi: <https://support.apple.com/guide/disk-utility/file-system-formats-dsku19ed921c/mac>

[^applesilicon]: Sebutan dari Apple untuk Mac berbasis _ARM_
mulai dari M1. Arsitektur CPU-nya adalah _ARM64_.
Referensi: <https://support.apple.com/en-us/HT211814>

[^crosscompile]: Mengompilasi _binary_ untuk arsitektur yang
berbeda dari mesin tempat kita melakukan kompilasi. Mengompilasi
kernel RISC-V di Mac _ARM_ adalah contoh _cross-compilation_.
Referensi: <https://clang.llvm.org/docs/CrossCompilation.html>

[^pidone]: _Process ID 1_. Proses _userspace_ pertama yang
dijalankan oleh kernel. Jika PID 1 mati, kernel akan _panic_.
Referensi: <https://man7.org/linux/man-pages/man7/boot.7.html>

[^init]: Program _userspace_ pertama yang dijalankan kernel setelah
_boot_. Kernel mencari `/init` di dalam _initramfs_ lalu
menjalankannya. Implementasi umum pada sistem Linux nyata adalah
_systemd_, _sysvinit_, dan _OpenRC_.
Referensi: <https://man7.org/linux/man-pages/man7/boot.7.html>

[^lld]: _Linker_ milik LLVM. Sudah disertakan bersama _clang_.
Di macOS, _lld_ otomatis terpasang setelah `brew install llvm`.
Referensi: <https://lld.llvm.org/index.html>

[^imagebase]: Alamat awal tempat _linker_ menaruh sebuah program
di memori. `lld` memilih nilai _default_ berdasarkan _platform_
target. _Default_ ini dapat diganti dengan _flag_
`-Wl,--image-base=ADDR` saat proses _linking_.
Referensi: <https://lld.llvm.org/>

[^libc]: _C standard library_. Menyediakan fungsi-fungsi seperti
`printf`, `malloc`, `strcpy`, beserta kode _startup_ yang memanggil
`main` kita. Pada init kita tidak menggunakan libc agar _binary_-nya
sekecil mungkin.
Referensi: <https://sourceware.org/glibc/manual/2.39/html_node/Introduction.html>

[^crt0]: Kode _startup_ kecil yang otomatis
disertakan ke dalam _binary_. Kode ini menyiapkan _stack_, memanggil
`main`, kemudian memanggil `exit` saat `main` selesai. Tanpa
_crt0_, kita harus menulis `_start` sendiri.
Referensi: <https://sourceware.org/git/?p=glibc.git;a=tree;f=csu>

[^fd]: Bilangan bulat kecil yang diberikan kernel saat program
membuka sesuatu. Yang dibuka bisa berupa _file_ biasa, _driver_
perangkat, _socket_ jaringan, _pipe_, atau konsol. Operator `|` di
_shell_ bekerja karena kernel bisa menyambungkan _output_ _fd_ 1
dari satu program ke _input_ _fd_ 0 program berikutnya. Setiap
proses dimulai dengan tiga _fd_ yang sudah terbuka: 0 untuk
_input_, 1 untuk _output_, 2 untuk _error_.
Referensi: <https://man7.org/linux/man-pages/man2/open.2.html>

[^disassembly]: Membaca _binary_ yang sudah di-_compile_ dengan
menerjemahkan kode mesinnya kembali ke instruksi _assembly_.
Berguna untuk memeriksa apa yang sebenarnya dihasilkan
_compiler_.
Referensi: <https://llvm.org/docs/CommandGuide/llvm-objdump.html>

[^registerasm]: Ekstensi GCC dan Clang yang mengikat sebuah
variabel C ke _register hardware_ tertentu. Ditulis sebagai
`register long var asm("a0") = value;`. _Keyword_ `register` dan
klausa `asm(...)` keduanya harus ada.
Referensi: <https://gcc.gnu.org/onlinedocs/gcc/Local-Register-Variables.html>

[^mknod]: Perintah Unix untuk membuat _file_ khusus seperti
_device node_. Sebagai contoh, `mknod /dev/console c 5 1` membuat
_character device_ bernama `/dev/console` dengan _major number_ 5
dan _minor number_ 1.
Referensi: <https://man7.org/linux/man-pages/man1/mknod.1.html>

[^userspace]: Tempat program yang kita jalankan berada, terpisah dari
kernel. CPU memberlakukan pemisahan yang ketat: kode _userspace_
berjalan di tingkat hak akses yang lebih rendah dan tidak dapat
langsung menyentuh _hardware_ atau memori milik kernel. Untuk
melakukan sesuatu yang melewati batas tersebut, seperti membaca
_file_, menulis ke layar, atau keluar dari program, _userspace_
akan meminta kernel melalui _syscall_.
Referensi: <https://man7.org/linux/man-pages/man2/intro.2.html>

[^magicbytes]: Urutan _byte_ unik di awal sebuah _file_ yang
mengidentifikasi formatnya. ELF dimulai dengan `7F 45 4C 46`,
_gzip_ dengan `1F 8B 08`, PNG dengan `89 50 4E 47`. _Tool_ yang
harus membedakan berbagai format akan memeriksa _byte_ ini terlebih
dahulu untuk menentukan format _file_-nya.
Referensi: <https://man7.org/linux/man-pages/man1/file.1.html>
