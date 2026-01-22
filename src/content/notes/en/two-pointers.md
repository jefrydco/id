---
title: "Two Pointers"
description: "Three variations of two pointers: convergent, same direction fast & slow, and sliding window"
publishedAt: 2026-01-22
tags:
  - algorithm
  - two-pointers
  - leetcode
---

## Convergent

Sample case: [Two Sum II](https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/), [Valid Palindrome](https://leetcode.com/problems/valid-palindrome/), [Container With Most Water](https://leetcode.com/problems/container-with-most-water/)

```cpp
while (left < right) {
  if (condition)
    ++left;
  else
    --right;
}
```

Example: nums = [1, 2, 3, 4, 5], target = 8

```
Iteration 1: left=0, right=4 -> 1+5 = 6 < 8  -> ++left
Iteration 2: left=1, right=4 -> 2+5 = 7 < 8  -> ++left
Iteration 3: left=2, right=4 -> 3+5 = 8 [OK]    (found)
```

## Same Direction Fast & Slow

Sample case: [Remove Duplicates](https://leetcode.com/problems/remove-duplicates-from-sorted-array/), [Move Zeroes](https://leetcode.com/problems/move-zeroes/), [Linked List Cycle](https://leetcode.com/problems/linked-list-cycle/)

```cpp
int slow = 0;
for (int fast = 0; fast < nums.size(); ++fast) {
  if (condition) {
    swap(nums[slow], nums[fast]);
    ++slow;
  }
}
```

Example: Move zeroes to end [0, 1, 0, 3, 12]

slow = write position for non-zero
fast = scanner looking for non-zero

```
Initial:     [0, 1, 0, 3, 12]
              s
              f

Iteration 1: fast=0 -> nums[0]=0 (zero, skip)
             [0, 1, 0, 3, 12]
              s  f

Iteration 2: fast=1 -> nums[1]=1 (non-zero) -> swap(nums[0], nums[1]), ++slow
             [1, 0, 0, 3, 12]
                 s     f

Iteration 3: fast=2 -> nums[2]=0 (zero, skip)
             [1, 0, 0, 3, 12]
                 s        f

Iteration 4: fast=3 -> nums[3]=3 (non-zero) -> swap(nums[1], nums[3]), ++slow
             [1, 3, 0, 0, 12]
                    s     f

Iteration 5: fast=4 -> nums[4]=12 (non-zero) -> swap(nums[2], nums[4]), ++slow
             [1, 3, 12, 0, 0]
                        s

Result: [1, 3, 12, 0, 0]
```

Key insight: slow always points to the position where the next "wanted" element should go.

Alternative while loop version:

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

Sample case: [Minimum Window Substring](https://leetcode.com/problems/minimum-window-substring/), [Longest Substring Without Repeating Characters](https://leetcode.com/problems/longest-substring-without-repeating-characters/), [Maximum Sum of Distinct Subarrays With Length K](https://leetcode.com/problems/maximum-sum-of-distinct-subarrays-with-length-k/)

```cpp
int left = 0;
for (int right = 0; right < nums.size(); ++right) {
  while (window_condition_violated) {
    ++left;
  }
}
```

Example: Longest substring without repeating in "abcabcbb"

```
Iteration 1: left=0, right=0 -> window="a"    (size 1) - expand
Iteration 2: left=0, right=1 -> window="ab"   (size 2) - expand
Iteration 3: left=0, right=2 -> window="abc"  (size 3) - expand
Iteration 4: right=3, 'a' repeats
             left=1, right=3 -> window="bca"  (size 3) - slide
Iteration 5: right=4, 'b' repeats
             left=2, right=4 -> window="cab"  (size 3) - slide
Iteration 6: right=5, 'c' repeats
             left=3, right=5 -> window="abc"  (size 3) - slide
Iteration 7: right=6, 'b' repeats
             left=5, right=6 -> window="cb"   (size 2) - shrink
Iteration 8: right=7, 'b' repeats
             left=7, right=7 -> window="b"    (size 1) - shrink
Result: max length = 3 ("abc")
```
