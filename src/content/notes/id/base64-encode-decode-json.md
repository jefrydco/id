---
title: "Base64 Encode & Decode JSON"
description: "Encode dan decode JSON menggunakan base64 dengan heredoc di terminal"
publishedAt: 2026-01-12
tags:
  - base64
  - json
  - terminal
---

**Encode:**

```bash
base64 << 'EOF'
{
  "key": "value",
}
EOF
```

**Decode:**

```bash
echo "ewogICJrZXkiOiAidmFsdWUiLAp9Cg==" | base64 -D
```
