# Cross-Module Config Auto-Update Design

## Problem

When a Zander module ships a new version that adds config keys (e.g. `zander-addon`'s recent `shop-directory` section), an admin's existing `config.yml` on a running server does not gain those keys automatically. `saveDefaultConfig()` only writes the shipped default when the file is entirely absent — it never merges into an existing file. Admins must manually diff and copy in new keys, or the new feature silently reads defaults it can't actually find (or, worse, an admin overwrites their whole file and loses customizations).

`zander-velocity` already solved this for itself using the [BoostedYAML](https://github.com/dejvokep/BoostedYAML) library: `YamlDocument.create(...)` with `LoaderSettings.setAutoUpdate(true)` and `UpdaterSettings.setVersioning(new BasicVersioning("config-version"))` merges new default keys into the on-disk file on startup, preserves every value the admin already set, preserves comments, and prunes keys no longer present in the shipped default.

## Goal

Bring the same mechanism to every other module with a `config.yml`: `zander-addon`, `zander-hub`, `zander-pgm`, and `zander-auth`. `zander-velocity` is already done and out of scope. `zander-hub`'s `welcome.yml` stays on plain Bukkit `YamlConfiguration` — it's content, not structured settings, and doesn't need merge/versioning semantics.

## Non-Goals

- No remote/central config sync between servers.
- No value-level validation or type-checking beyond what each module's config wrapper class already does.
- No change to `zander-velocity` (already has this).
- No change to `welcome.yml` or any other non-`config.yml` resource file.

## Design

### 1. Dependency & build wiring

Add BoostedYAML to `zander-addon/pom.xml`, `zander-hub/pom.xml`, `zander-pgm/pom.xml`, `zander-auth/pom.xml`, matching `zander-velocity/pom.xml`'s exact pattern: same dependency coordinate, `compile` scope (it's not provided by the server), shaded via `maven-shade-plugin`, and relocated to each module's own `dev.anchorlight.zander.<module>.libs` package to avoid classpath collisions between modules loaded in the same JVM (Bukkit) or across modules that might end up on the same classpath.

### 2. Per-module loading

Each module's main plugin class (`ZanderAddonMain`, `ZanderHubMain`, `ZanderPGMPlugin`, `ZanderAuthMain`) replaces its current `saveDefaultConfig()` / `getConfig()` bootstrapping with a `YamlDocument` constructed the same way `ZanderVelocityMain` already does:

```java
config = YamlDocument.create(new File(getDataFolder(), "config.yml"),
        getResource("config.yml"),
        GeneralSettings.DEFAULT,
        LoaderSettings.builder().setAutoUpdate(true).build(),
        DumperSettings.DEFAULT,
        UpdaterSettings.builder()
                .setVersioning(new BasicVersioning("config-version"))
                .setOptionSorting(UpdaterSettings.OptionSorting.SORT_BY_DEFAULTS)
                .build());
config.save();
```

Every shipped `config.yml` (including `zander-auth`'s, which currently has no version key at all) gains a `config-version: 1` key at the top. On every startup, BoostedYAML diffs the on-disk file against the shipped default and:
- inserts any key present in the default but missing on disk, with its default value and comment, in the position `SORT_BY_DEFAULTS` dictates,
- removes any key present on disk but no longer in the shipped default,
- leaves every other value exactly as the admin set it.

`zander-hub`'s `ConfigurationManager.setupWelcomeFile()` is untouched — `welcome.yml` keeps loading via plain `YamlConfiguration.loadConfiguration(file)` as it does today.

### 3. Call-site migration

BoostedYAML's `YamlDocument` does not implement Bukkit's `FileConfiguration`/`ConfigurationSection` interfaces, so every existing read call site must move from Bukkit's dotted-string API to BoostedYAML's `Route`-based API. This is the bulk of the implementation work. Concretely:

- `getConfig().getBoolean("a.b", default)` → `config.getBoolean(Route.from("a", "b"), default)`
- `getConfig().getString("x")` → `config.getString(Route.from("x"))`
- `getConfig().getStringList("x")` → `config.getStringList(Route.from("x"))`

Files known to need this migration (confirmed by survey; the implementation plan will do its own pass to catch any missed):

- **zander-addon**: inline `getConfig()` reads in `ZanderAddonMain` (e.g. `api-server.enabled`, `command-bridge.enabled`, `bridge.enabled`, `server-name`, `api-url`, `api-key`), plus `ShopDirectoryConfig.from(...)`, `PolicyConfig`, `SocialConfig`.
- **zander-hub**: `CompassConfig`, `HubLocationsConfig`, `MessagesConfig`, `MiscConfig` (all constructed/read through `ConfigurationManager`).
- **zander-pgm**: the existing config loader used by `ZanderPGMPlugin` (currently reads via a `YamlConfiguration`-based `ConfigLoader`, per its existing unit test).
- **zander-auth**: no config wrapper class exists today (raw `getConfig().getString(...)` calls scattered in `ZanderAuthMain`/event classes for `BaseAPIURL`, `APIKey`, `MOTDTopLine`); this design introduces a small typed config class here too, matching the pattern already used elsewhere (e.g. `ShopDirectoryConfig`), rather than leaving it as scattered raw reads.

### 4. Testing

`ShopDirectoryConfigTest` (zander-addon) and `ConfigLoaderTest` (zander-pgm) currently construct a Bukkit `YamlConfiguration` directly and assert on parsed values. Both get adapted to build a `YamlDocument` from an in-memory/temp-file source instead (BoostedYAML supports loading from any `InputStream`/`File` without a live server, so this stays a plain unit test, no MockBukkit needed) — same assertions, different construction. No new test framework required.

## Risks / Open Questions for the Implementation Plan

- Exact `Route.from(...)` call shape for deeply nested keys (e.g. `shop-directory.navigation.arrival-distance`) should be verified against BoostedYAML's actual API during implementation, not assumed from this design doc.
- `zander-hub`'s `ConfigurationManager` static-field-with-single-setup-call pattern needs to hold a `YamlDocument` reference instead of `FileConfiguration`; check whether any hub code reaches for `getConfig()` directly outside `ConfigurationManager` (a quick grep during implementation) so nothing is missed.
- Confirm `BasicVersioning("config-version")` behavior when the on-disk file predates this change entirely (no `config-version` key yet) — BoostedYAML should treat it as version 0 and update forward, but this should be verified rather than assumed, and is a good candidate for the plan's manual test pass.

## Operational Note: Bumping `config-version`

Verified against BoostedYAML's own source (`VersionedOperations.run(...)`): `LoaderSettings.setAutoUpdate(true)` guarantees `update()` runs on every load, but it does not make the key-merge unconditional. `VersionedOperations.run` compares the on-disk `config-version` against the shipped default's `config-version`, and if the two are equal it skips `Merger.merge` entirely — no keys are added, removed, or reconciled that load. This applies uniformly across all five modules that now use this pattern: `zander-velocity` (pre-existing) and the four newly-migrated modules (`zander-addon`, `zander-hub`, `zander-pgm`, `zander-auth`). Consequently, any future release that adds or removes a key in a given module's `config.yml` must increment that module's `config-version` value in the shipped resource file as part of the same commit — otherwise existing installs whose on-disk `config-version` already matches the previous shipped value will never receive the new/removed key, since BoostedYAML will treat the file as already up to date and silently skip the merge.
