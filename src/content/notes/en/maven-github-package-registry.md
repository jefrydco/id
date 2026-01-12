---
title: "Maven with GitHub Package Registry"
description: "Build Maven projects with private packages from GitHub Package Registry"
publishedAt: 2026-01-12
tags:
  - maven
  - github
  - package-registry
---

**Command:**

```bash
mvn clean install -s ./settings.xml \
  -Djdk.xml.maxGeneralEntitySizeLimit=0 \
  -Djdk.xml.totalEntitySizeLimit=0 \
  -Dkeystore.password=KEYSTORE_PASSWORD \
  -Dkey.password=KEY_PASSWORD \
  -Dgithub.username=YOUR_USERNAME \
  -Dgithub.token=GITHUB_TOKEN
```

**settings.xml:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0
          http://maven.apache.org/xsd/settings-1.0.0.xsd">

    <servers>
        <server>
            <id>github</id>
            <username>${github.username}</username>
            <password>${github.token}</password>
        </server>
    </servers>

</settings>
```
