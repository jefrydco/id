---
title: "Base64 Encode & Decode JSON"
description: "Encode and decode JSON using base64 with heredoc in terminal"
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
