# Cross-Module Config Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the auto-merging config-update mechanism already used in `zander-velocity` (BoostedYAML, `LoaderSettings.setAutoUpdate(true)` + `UpdaterSettings` version tracking) to `zander-addon`, `zander-hub`, `zander-pgm`, and `zander-auth`, so a plugin update that adds new `config.yml` keys merges them into an admin's existing file automatically instead of requiring a manual edit.

**Architecture:** Each module's main plugin class builds one `YamlDocument` (BoostedYAML's config object) at startup from its shipped `config.yml` resource plus the on-disk file, using the identical settings `zander-velocity` already uses. Every existing config-read call site in that module migrates from Bukkit's dotted-string `FileConfiguration` API to BoostedYAML's `Route`-based API. `zander-hub`'s separate `welcome.yml` and `zander-velocity` itself are untouched.

**Tech Stack:** BoostedYAML `dev.dejvokep:boosted-yaml:1.3.1` (already a proven dependency in this repo via `zander-velocity`), Maven Shade relocation (existing pattern in every module's pom), JUnit 5.

## Global Constraints

- Add `dev.dejvokep:boosted-yaml:1.3.1` (no explicit `<scope>`, defaults to `compile`) to `zander-addon/pom.xml`, `zander-hub/pom.xml`, `zander-pgm/pom.xml`, `zander-auth/pom.xml`.
- Shade-relocate `dev.dejvokep.boostedyaml` to `dev.anchorlight.zander.<module>.libs.boostedyaml` in each of those four poms, following each pom's own existing `<relocations>` block style — check what's already there first and add alongside it, never replace it.
- Every migrated `config.yml` gains a `config-version: 1` key (none of the four currently has one; `zander-velocity`'s config.yml already has this pattern — match its exact formatting/placement, typically as the first key).
- BoostedYAML's `Route.from(...)` is **varargs, one path segment per argument** — `Route.from("shop-directory", "navigation", "enabled")`, never a single dotted string. There is no `Route.fromString(...)` shortcut used anywhere in this codebase; every existing dotted-string key path (e.g. `"shop-directory.navigation.enabled"`) must become a multi-argument `Route.from(...)` call.
- `zander-hub`'s `ConfigurationManager.setupWelcomeFile()` and `welcome.yml` stay exactly as they are — plain `YamlConfiguration.loadConfiguration`, not part of this migration.
- `zander-velocity` is not touched by this plan — it already has this mechanism.
- `zander-addon`'s `model/PolicyConfig.java` and `model/SocialConfig.java` are plain Gson-populated POJOs (API response models), not `config.yml` consumers — do not touch them.
- `zander-pgm`'s `config.yml` has several keys `ConfigLoader` never reads (`liveFeed.*`, `mapTokens.allowPaidTokens`, `mapVoting.allowWebVoting`/`allowInGameVoting`/`playerVoteWeight`, `mapRatings.allowInGameRatings`/`allowWebRatings`/`showFeedbackPublicly`) — this is pre-existing dead config, out of scope for this plan; do not add reads for them, just preserve them as-is in the migrated `config.yml`.
- Before writing any code against a BoostedYAML method not already confirmed in this plan (the confirmed set: `YamlDocument.create(File, InputStream, GeneralSettings, LoaderSettings, DumperSettings, UpdaterSettings)`, `YamlDocument.create(InputStream, InputStream)`, `.update()`, `.save()`, `.getString(Route)`, `.getInt(Route)`, `.getBoolean(Route)`, `.getLong(Route)`, `.getStringList(Route)`), verify the real signature against the decompiled sources jar already present in the local Maven repo (`~/.m2/repository/dev/dejvokep/boosted-yaml/1.3.1/boosted-yaml-1.3.1-sources.jar`) via `javap`/unzip-and-read — do not guess a plausible-sounding method name.
- Follow each module's existing structural style for exposing config to the rest of its own codebase (do not impose one uniform pattern across modules): `zander-addon` uses instance fields on the `JavaPlugin` subclass; `zander-hub` uses the static-field `ConfigurationManager` utility class; `zander-pgm` uses an instance field on the plugin class holding a parsed config object; `zander-auth` currently has no wrapper class at all (introduce a minimal one, matching the shape of `zander-addon`'s smaller config classes, not velocity's raw-static-getter style, since auth's plugin class already follows Bukkit `JavaPlugin` conventions like addon/hub/pgm, not velocity's proxy-plugin conventions).

---

## File Structure

```
zander-addon/pom.xml                                                          (modify: add BoostedYAML dep + relocation)
zander-hub/pom.xml                                                            (modify: same)
zander-pgm/pom.xml                                                            (modify: same)
zander-auth/pom.xml                                                           (modify: same)

zander-addon/src/main/resources/config.yml                                    (modify: add config-version key)
zander-hub/src/main/resources/config.yml                                      (modify: same)
zander-pgm/src/main/resources/config.yml                                      (modify: same)
zander-auth/src/main/resources/config.yml                                     (modify: same)

zander-addon/src/main/java/dev/anchorlight/zander/addon/ZanderAddonMain.java  (modify: YamlDocument construction + inline reads)
zander-addon/.../shop/ShopDirectoryConfig.java                                (modify: FileConfiguration -> YamlDocument, Route-based reads)
zander-addon/.../api/PolicyApiServer.java                                     (modify: 1 read)
zander-addon/.../events/PlayerEvents.java                                     (modify: 4 reads)
zander-addon/.../service/BridgeService.java                                   (modify: 3 reads)
zander-addon/.../service/PolicyService.java                                   (modify: 2 reads)
zander-addon/.../service/StoreCommandService.java                             (modify: 3 reads)
zander-addon/src/test/java/.../shop/ShopDirectoryConfigTest.java              (modify: build YamlDocument instead of YamlConfiguration)

zander-hub/src/main/java/dev/anchorlight/zander/hub/ConfigurationManager.java (modify: hold YamlDocument instead of FileConfiguration)
zander-hub/.../ZanderHubMain.java                                             (modify: construct YamlDocument, wire ConfigurationManager)
zander-hub/.../utils/ConfigValidator.java                                     (modify: Route-based read/write + config.save())
zander-hub/.../configs/CompassConfig.java                                     (modify: nested section iteration via BoostedYAML)
zander-hub/.../configs/HubLocationsConfig.java                                (modify: Route-based reads)
zander-hub/.../configs/MessagesConfig.java                                    (modify: Route-based reads)
zander-hub/.../configs/MiscConfig.java                                        (modify: Route-based reads)
zander-hub/.../events/HubBoosterPlate.java                                    (modify: 1 read)
zander-hub/.../events/HubPlayerVoid.java                                      (modify: 1 read)

zander-pgm/src/main/java/dev/anchorlight/zander/pgm/config/ConfigLoader.java  (modify: FileConfiguration -> YamlDocument, Route-based + features section)
zander-pgm/.../ZanderPGMPlugin.java                                           (modify: construct YamlDocument, migrate reload path)
zander-pgm/src/test/java/.../config/ConfigLoaderTest.java                     (modify: build YamlDocument instead of YamlConfiguration)

zander-auth/src/main/java/dev/anchorlight/zander/auth/config/ZanderAuthConfig.java  (new: minimal typed config wrapper)
zander-auth/.../ZanderAuthMain.java                                           (modify: construct YamlDocument, expose config)
zander-auth/.../events/AuthPlayerJoin.java                                    (modify: 2 reads)
zander-auth/.../events/UserOnServerPing.java                                  (modify: 1 read)
```

---

### Task 1: Add BoostedYAML dependency and shade relocation to all four poms

**Files:**
- Modify: `zander-addon/pom.xml`
- Modify: `zander-hub/pom.xml`
- Modify: `zander-pgm/pom.xml`
- Modify: `zander-auth/pom.xml`

**Interfaces:**
- Produces: `dev.dejvokep.boostedyaml.*` classes available at compile scope in all four modules, relocated on shade so the runtime classpath has each module's own copy under its own package.

- [ ] **Step 1: Read each pom's current `<dependencies>` and `<relocations>` blocks**

Before editing, run:
```bash
grep -n "<relocations>" -A 30 zander-addon/pom.xml zander-hub/pom.xml zander-pgm/pom.xml zander-auth/pom.xml
```
Note each module's existing relocation entries (addon already relocates Requests/json-path/gson under `dev.anchorlight.zander.addon.libs.*`, per prior work) so the new entry is added alongside them, not replacing them.

- [ ] **Step 2: Add the dependency to each pom**

In each of the four `pom.xml` files, inside `<dependencies>`:
```xml
<dependency>
    <groupId>dev.dejvokep</groupId>
    <artifactId>boosted-yaml</artifactId>
    <version>1.3.1</version>
</dependency>
```
This matches `zander-velocity/pom.xml`'s exact coordinate (no `<scope>` tag — defaults to `compile`, required since BoostedYAML must be shaded into each module's own jar).

- [ ] **Step 3: Add the shade relocation to each pom**

Inside each pom's existing `<relocations>` block (inside `maven-shade-plugin`'s `<configuration>`), add:
```xml
<relocation>
    <pattern>dev.dejvokep.boostedyaml</pattern>
    <shadedPattern>dev.anchorlight.zander.<MODULE>.libs.boostedyaml</shadedPattern>
</relocation>
```
substituting `<MODULE>` with `addon`, `hub`, `pgm`, `auth` respectively (matching each module's own root package name — confirm the exact root package per module before writing, e.g. `dev.anchorlight.zander.addon` for zander-addon).

If a pom has no `maven-shade-plugin`/`<relocations>` block at all yet (check `zander-auth/pom.xml` and `zander-hub/pom.xml` specifically — they may not currently shade anything since they may have had no third-party runtime deps before this), add a minimal `maven-shade-plugin` execution matching `zander-addon/pom.xml`'s existing plugin version and `<execution>` phase/goal structure, with just this one relocation.

- [ ] **Step 4: Verify each module resolves and compiles**

```bash
cd zander-addon && mvn -q compile && cd ../zander-hub && mvn -q compile && cd ../zander-pgm && mvn -q compile && cd ../zander-auth && mvn -q compile
```
Expected: `BUILD SUCCESS` for all four (no source changes yet, this only proves the new dependency resolves and doesn't break compilation).

- [ ] **Step 5: Commit**

```bash
git add zander-addon/pom.xml zander-hub/pom.xml zander-pgm/pom.xml zander-auth/pom.xml
git commit -m "build: add BoostedYAML dependency to addon, hub, pgm, auth modules"
```

---

### Task 2: Verify BoostedYAML's section-iteration API

`zander-hub`'s `CompassConfig` and `zander-pgm`'s `ConfigLoader` both currently iterate a nested `ConfigurationSection`'s keys (Bukkit's `section.getKeys(false)`) to read a dynamic map of entries (`compass.servers.<id>.*` and `features.*` respectively). BoostedYAML's equivalent API was not confirmed during design research — this task verifies it with hard evidence before Tasks 6 and 8 need it.

**Files:** none (research only, no commit — same pattern as the Shop Directory plan's Task 8).

- [ ] **Step 1: Locate the section-iteration API in the sources jar**

```bash
mkdir -p /tmp/boostedyaml-src && cd /tmp/boostedyaml-src
unzip -o ~/.m2/repository/dev/dejvokep/boosted-yaml/1.3.1/boosted-yaml-1.3.1-sources.jar -d .
find . -iname "*Section*.java" -o -iname "*Route*.java"
```
Read `dev/dejvokep/boostedyaml/block/implementation/Section.java` (or wherever it lands) for methods that return a sub-`Section` given a `Route`, and for methods that list the immediate child keys/routes of a `Section` (likely named something like `getKeys()`, `getRoutes(boolean deep)`, or `getRoutesAsStrings(boolean deep)` — confirm the exact name and return type, e.g. `Set<String>` vs `Set<Route>`).

- [ ] **Step 2: Write down the confirmed API shape**

Record, as a short note (can just be your report text, no file needed): the method to get a nested `Section` given a parent `Route` (e.g. `YamlDocument.getSection(Route)` or similar), and the method to enumerate that section's direct child key names. This will be quoted directly in Tasks 6 and 8's dispatch instructions.

- [ ] **Step 3: No commit** — pure research feeding later tasks.

---

### Task 3: Add `config-version` key to all four config.yml files

**Files:**
- Modify: `zander-addon/src/main/resources/config.yml`
- Modify: `zander-hub/src/main/resources/config.yml`
- Modify: `zander-pgm/src/main/resources/config.yml`
- Modify: `zander-auth/src/main/resources/config.yml`

**Interfaces:**
- Produces: a `config-version: 1` key present in each shipped default, matching `zander-velocity/src/main/resources/config.yml`'s exact placement/formatting convention (check that file first).

- [ ] **Step 1: Check velocity's config-version placement**

```bash
head -5 zander-velocity/src/main/resources/config.yml
```

- [ ] **Step 2: Add the same key/format to each of the four target config.yml files**

Add `config-version: 1` as the first line (or matching velocity's exact position) of each file. Do not reformat or reorder any other existing keys in these files.

- [ ] **Step 3: Commit**

```bash
git add zander-addon/src/main/resources/config.yml zander-hub/src/main/resources/config.yml zander-pgm/src/main/resources/config.yml zander-auth/src/main/resources/config.yml
git commit -m "feat: add config-version key to addon, hub, pgm, auth config.yml"
```

---

### Task 4: zander-auth migration (smallest module, closest to the velocity pattern)

**Files:**
- Create: `zander-auth/src/main/java/dev/anchorlight/zander/auth/config/ZanderAuthConfig.java`
- Modify: `zander-auth/src/main/java/dev/anchorlight/zander/auth/ZanderAuthMain.java`
- Modify: `zander-auth/src/main/java/dev/anchorlight/zander/auth/events/AuthPlayerJoin.java`
- Modify: `zander-auth/src/main/java/dev/anchorlight/zander/auth/events/UserOnServerPing.java`

**Interfaces:**
- Produces: `ZanderAuthConfig` — a small record/class with a static factory `from(YamlDocument config)` exposing `baseApiUrl()`, `apiKey()`, `motdTopLine()`, all `String`. This mirrors `ShopDirectoryConfig`'s existing shape in `zander-addon` (typed wrapper, not raw scattered reads), while `ZanderAuthMain` holds the `YamlDocument` itself the way `zander-pgm`'s plugin class holds its config object.

- [ ] **Step 1: Read `ZanderAuthMain.java` in full**

Understand its current `onEnable`/`onDisable` exactly (confirmed from research: it calls `saveConfig()` in `onDisable` but never `saveDefaultConfig()` in `onEnable` — Bukkit's lazy `getConfig()` currently handles the first-run default copy implicitly). Note this quirk will go away once `YamlDocument.create(...)` explicitly handles both the on-disk file and the jar resource.

- [ ] **Step 2: Construct the `YamlDocument` in `ZanderAuthMain.onEnable()`**

```java
private YamlDocument config;

@Override
public void onEnable() {
    try {
        config = YamlDocument.create(new File(getDataFolder(), "config.yml"),
                Objects.requireNonNull(getResource("config.yml")),
                GeneralSettings.DEFAULT,
                LoaderSettings.builder().setAutoUpdate(true).build(),
                DumperSettings.DEFAULT,
                UpdaterSettings.builder()
                        .setVersioning(new BasicVersioning("config-version"))
                        .setOptionSorting(UpdaterSettings.OptionSorting.SORT_BY_DEFAULTS)
                        .build());
        config.update();
        config.save();
    } catch (IOException e) {
        getLogger().severe("Could not create or load plugin configuration: " + e.getMessage());
        getServer().getPluginManager().disablePlugin(this);
        return;
    }
    // ... rest of existing onEnable logic, now using `config` instead of getConfig()
}

public YamlDocument getYamlConfig() {
    return config;
}
```
Match this against `ZanderVelocityMain.java`'s real construction block (already confirmed exact) — imports are `dev.dejvokep.boostedyaml.YamlDocument`, `dev.dejvokep.boostedyaml.dvs.versioning.BasicVersioning`, `dev.dejvokep.boostedyaml.settings.dumper.DumperSettings`, `dev.dejvokep.boostedyaml.settings.general.GeneralSettings`, `dev.dejvokep.boostedyaml.settings.loader.LoaderSettings`, `dev.dejvokep.boostedyaml.settings.updater.UpdaterSettings`. Name the getter `getYamlConfig()` (not `getConfig()`) to avoid colliding with/shadowing `JavaPlugin`'s own inherited `getConfig()` method (which still exists and still returns the stale Bukkit `FileConfiguration` if called by mistake — this naming makes such a mistake load-bearing-obvious in review).

- [ ] **Step 3: Implement `ZanderAuthConfig`**

```java
package dev.anchorlight.zander.auth.config;

import dev.dejvokep.boostedyaml.YamlDocument;
import dev.dejvokep.boostedyaml.route.Route;

public record ZanderAuthConfig(String baseApiUrl, String apiKey, String motdTopLine) {
    public static ZanderAuthConfig from(YamlDocument config) {
        return new ZanderAuthConfig(
                config.getString(Route.from("BaseAPIURL")),
                config.getString(Route.from("APIKey")),
                config.getString(Route.from("MOTDTopLine"))
        );
    }
}
```

- [ ] **Step 4: Migrate the two consumer files**

`AuthPlayerJoin.java`: replace `plugin.getConfig().get("BaseAPIURL")` / `plugin.getConfig().get("APIKey")` with reads through `plugin.getYamlConfig()` via `ZanderAuthConfig.from(...)` (either read once and pass the record through, or call `Route.from("BaseAPIURL")`/`Route.from("APIKey")` directly if a single-shot read is simpler in that file — match the file's existing structure, don't introduce unnecessary indirection for a 2-line usage).

`UserOnServerPing.java`: replace `plugin.getConfig().getString("MOTDTopLine")` with the equivalent read through `plugin.getYamlConfig()`.

- [ ] **Step 5: Compile check**

```bash
cd zander-auth && mvn -q compile
```
Expected: `BUILD SUCCESS`.

- [ ] **Step 6: Commit**

```bash
git add zander-auth/
git commit -m "feat: migrate zander-auth to BoostedYAML config with auto-update"
```

---

### Task 5: zander-addon migration part 1 — main class + ShopDirectoryConfig + its test

**Files:**
- Modify: `zander-addon/src/main/java/dev/anchorlight/zander/addon/ZanderAddonMain.java`
- Modify: `zander-addon/src/main/java/dev/anchorlight/zander/addon/shop/ShopDirectoryConfig.java`
- Modify: `zander-addon/src/test/java/dev/anchorlight/zander/addon/shop/ShopDirectoryConfigTest.java`

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: `ZanderAddonMain` exposes a `YamlDocument` via a new `getYamlConfig()` method (do not remove or rename the existing Bukkit `getConfig()` inherited method — other not-yet-migrated call sites in Task 6 still need it temporarily if this task and Task 6 are executed as separate reviewed units; but since both are part of this same plan, prefer migrating all `ZanderAddonMain`-adjacent reads in one pass if practical — see Step 2 note).
- `ShopDirectoryConfig.from(YamlDocument config)` — same field names/types as before (`enabled`, `sellingOnly`, `inStockOnly`, `resultsPerPage`, `worlds`, `navigationEnabled`, `arrivalDistance`, `updateIntervalTicks`, `compass`, `actionBar`), only the parameter type and internal read calls change.

- [ ] **Step 1: Construct the `YamlDocument` in `ZanderAddonMain`**

Same pattern as Task 4 Step 2 (adapt for `JavaPlugin`'s `onEnable()` — `zander-addon` already has an `onEnable()`, insert the construction at the very top before any other config-dependent logic runs, since `command-bridge.enabled`/`bridge.enabled`/etc. reads happen later in the same method per the existing survey). Add a `getYamlConfig()` method returning the `YamlDocument`.

- [ ] **Step 2: Migrate all inline `getConfig()` reads in `ZanderAddonMain` itself**

Confirmed exact current reads (from research): `getConfig().getBoolean("api-server.enabled", false)`, `getConfig().getBoolean("command-bridge.enabled", true)`, `getConfig().getString("server-name", "survival")` (appears twice), `getConfig().getBoolean("bridge.enabled", true)`. Convert each to the `Route`-based equivalent, e.g.:
```java
config.getBoolean(Route.from("api-server", "enabled"), false)
config.getString(Route.from("server-name"), "survival")
```

- [ ] **Step 3: Migrate `ShopDirectoryConfig.from(...)`**

Change the parameter type from `FileConfiguration` to `YamlDocument`, and every read from dotted-string to multi-arg `Route.from(...)`:
```java
package dev.anchorlight.zander.addon.shop;

import dev.dejvokep.boostedyaml.YamlDocument;
import dev.dejvokep.boostedyaml.route.Route;

import java.util.List;

public record ShopDirectoryConfig(
        boolean enabled,
        boolean sellingOnly,
        boolean inStockOnly,
        int resultsPerPage,
        List<String> worlds,
        boolean navigationEnabled,
        int arrivalDistance,
        long updateIntervalTicks,
        boolean compass,
        boolean actionBar
) {
    public static ShopDirectoryConfig from(YamlDocument config) {
        return new ShopDirectoryConfig(
                config.getBoolean(Route.from("shop-directory", "enabled"), false),
                config.getBoolean(Route.from("shop-directory", "selling-only"), true),
                config.getBoolean(Route.from("shop-directory", "in-stock-only"), true),
                config.getInt(Route.from("shop-directory", "results-per-page"), 8),
                config.getStringList(Route.from("shop-directory", "worlds")),
                config.getBoolean(Route.from("shop-directory", "navigation", "enabled"), true),
                config.getInt(Route.from("shop-directory", "navigation", "arrival-distance"), 5),
                config.getLong(Route.from("shop-directory", "navigation", "update-interval-ticks"), 10L),
                config.getBoolean(Route.from("shop-directory", "navigation", "compass"), true),
                config.getBoolean(Route.from("shop-directory", "navigation", "action-bar"), true)
        );
    }
}
```
Verify `.getLong(Route, long)` exists with that exact signature on `YamlDocument`/`Section` in the sources jar before finalizing (the earlier research only confirmed `.getString`/`.getInt` call sites in velocity; `.getBoolean`/`.getStringList`/`.getLong` were not independently confirmed as call sites, only assumed to exist as standard BoostedYAML `Section` methods — verify each via the sources jar, `javap`, or `unzip -p ... | grep "public.*getLong\|public.*getBoolean\|public.*getStringList"` before treating this code as final).

- [ ] **Step 4: Update `ShopDirectoryConfig.from(getConfig())` call site**

In `ZanderAddonMain`, change `ShopDirectoryConfig.from(getConfig())` to `ShopDirectoryConfig.from(config)` (the new `YamlDocument` field/variable from Step 1).

- [ ] **Step 5: Rewrite `ShopDirectoryConfigTest`**

Replace `YamlConfiguration`-based construction with in-memory `YamlDocument` construction, per the confirmed test-friendly factory:
```java
package dev.anchorlight.zander.addon.shop;

import dev.dejvokep.boostedyaml.YamlDocument;
import dev.dejvokep.boostedyaml.settings.dumper.DumperSettings;
import dev.dejvokep.boostedyaml.settings.general.GeneralSettings;
import dev.dejvokep.boostedyaml.settings.loader.LoaderSettings;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ShopDirectoryConfigTest {

    private YamlDocument yamlFrom(String yaml) throws IOException {
        byte[] bytes = yaml.getBytes(StandardCharsets.UTF_8);
        return YamlDocument.create(new ByteArrayInputStream(bytes), new ByteArrayInputStream(bytes),
                GeneralSettings.DEFAULT, LoaderSettings.DEFAULT, DumperSettings.DEFAULT,
                dev.dejvokep.boostedyaml.settings.updater.UpdaterSettings.DEFAULT);
    }

    @Test
    void defaultsToDisabledWhenSectionMissing() throws IOException {
        YamlDocument config = yamlFrom("");
        ShopDirectoryConfig result = ShopDirectoryConfig.from(config);
        assertFalse(result.enabled());
    }

    @Test
    void parsesFullSection() throws IOException {
        YamlDocument config = yamlFrom("""
                shop-directory:
                  enabled: true
                  selling-only: false
                  in-stock-only: false
                  results-per-page: 5
                  worlds: ["world", "world_nether"]
                  navigation:
                    enabled: false
                    arrival-distance: 3
                    update-interval-ticks: 20
                    compass: false
                    action-bar: false
                """);
        ShopDirectoryConfig result = ShopDirectoryConfig.from(config);

        assertTrue(result.enabled());
        assertFalse(result.sellingOnly());
        assertFalse(result.inStockOnly());
        assertEquals(5, result.resultsPerPage());
        assertEquals(List.of("world", "world_nether"), result.worlds());
        assertFalse(result.navigationEnabled());
        assertEquals(3, result.arrivalDistance());
        assertEquals(20L, result.updateIntervalTicks());
        assertFalse(result.compass());
        assertFalse(result.actionBar());
    }

    @Test
    void missingWorldsDefaultsToEmptyList() throws IOException {
        YamlDocument config = yamlFrom("shop-directory:\n  enabled: true\n");
        ShopDirectoryConfig result = ShopDirectoryConfig.from(config);
        assertTrue(result.worlds().isEmpty());
    }
}
```
Verify `LoaderSettings.DEFAULT` and `UpdaterSettings.DEFAULT` exist as static constants (they should, mirroring `GeneralSettings.DEFAULT`/`DumperSettings.DEFAULT` which are confirmed) — check the sources jar if uncertain. If `YamlDocument.create` requires update/versioning settings that error on an empty/no-`config-version` document in this all-defaults mode, adjust to whatever the simplest working construction is — the goal is a `YamlDocument` usable for read-only assertions in a test, not exercising the update/merge machinery itself (that's implicitly covered by production code + manual testing, not by these unit tests).

- [ ] **Step 6: Run tests and compile**

```bash
cd zander-addon && mvn -q test -Dtest=ShopDirectoryConfigTest && mvn -q compile
```
Expected: `BUILD SUCCESS`, 3/3 tests passing.

- [ ] **Step 7: Commit**

```bash
git add zander-addon/src/main/java/dev/anchorlight/zander/addon/ZanderAddonMain.java zander-addon/src/main/java/dev/anchorlight/zander/addon/shop/ShopDirectoryConfig.java zander-addon/src/test/java/dev/anchorlight/zander/addon/shop/ShopDirectoryConfigTest.java
git commit -m "feat: migrate ZanderAddonMain and ShopDirectoryConfig to BoostedYAML"
```

---

### Task 6: zander-addon migration part 2 — remaining consumers

**Files:**
- Modify: `zander-addon/src/main/java/dev/anchorlight/zander/addon/api/PolicyApiServer.java`
- Modify: `zander-addon/src/main/java/dev/anchorlight/zander/addon/events/PlayerEvents.java`
- Modify: `zander-addon/src/main/java/dev/anchorlight/zander/addon/service/BridgeService.java`
- Modify: `zander-addon/src/main/java/dev/anchorlight/zander/addon/service/PolicyService.java`
- Modify: `zander-addon/src/main/java/dev/anchorlight/zander/addon/service/StoreCommandService.java`

**Interfaces:**
- Consumes: `ZanderAddonMain.getYamlConfig()` from Task 5.

- [ ] **Step 1: Migrate each file's config reads**

Each of these currently calls `plugin.getConfig().get...(...)` (they hold a `plugin`/`ZanderAddonMain` reference already, per the existing constructor patterns). Change every call site to `plugin.getYamlConfig().get...(Route.from(...))`:

- `PolicyApiServer.java`: `getInt("api-server.port", 8080)` → `getInt(Route.from("api-server", "port"), 8080)`
- `PlayerEvents.java`: `getBoolean("policy-book.enabled", true)`, `getBoolean("social-paper.enabled", true)`, `getInt("policy-book.slot", 8)`, `getInt("social-paper.slot", 7)` → multi-arg `Route.from(...)` equivalents
- `BridgeService.java`: `getString("api-url", "")`, `getString("api-key", "")`, `getString("server-name", "survival")` → `Route.from("api-url")` etc. (all flat keys, single-arg `Route.from`)
- `PolicyService.java`: `getString("api-url")` (no default — confirm whether `YamlDocument.getString(Route)` without a default arg exists, or whether a `null`/empty-string default must now be supplied explicitly; BoostedYAML's no-default overload may behave differently than Bukkit's — verify against the sources jar) → `Route.from("api-url")`
- `StoreCommandService.java`: `getString("api-url", "")`, `getString("api-key", "")`, `getString("server-name", "survival")` → same as `BridgeService`

- [ ] **Step 2: Compile check**

```bash
cd zander-addon && mvn -q compile
```
Expected: `BUILD SUCCESS`.

- [ ] **Step 3: Run full module test suite**

```bash
cd zander-addon && mvn -q test
```
Expected: `BUILD SUCCESS`, all existing tests still passing (this task shouldn't change any test files, but confirms no regression from the config-object-type change rippling through).

- [ ] **Step 4: Commit**

```bash
git add zander-addon/src/main/java/dev/anchorlight/zander/addon/api/PolicyApiServer.java zander-addon/src/main/java/dev/anchorlight/zander/addon/events/PlayerEvents.java zander-addon/src/main/java/dev/anchorlight/zander/addon/service/BridgeService.java zander-addon/src/main/java/dev/anchorlight/zander/addon/service/PolicyService.java zander-addon/src/main/java/dev/anchorlight/zander/addon/service/StoreCommandService.java
git commit -m "feat: migrate remaining zander-addon config consumers to BoostedYAML"
```

---

### Task 7: zander-hub migration part 1 — ConfigurationManager, ConfigValidator, and the three simpler config classes

**Files:**
- Modify: `zander-hub/src/main/java/dev/anchorlight/zander/hub/ZanderHubMain.java`
- Modify: `zander-hub/src/main/java/dev/anchorlight/zander/hub/ConfigurationManager.java`
- Modify: `zander-hub/src/main/java/dev/anchorlight/zander/hub/utils/ConfigValidator.java`
- Modify: `zander-hub/src/main/java/dev/anchorlight/zander/hub/configs/MiscConfig.java`
- Modify: `zander-hub/src/main/java/dev/anchorlight/zander/hub/configs/HubLocationsConfig.java`
- Modify: `zander-hub/src/main/java/dev/anchorlight/zander/hub/configs/MessagesConfig.java`

**Interfaces:**
- Produces: `ZanderHubMain` exposes a `YamlDocument` via a new method (name it consistently with Tasks 4-6, e.g. `getYamlConfig()`). `ConfigurationManager`'s static setup methods now construct their config-class helpers against this `YamlDocument` instead of `plugin.getConfig()`.

- [ ] **Step 1: Read `ConfigValidator.java` in full before touching anything**

This class is currently coupled to Bukkit's `FileConfiguration`/`plugin.saveConfig()` (it self-heals invalid values by writing a corrected value back to the config and saving). Understand its exact current signature and behavior before adapting — do not guess its contract from the one-line summaries in prior research notes.

- [ ] **Step 2: Construct the `YamlDocument` in `ZanderHubMain`**

Same pattern as Tasks 4-5 (JavaPlugin `onEnable()`, insert before `ConfigurationManager.setup*()` calls are invoked, since those depend on config being loaded first).

- [ ] **Step 3: Adapt `ConfigValidator`**

Change its parameter type(s) from `FileConfiguration`/`Plugin` (whatever Step 1 revealed) to `YamlDocument`, and change its self-heal "write back the corrected value" behavior from Bukkit's `config.set(path, value); plugin.saveConfig();` to BoostedYAML's `config.set(Route.from(...), value); config.save();` (verify `.set(Route, Object)` exists on `YamlDocument`/`Section` — a write method must exist since BoostedYAML supports round-tripping; confirm against the sources jar rather than assuming Bukkit's method name transfers unchanged).

- [ ] **Step 4: Update `ConfigurationManager` to hold/pass a `YamlDocument`**

Wherever `ConfigurationManager`'s `setup*Config()` methods currently construct a config class using `ZanderHubMain.plugin` (which internally calls `plugin.getConfig()`), change them to pass `ZanderHubMain.plugin.getYamlConfig()` instead — check each `setup*Config()` method's real current signature (Step 1 research showed `CompassConfig`/`HubLocationsConfig`/`MessagesConfig`/`MiscConfig` constructors take `plugin` directly, not a config object, so the config classes themselves need to call `plugin.getYamlConfig()` internally — match whichever the real constructor signature is).

- [ ] **Step 5: Migrate `MiscConfig.java`**

`setupSlotHubCompass()`: `config.getInt(field)` where `field = "misc.slot_hub_compass"` → `config.getInt(Route.from("misc", "slot_hub_compass"))`, keep the fallback-4 default logic wired the same way it works today (check whether `ConfigValidator` supplies the default or `MiscConfig` does directly — Step 1's understanding should clarify).
`setupAlwaysFirstJoin()`: same pattern for `misc.always_first_join` (boolean, fallback false).

- [ ] **Step 6: Migrate `HubLocationsConfig.java`**

`setupSpawn()`: fields `hub.world` (String), `hub.x`/`hub.y`/`hub.z` (double), `hub.pitch`/`hub.yaw` (double) — convert each `config.getString(fieldWorld)`/`config.getDouble(fieldX)` etc. to `Route.from("hub", "world")`/`Route.from("hub", "x")` equivalents. Verify `.getDouble(Route)` exists on `YamlDocument`/`Section` (not yet confirmed in research — check the sources jar).

- [ ] **Step 7: Migrate `MessagesConfig.java`**

`setupJoinLeave()`: fields `messages.join`, `messages.leave` (String) — same `Route.from("messages", "join")` pattern. Leave the separate PremiumVanish `messages.yml` load/save (plain `YamlConfiguration`) completely untouched — that's a different plugin's file, out of scope.

- [ ] **Step 8: Compile check**

```bash
cd zander-hub && mvn -q compile
```
Expected: `BUILD SUCCESS`.

- [ ] **Step 9: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/ZanderHubMain.java zander-hub/src/main/java/dev/anchorlight/zander/hub/ConfigurationManager.java zander-hub/src/main/java/dev/anchorlight/zander/hub/utils/ConfigValidator.java zander-hub/src/main/java/dev/anchorlight/zander/hub/configs/MiscConfig.java zander-hub/src/main/java/dev/anchorlight/zander/hub/configs/HubLocationsConfig.java zander-hub/src/main/java/dev/anchorlight/zander/hub/configs/MessagesConfig.java
git commit -m "feat: migrate ZanderHubMain, ConfigValidator, and simple hub config classes to BoostedYAML"
```

---

### Task 8: zander-hub migration part 2 — CompassConfig (nested section) and direct call sites

**Files:**
- Modify: `zander-hub/src/main/java/dev/anchorlight/zander/hub/configs/CompassConfig.java`
- Modify: `zander-hub/src/main/java/dev/anchorlight/zander/hub/events/HubBoosterPlate.java`
- Modify: `zander-hub/src/main/java/dev/anchorlight/zander/hub/events/HubPlayerVoid.java`

**Interfaces:**
- Consumes: Task 2's confirmed section-iteration API, Task 7's `ZanderHubMain.getYamlConfig()`.

- [ ] **Step 1: Migrate `CompassConfig.setupServers()`**

Currently: `config.getConfigurationSection("compass.servers")` then per-entry `entry.getString("material")`/`.getString("display")`/`.getString("lore")` iterated via Bukkit's section-keys API. Using Task 2's confirmed BoostedYAML equivalent (the section-fetch-by-`Route` method plus the child-key-enumeration method), rewrite this to:
1. Get the `compass.servers` section via `Route.from("compass", "servers")`.
2. Enumerate its direct child keys (the per-server IDs: build/survival/mixed/events/creative).
3. For each child key, read `material`/`display`/`lore` via `Route.from("compass", "servers", childKey, "material")` etc. (or via a sub-section fetch, whichever Task 2's confirmed API makes more natural — match the real API shape, don't force a particular style).

- [ ] **Step 2: Migrate `HubBoosterPlate.java`**

`plugin.getConfig().getInt("velocitymultiplier")` (flat, top-level, no default currently) → `plugin.getYamlConfig().getInt(Route.from("velocitymultiplier"))`.

- [ ] **Step 3: Migrate `HubPlayerVoid.java`**

`plugin.getConfig().getString("hub.world", defaultworld.getName())` → `plugin.getYamlConfig().getString(Route.from("hub", "world"), defaultworld.getName())`.

- [ ] **Step 4: Compile check**

```bash
cd zander-hub && mvn -q compile
```
Expected: `BUILD SUCCESS`.

- [ ] **Step 5: Full module test run**

```bash
cd zander-hub && mvn -q test
```
Expected: `BUILD SUCCESS` (this migration shouldn't change hub's existing test suite's outcomes; if hub currently has no tests touching config, this just confirms no compile regression).

- [ ] **Step 6: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/configs/CompassConfig.java zander-hub/src/main/java/dev/anchorlight/zander/hub/events/HubBoosterPlate.java zander-hub/src/main/java/dev/anchorlight/zander/hub/events/HubPlayerVoid.java
git commit -m "feat: migrate CompassConfig and remaining direct hub config reads to BoostedYAML"
```

---

### Task 9: zander-pgm migration — ConfigLoader, ZanderPGMPlugin, and its test

**Files:**
- Modify: `zander-pgm/src/main/java/dev/anchorlight/zander/pgm/config/ConfigLoader.java`
- Modify: `zander-pgm/src/main/java/dev/anchorlight/zander/pgm/ZanderPGMPlugin.java`
- Modify: `zander-pgm/src/test/java/dev/anchorlight/zander/pgm/config/ConfigLoaderTest.java`

**Interfaces:**
- Consumes: Task 2's confirmed section-iteration API (for the `features.*` map).
- Produces: `ConfigLoader.load(YamlDocument config)` — same return type `ZanderPGMConfig` as before, only the parameter type and internal reads change. `ZanderPGMConfig`'s own fields/shape are untouched (it's a plain data holder, not a `FileConfiguration` consumer itself).

- [ ] **Step 1: Read `ConfigLoader.java` and `ZanderPGMConfig.java` in full**

Confirm the exact ~50 read call sites and the `features` `ConfigurationSection` iteration block (research located it at what was reported as lines 34-39, reading `c.getConfigurationSection("features")` → `.getKeys(false)` → per-key `.getBoolean(key)` populating a `Map<String, Boolean>` field). Also note: `zander-pgm/config.yml` has a `liveFeed.*` section and several `mapTokens`/`mapVoting`/`mapRatings` keys `ConfigLoader` never reads — per Global Constraints, leave these unread, just don't break their presence in the migrated `config.yml`.

- [ ] **Step 2: Construct the `YamlDocument` in `ZanderPGMPlugin`**

Same pattern as prior tasks, inserted at the point currently occupied by `saveDefaultConfig(); this.config = ConfigLoader.load(getConfig());` (replace both lines with the `YamlDocument` construction followed by `this.config = ConfigLoader.load(yamlConfig);`).

- [ ] **Step 3: Migrate the reload path**

`reloadPluginConfig()` currently does `reloadConfig(); this.config = ConfigLoader.load(getConfig());`. BoostedYAML's equivalent reload is likely `yamlConfig.reload()` (verify this method exists on `YamlDocument` via the sources jar — not yet confirmed in research) followed by `this.config = ConfigLoader.load(yamlConfig);`. If no bare `.reload()` exists, the fallback is re-running the same `YamlDocument.create(...)` construction from Step 2 and reassigning the field — confirm which is correct before finalizing.

- [ ] **Step 4: Rewrite `ConfigLoader.load(...)`**

Change the parameter type from `FileConfiguration` to `YamlDocument`. Convert every dotted-string read (e.g. `c.getString("server.id", cfg.serverId)`) to multi-arg `Route.from("server", "id")` form, preserving each existing Java-side default value exactly as-is (the defaults live in `ZanderPGMConfig`'s field initializers per the research — don't change what any read falls back to). For the `features` section: use Task 2's confirmed section-fetch-by-`Route` + child-key-enumeration API in place of `getConfigurationSection("features")`/`.getKeys(false)`, keeping the same `Map<String, Boolean>` population logic.

- [ ] **Step 5: Rewrite `ConfigLoaderTest`**

Same in-memory `YamlDocument` construction pattern as Task 5 Step 5's rewritten `ShopDirectoryConfigTest`, adapted to `ConfigLoader.load(...)`'s actual test content (the existing single test `loadsApiToken()` sets `api.token` and asserts `config.token` — reproduce this with a YAML string `"api:\n  token: mixed-token\n"` fed through the same `yamlFrom(...)`-style helper).

- [ ] **Step 6: Run tests and compile**

```bash
cd zander-pgm && mvn -q test -Dtest=ConfigLoaderTest && mvn -q compile
```
Expected: `BUILD SUCCESS`, test passing.

- [ ] **Step 7: Full module test run**

```bash
cd zander-pgm && mvn -q test
```
Expected: `BUILD SUCCESS`, no regressions in `ZanderApiClientTest` or any other existing test.

- [ ] **Step 8: Commit**

```bash
git add zander-pgm/src/main/java/dev/anchorlight/zander/pgm/config/ConfigLoader.java zander-pgm/src/main/java/dev/anchorlight/zander/pgm/ZanderPGMPlugin.java zander-pgm/src/test/java/dev/anchorlight/zander/pgm/config/ConfigLoaderTest.java
git commit -m "feat: migrate zander-pgm ConfigLoader and plugin wiring to BoostedYAML"
```

---

### Task 10: Full build, full test suite, and manual verification pass

**Files:** none created; verification only.

- [ ] **Step 1: Run each migrated module's test suite**

```bash
cd zander-addon && mvn -q test && cd ../zander-hub && mvn -q test && cd ../zander-pgm && mvn -q test && cd ../zander-auth && mvn -q test
```
Expected: `BUILD SUCCESS` for all four.

- [ ] **Step 2: Run the full multi-module build**

```bash
cd .. && mvn -q clean package
```
Expected: `BUILD SUCCESS` across all six modules (including untouched `zander-velocity`/`zander-waterfall`-if-still-buildable).

- [ ] **Step 3: Confirm no other module regressed**

```bash
mvn -q -pl '!zander-addon,!zander-hub,!zander-pgm,!zander-auth' test
```
Expected: `BUILD SUCCESS` — proves `zander-velocity` (untouched) still builds/tests cleanly.

- [ ] **Step 4: Manual verification of the actual auto-update behavior (requires a real/simulated deploy, not just `mvn test`)**

**Correction (verified against BoostedYAML source, `VersionedOperations.run(...)`):** `LoaderSettings.setAutoUpdate(true)` only guarantees `update()` runs on every load — it does not make the key-merge unconditional. `VersionedOperations.run` compares the on-disk `config-version` against the shipped default's `config-version`; if they are **equal**, `Merger.merge` is skipped entirely. Simply deleting a key from an on-disk `config.yml` and restarting (with `config-version` left untouched at the value the file was created with) will therefore **not** cause the key to reappear — that is correct BoostedYAML behavior, not a bug, and any manual test must not assume otherwise. A missing/absent `config-version` on disk, however, is treated as older than the shipped default and **does** trigger a merge (separately confirmed correct) — this is also the realistic real-world case, since existing production installs predate this feature and have no `config-version` key at all.

For at least one module (recommend `zander-addon`, since it has the richest config with nested sections), simulate an upgrade scenario:
1. Build the current jar, deploy to a scratch server directory, start it once so `config.yml` gets created on disk with `config-version: 1`.
2. Manually delete one nested key from the on-disk `config.yml` (e.g. remove `shop-directory.navigation.compass`) and change an unrelated value the admin "customized" (e.g. change `results-per-page` to `12`).
3. Simulate the upgrade using one of the two approaches below (do not skip this — restarting with `config-version` unchanged will falsely appear to "pass" by doing nothing, since the merge is skipped):
   - **(a) Simulate a version-bumped release:** increment `config-version` in the on-disk `config.yml` to a value lower than what the next shipped default will carry (or bump the shipped default's `config-version` and rebuild), so the on-disk value is genuinely older than the shipped default.
   - **(b) Simulate a genuine first-time upgrade from a pre-auto-update install (more realistic — matches real production installs):** delete the `config-version` line from the on-disk `config.yml` entirely, so BoostedYAML treats the file as version-less/older and merges unconditionally.
4. Restart the server (no other code change needed — the merge-on-load path runs on every load per `LoaderSettings.setAutoUpdate(true)`, but only actually merges when step 3's version mismatch is present).
5. Confirm the deleted `shop-directory.navigation.compass` key reappears with its shipped default, and the customized `results-per-page: 12` survives untouched.
6. Separately, bump the module's own shipped `config-version` and change one default value in the shipped `config.yml` resource (e.g. `results-per-page` default from 8 to 10); confirm the new default value reaches a fresh/updated install once `config-version` differs, and confirm (per the spec's new "Operational Note: Bumping `config-version`" section) that leaving `config-version` unchanged while changing defaults does **not** propagate the change — this is expected, not a defect, and documents why future releases that add/remove/change keys must bump `config-version` in the same commit.

- [ ] **Step 5: Record findings**

If Step 4 surfaces any issue (e.g. comments not preserved as expected, an unexpected key removal), fix it in the relevant task's file(s), re-run that task's automated tests, and commit the fix with a message describing the specific defect found during manual verification.
