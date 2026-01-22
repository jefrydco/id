---
title: "Two Pointers"
description: "Tiga variasi two pointers: convergent, same direction fast & slow, dan sliding window"
publishedAt: 2026-01-22
tags:
  - algorithm
  - two-pointers
  - leetcode
---

## Convergent

Contoh kasus: [Two Sum II](https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/), [Valid Palindrome](https://leetcode.com/problems/valid-palindrome/), [Container With Most Water](https://leetcode.com/problems/container-with-most-water/), [Trapping Rain Water](https://leetcode.com/problems/trapping-rain-water/)

```cpp
while (left < right) {
  if (condition)
    ++left;
  else
    --right;
}
```

Contoh: nums = [1, 2, 3, 4, 5], target = 8

```
Iterasi 1: left=0, right=4 -> 1+5 = 6 < 8  -> ++left
Iterasi 2: left=1, right=4 -> 2+5 = 7 < 8  -> ++left
Iterasi 3: left=2, right=4 -> 3+5 = 8 [OK]    (ketemu)
```

## Same Direction Fast & Slow

Contoh kasus: [Remove Duplicates](https://leetcode.com/problems/remove-duplicates-from-sorted-array/), [Move Zeroes](https://leetcode.com/problems/move-zeroes/), [Linked List Cycle](https://leetcode.com/problems/linked-list-cycle/)

```cpp
int slow = 0;
for (int fast = 0; fast < nums.size(); ++fast) {
  if (condition) {
    swap(nums[slow], nums[fast]);
    ++slow;
  }
}
```

Contoh: Pindahkan angka nol ke belakang [0, 1, 0, 3, 12]

slow = posisi tulis untuk non-zero
fast = pemindai mencari non-zero

```
Awal:        [0, 1, 0, 3, 12]
              s
              f

Iterasi 1: fast=0 -> nums[0]=0 (nol, lewati)
             [0, 1, 0, 3, 12]
              s  f

Iterasi 2: fast=1 -> nums[1]=1 (bukan nol) -> swap(nums[0], nums[1]), ++slow
             [1, 0, 0, 3, 12]
                 s     f

Iterasi 3: fast=2 -> nums[2]=0 (nol, lewati)
             [1, 0, 0, 3, 12]
                 s        f

Iterasi 4: fast=3 -> nums[3]=3 (bukan nol) -> swap(nums[1], nums[3]), ++slow
             [1, 3, 0, 0, 12]
                    s     f

Iterasi 5: fast=4 -> nums[4]=12 (bukan nol) -> swap(nums[2], nums[4]), ++slow
             [1, 3, 12, 0, 0]
                        s

Hasil: [1, 3, 12, 0, 0]
```

Insight kunci: slow selalu menunjuk ke posisi di mana elemen yang "diinginkan" berikutnya harus ditempatkan.

Versi alternatif dengan while loop:

```cpp
int slow = 0;
int fast = 0;
while (fast < nums.size()) {
  if (condition) {
    swap(nums[slow], nums[fast]);
    ++slow;
  }
  ++fast;
}
```

## Sliding Window

Contoh kasus: [Minimum Window Substring](https://leetcode.com/problems/minimum-window-substring/), [Longest Substring Without Repeating Characters](https://leetcode.com/problems/longest-substring-without-repeating-characters/), [Maximum Sum of Distinct Subarrays With Length K](https://leetcode.com/problems/maximum-sum-of-distinct-subarrays-with-length-k/)

```cpp
int left = 0;
for (int right = 0; right < nums.size(); ++right) {
  while (window_condition_violated) {
    ++left;
  }
}
```

Contoh: Substring terpanjang tanpa karakter berulang di "abcabcbb"

```
Iterasi 1: left=0, right=0 -> window="a"    (ukuran 1) - expand
Iterasi 2: left=0, right=1 -> window="ab"   (ukuran 2) - expand
Iterasi 3: left=0, right=2 -> window="abc"  (ukuran 3) - expand
Iterasi 4: right=3, 'a' berulang
           left=1, right=3 -> window="bca"  (ukuran 3) - slide
Iterasi 5: right=4, 'b' berulang
           left=2, right=4 -> window="cab"  (ukuran 3) - slide
Iterasi 6: right=5, 'c' berulang
           left=3, right=5 -> window="abc"  (ukuran 3) - slide
Iterasi 7: right=6, 'b' berulang
           left=5, right=6 -> window="cb"   (ukuran 2) - shrink
Iterasi 8: right=7, 'b' berulang
           left=7, right=7 -> window="b"    (ukuran 1) - shrink
Hasil: panjang maksimum = 3 ("abc")
```
