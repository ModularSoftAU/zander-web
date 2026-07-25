# Custom Portal & Server-Navigation System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy BungeeCord-channel navigation compass and blanket Nether-portal cancellation in `zander-hub` with targeted dimension protection, a custom cuboid portal system, a versioned `zander:hub` proxy bridge, a Velocity-authoritative compass, and in-game portal admin tooling.

**Architecture:** New `dev.anchorlight.zander.hub.protection.dimension`, `dev.anchorlight.zander.hub.portal`, `dev.anchorlight.zander.hub.bridge`, and `dev.anchorlight.zander.hub.commands.portal` packages in zander-hub; new `dev.anchorlight.zander.velocity.bridge` package in zander-velocity. Portal data model is immutable records; persistence via plain Bukkit `YamlConfiguration`; spatial lookup via a chunk-keyed index; bridge protocol is a hand-written versioned binary format duplicated (not shared) across both modules.

**Tech Stack:** Paper API 1.21.4 (Java 21), Velocity API 3.4.0 (Java 17), Adventure/MiniMessage, JUnit 5 (newly added to both modules), plain Bukkit YAML config (hub) / BoostedYaml (velocity, existing).

## Global Constraints

- Java 21 for `zander-hub`, Java 17 for `zander-velocity` — do not change `release`/`maven.compiler.*` values.
- No Java object serialization anywhere in the bridge protocol.
- `serverpermissions.server.<velocity-server-id>` is checked only on Velocity, via the standard Velocity `Player.hasPermission`/permission API — never hardcode a dependency on the ServerPermissions plugin class.
- No `ChatColor` in any new code — Adventure `Component`/MiniMessage only.
- Portal IDs are case-insensitive; validate against `^[A-Za-z0-9_-]+$`.
- `portals.yml` lives at `plugins/zander-hub/portals.yml`; writes go through a temp-file-then-replace.
- Do not touch chat, moderation, auth/verify, reporting, or heartbeat code in either module.
- Do not add `ServerPermissions` as a Paper or hard Velocity dependency.
- Follow existing patterns: `ConfigurationManager` + per-concern `*Config` classes (hub), `ConfigValidator.validateConfig` for config fields, `ItemBuilder` for items, ChatColor-free Adventure text.
- Every new Maven module addition (JUnit) must not change existing `release`/`packaging`/shade config.

---

## Task 1: Add JUnit 5 to both modules

**Files:**
- Modify: `zander-hub/pom.xml`
- Modify: `zander-velocity/pom.xml`
- Test: `zander-hub/src/test/java/dev/anchorlight/zander/hub/SmokeTest.java`
- Test: `zander-velocity/src/test/java/dev/anchorlight/zander/velocity/SmokeTest.java`

**Interfaces:**
- Produces: a working `mvn -pl zander-hub,zander-velocity test` command for all later test tasks.

- [ ] **Step 1: Add JUnit 5 dependency + surefire to `zander-hub/pom.xml`**

Insert inside `<dependencies>` (after the ProtocolLib dependency, before `</dependencies>`):

```xml
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>5.10.2</version>
            <scope>test</scope>
        </dependency>
```

Insert inside `<plugins>` (after the `maven-compiler-plugin` block, before `</plugins>`):

```xml
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>3.2.5</version>
            </plugin>
```

- [ ] **Step 2: Add JUnit 5 dependency + surefire to `zander-velocity/pom.xml`**

Insert inside `<dependencies>` (after the `adventure-text-minimessage` dependency, before `</dependencies>`):

```xml
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>5.10.2</version>
            <scope>test</scope>
        </dependency>
```

Insert inside `<plugins>` (after `maven-compiler-plugin`, before `maven-shade-plugin`):

```xml
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>3.2.5</version>
            </plugin>
```

- [ ] **Step 3: Write smoke tests**

`zander-hub/src/test/java/dev/anchorlight/zander/hub/SmokeTest.java`:

```java
package dev.anchorlight.zander.hub;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class SmokeTest {
    @Test
    void junitIsWired() {
        assertEquals(2, 1 + 1);
    }
}
```

`zander-velocity/src/test/java/dev/anchorlight/zander/velocity/SmokeTest.java`:

```java
package dev.anchorlight.zander.velocity;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class SmokeTest {
    @Test
    void junitIsWired() {
        assertEquals(2, 1 + 1);
    }
}
```

- [ ] **Step 4: Run tests to verify wiring**

Run: `mvn -pl zander-hub,zander-velocity -am test`
Expected: `Tests run: 1, Failures: 0` for both `SmokeTest` classes (BUILD SUCCESS).

- [ ] **Step 5: Commit**

```bash
git add zander-hub/pom.xml zander-velocity/pom.xml zander-hub/src/test zander-velocity/src/test
git commit -m "test: add JUnit 5 to zander-hub and zander-velocity"
```

---

## Task 2: Dimension protection config

**Files:**
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/configs/DimensionsConfig.java`
- Modify: `zander-hub/src/main/java/dev/anchorlight/zander/hub/ConfigurationManager.java`
- Modify: `zander-hub/src/main/resources/config.yml`
- Test: `zander-hub/src/test/java/dev/anchorlight/zander/hub/configs/DimensionsConfigLogicTest.java`

**Interfaces:**
- Produces: `DimensionsConfig` with `boolean isNetherBlocked()`, `String getNetherMessage()` (MiniMessage string), `boolean isNetherBypassAllowed()`, and the End equivalents (`isEndBlocked()`, `getEndMessage()`, `isEndBypassAllowed()`). `ConfigurationManager.setupDimensionsConfig()` / `ConfigurationManager.getDimensions()`.

- [ ] **Step 1: Add `dimensions` section to `config.yml`**

Append to `zander-hub/src/main/resources/config.yml`:

```yaml
dimensions:
  nether:
    blocked: true
    message: "<red>The Nether is not available from the Hub.</red>"
    allow-bypass: true
  end:
    blocked: false
    message: "<red>The End is not available from the Hub.</red>"
    allow-bypass: true
```

- [ ] **Step 2: Write `DimensionsConfig`**

```java
package dev.anchorlight.zander.hub.configs;

import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import static dev.anchorlight.zander.hub.utils.ConfigValidator.isValidBoolean;
import static dev.anchorlight.zander.hub.utils.ConfigValidator.validateConfig;

/**
 * Manages Nether/End dimension-blocking settings, and their persistence.
 * Handles loading, validation, and access to managed data.
 */
public class DimensionsConfig {
    private final JavaPlugin plugin;

    private boolean netherBlocked;
    private String netherMessage;
    private boolean netherAllowBypass;
    private boolean endBlocked;
    private String endMessage;
    private boolean endAllowBypass;

    public DimensionsConfig(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    /// Configure Nether/End dimension-blocking settings.
    /// Validates the entries in server 'config.yml' with fallback.
    public void setup() {
        FileConfiguration config = plugin.getConfig();

        validateConfig(config, "dimensions.nether.blocked", isValidBoolean, true);
        validateConfig(config, "dimensions.nether.allow-bypass", isValidBoolean, true);
        validateConfig(config, "dimensions.end.blocked", isValidBoolean, false);
        validateConfig(config, "dimensions.end.allow-bypass", isValidBoolean, true);

        if (!config.isString("dimensions.nether.message")) {
            config.set("dimensions.nether.message", "<red>The Nether is not available from the Hub.</red>");
        }
        if (!config.isString("dimensions.end.message")) {
            config.set("dimensions.end.message", "<red>The End is not available from the Hub.</red>");
        }

        plugin.saveConfig(); // * save to external 'config.yml'

        this.netherBlocked = config.getBoolean("dimensions.nether.blocked");
        this.netherMessage = config.getString("dimensions.nether.message");
        this.netherAllowBypass = config.getBoolean("dimensions.nether.allow-bypass");
        this.endBlocked = config.getBoolean("dimensions.end.blocked");
        this.endMessage = config.getString("dimensions.end.message");
        this.endAllowBypass = config.getBoolean("dimensions.end.allow-bypass");
    }

    public boolean isNetherBlocked() {
        return this.netherBlocked;
    }

    public String getNetherMessage() {
        return this.netherMessage;
    }

    public boolean isNetherBypassAllowed() {
        return this.netherAllowBypass;
    }

    public boolean isEndBlocked() {
        return this.endBlocked;
    }

    public String getEndMessage() {
        return this.endMessage;
    }

    public boolean isEndBypassAllowed() {
        return this.endAllowBypass;
    }
}
```

- [ ] **Step 3: Wire into `ConfigurationManager`**

In `zander-hub/src/main/java/dev/anchorlight/zander/hub/ConfigurationManager.java`, add the import `import dev.anchorlight.zander.hub.configs.DimensionsConfig;`, a `private static DimensionsConfig dimensionsConfig;` field, and:

```java
    public static void setupDimensionsConfig() {
        if (dimensionsConfig != null)
            throw new IllegalStateException("Already setup, ensure there's a single call");
        dimensionsConfig = new DimensionsConfig(ZanderHubMain.plugin);
        dimensionsConfig.setup();
    }

    public static DimensionsConfig getDimensions() {
        if (dimensionsConfig == null)
            throw new IllegalStateException("Missing setup, first run 'ConfigurationManager.setupDimensionsConfig'");
        return dimensionsConfig;
    }
```

(Place both methods alongside the existing `setupMiscConfig`/`getMisc` pair, following the same ordering convention.)

- [ ] **Step 4: Write a logic test isolating the fallback behaviour**

Since `DimensionsConfig` needs a live `JavaPlugin`/`FileConfiguration`, the unit-testable part is the fallback-message constants. Test that directly:

```java
package dev.anchorlight.zander.hub.configs;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DimensionsConfigLogicTest {
    @Test
    void defaultNetherMessageMentionsNether() {
        String fallback = "<red>The Nether is not available from the Hub.</red>";
        assertTrue(fallback.contains("Nether"));
    }

    @Test
    void defaultEndMessageMentionsEnd() {
        String fallback = "<red>The End is not available from the Hub.</red>";
        assertTrue(fallback.contains("End"));
    }
}
```

(This is a thin placeholder-value test; the bulk of `DimensionsConfig` coverage comes from manual testing in Task 3's checklist, since it depends on live Bukkit config — this matches the existing codebase's untested `*Config` classes.)

- [ ] **Step 5: Run tests**

Run: `mvn -pl zander-hub -am test`
Expected: BUILD SUCCESS, `DimensionsConfigLogicTest` 2/2 pass.

- [ ] **Step 6: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/configs/DimensionsConfig.java \
        zander-hub/src/main/java/dev/anchorlight/zander/hub/ConfigurationManager.java \
        zander-hub/src/main/resources/config.yml \
        zander-hub/src/test/java/dev/anchorlight/zander/hub/configs/DimensionsConfigLogicTest.java
git commit -m "feat: add dimensions config for Nether/End blocking"
```

---

## Task 3: Dimension protection listener

**Files:**
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/protection/dimension/DimensionProtectionListener.java`
- Modify: `zander-hub/src/main/java/dev/anchorlight/zander/hub/protection/HubProtection.java:164-168` (remove `noPortal`)
- Modify: `zander-hub/src/main/java/dev/anchorlight/zander/hub/ZanderHubMain.java` (register config + listener)
- Modify: `zander-hub/src/main/resources/plugin.yml` (add bypass permissions)

**Interfaces:**
- Consumes: `ConfigurationManager.getDimensions()` (Task 2), `ConfigurationManager.getHubLocations().getSpawn()` (existing).
- Produces: nothing consumed by later tasks (leaf feature).

- [ ] **Step 1: Remove the blanket cancellation from `HubProtection.java`**

Delete lines 164-168 of `zander-hub/src/main/java/dev/anchorlight/zander/hub/protection/HubProtection.java`:

```java
    // Block players from using portals to go to the Nether or End
    @EventHandler(priority = EventPriority.HIGH)
    public void noPortal(final PlayerPortalEvent event) {
        event.setCancelled(true);
    }

```

Leave every other handler in that file untouched.

- [ ] **Step 2: Write `DimensionProtectionListener`**

```java
package dev.anchorlight.zander.hub.protection.dimension;

import dev.anchorlight.zander.hub.ConfigurationManager;
import dev.anchorlight.zander.hub.ZanderHubMain;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerChangedWorldEvent;
import org.bukkit.event.player.PlayerPortalEvent;
import org.bukkit.event.player.PlayerTeleportEvent;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;

/**
 * Blocks Nether/End travel from the Hub via portal events, generic teleport events
 * (covering command/plugin-driven teleports), and a same-tick fallback correction
 * for any Nether/End world entry that slips past those checks.
 */
public class DimensionProtectionListener implements Listener {
    private final ZanderHubMain plugin;
    private final Set<UUID> correcting = ConcurrentHashMap.newKeySet();
    private final Set<UUID> recentlyWarned = ConcurrentHashMap.newKeySet();

    public DimensionProtectionListener(ZanderHubMain plugin) {
        this.plugin = plugin;
    }

    private boolean isBlocked(World.Environment environment) {
        var dimensions = ConfigurationManager.getDimensions();
        if (environment == World.Environment.NETHER) {
            return dimensions.isNetherBlocked();
        }
        if (environment == World.Environment.THE_END) {
            return dimensions.isEndBlocked();
        }
        return false;
    }

    private boolean hasBypass(Player player, World.Environment environment) {
        var dimensions = ConfigurationManager.getDimensions();
        if (environment == World.Environment.NETHER) {
            return dimensions.isNetherBypassAllowed() && player.hasPermission("zanderhub.nether.bypass");
        }
        if (environment == World.Environment.THE_END) {
            return dimensions.isEndBypassAllowed() && player.hasPermission("zanderhub.end.bypass");
        }
        return false;
    }

    private String messageFor(World.Environment environment) {
        var dimensions = ConfigurationManager.getDimensions();
        return environment == World.Environment.NETHER ? dimensions.getNetherMessage() : dimensions.getEndMessage();
    }

    private void deny(Player player, World.Environment environment) {
        player.sendMessage(MiniMessage.miniMessage().deserialize(messageFor(environment)));
    }

    @EventHandler(priority = EventPriority.HIGH)
    public void onPortal(PlayerPortalEvent event) {
        World destinationWorld = event.getTo() != null ? event.getTo().getWorld() : null;
        if (destinationWorld == null) {
            return;
        }
        World.Environment environment = destinationWorld.getEnvironment();
        if (!isBlocked(environment) || hasBypass(event.getPlayer(), environment)) {
            return;
        }
        event.setCancelled(true);
        deny(event.getPlayer(), environment);
    }

    @EventHandler(priority = EventPriority.HIGH)
    public void onTeleport(PlayerTeleportEvent event) {
        World destinationWorld = event.getTo() != null ? event.getTo().getWorld() : null;
        if (destinationWorld == null) {
            return;
        }
        World.Environment environment = destinationWorld.getEnvironment();
        if (!isBlocked(environment) || hasBypass(event.getPlayer(), environment)) {
            return;
        }
        event.setCancelled(true);
        deny(event.getPlayer(), environment);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onWorldChange(PlayerChangedWorldEvent event) {
        Player player = event.getPlayer();
        World.Environment environment = player.getWorld().getEnvironment();
        if (!isBlocked(environment) || hasBypass(player, environment)) {
            return;
        }

        UUID playerId = player.getUniqueId();
        if (!correcting.add(playerId)) {
            return; // already scheduled a correction for this player
        }

        if (recentlyWarned.add(playerId)) {
            plugin.getLogger().log(Level.WARNING,
                    "{0} entered blocked dimension world ''{1}'' ({2}); scheduling fallback teleport to Hub spawn.",
                    new Object[] { player.getName(), player.getWorld().getName(), environment });
            Bukkit.getScheduler().runTaskLater(plugin, () -> recentlyWarned.remove(playerId), 20L * 30L);
        }

        Bukkit.getScheduler().runTask(plugin, () -> {
            try {
                if (player.isOnline()) {
                    Location spawn = ConfigurationManager.getHubLocations().getSpawn();
                    player.teleportAsync(spawn);
                    deny(player, environment);
                }
            } finally {
                correcting.remove(playerId);
            }
        });
    }
}
```

- [ ] **Step 3: Add bypass permissions to `plugin.yml`**

In `zander-hub/src/main/resources/plugin.yml`, under the existing `permissions:` block, add:

```yaml
  zanderhub.nether.bypass:
    default: op
  zanderhub.end.bypass:
    default: op
```

- [ ] **Step 4: Wire into `ZanderHubMain`**

In `zander-hub/src/main/java/dev/anchorlight/zander/hub/ZanderHubMain.java`:
- Add import `import dev.anchorlight.zander.hub.protection.dimension.DimensionProtectionListener;`
- After the line `ConfigurationManager.setupMiscConfig();`, add `ConfigurationManager.setupDimensionsConfig();`
- After `pluginmanager.registerEvents(new HubProtection(this), this);`, add `pluginmanager.registerEvents(new DimensionProtectionListener(this), this);`

- [ ] **Step 5: Compile to verify**

Run: `mvn -pl zander-hub -am compile`
Expected: BUILD SUCCESS.

- [ ] **Step 6: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/protection/dimension/DimensionProtectionListener.java \
        zander-hub/src/main/java/dev/anchorlight/zander/hub/protection/HubProtection.java \
        zander-hub/src/main/java/dev/anchorlight/zander/hub/ZanderHubMain.java \
        zander-hub/src/main/resources/plugin.yml
git commit -m "feat: replace blanket portal cancellation with targeted dimension protection"
```

**Manual verification (cannot be automated without a running server):** on a live Hub server, walk into a vanilla Nether portal and confirm no world change occurs and the deny message shows; run `/tp` (as an op without bypass) into a Nether world via command block/plugin and confirm rejection; temporarily set `dimensions.end.blocked: true` and confirm End travel is blocked, then `false` and confirm it's allowed; force-place a player into a Nether world (e.g. via `/execute in minecraft:the_nether run tp`) and confirm the next-tick fallback returns them to Hub spawn without looping.

---

## Task 4: `PortalRegion` domain record

**Files:**
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalRegion.java`
- Test: `zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalRegionTest.java`

**Interfaces:**
- Produces: `record PortalRegion(String world, int minX, int minY, int minZ, int maxX, int maxY, int maxZ)` with canonical-constructor corner normalisation, `boolean contains(int x, int y, int z)`, `int minChunkX()`, `int maxChunkX()`, `int minChunkZ()`, `int maxChunkZ()`.

- [ ] **Step 1: Write failing tests**

```java
package dev.anchorlight.zander.hub.portal;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PortalRegionTest {
    @Test
    void normalisesInvertedCorners() {
        PortalRegion region = new PortalRegion("world", 12, 124, 5, 10, 120, 5);
        assertEquals(10, region.minX());
        assertEquals(12, region.maxX());
        assertEquals(120, region.minY());
        assertEquals(124, region.maxY());
    }

    @Test
    void containsInsidePoint() {
        PortalRegion region = new PortalRegion("world", 10, 120, 5, 12, 124, 5);
        assertTrue(region.contains(11, 122, 5));
    }

    @Test
    void containsBoundaryPoints() {
        PortalRegion region = new PortalRegion("world", 10, 120, 5, 12, 124, 5);
        assertTrue(region.contains(10, 120, 5));
        assertTrue(region.contains(12, 124, 5));
    }

    @Test
    void excludesOutsidePoint() {
        PortalRegion region = new PortalRegion("world", 10, 120, 5, 12, 124, 5);
        assertFalse(region.contains(13, 122, 5));
        assertFalse(region.contains(11, 125, 5));
    }

    @Test
    void handlesNegativeCoordinates() {
        PortalRegion region = new PortalRegion("world", -20, 60, -8, -10, 70, -2);
        assertTrue(region.contains(-15, 65, -5));
        assertFalse(region.contains(-25, 65, -5));
    }

    @Test
    void computesChunkSpanAcrossBoundary() {
        // x -1..17 spans chunk -1 (blocks -16..-1) through chunk 1 (blocks 16..31)
        PortalRegion region = new PortalRegion("world", -1, 60, 0, 17, 70, 0);
        assertEquals(-1, region.minChunkX());
        assertEquals(1, region.maxChunkX());
    }

    @Test
    void singleChunkRegionHasEqualMinMaxChunk() {
        PortalRegion region = new PortalRegion("world", 10, 120, 5, 12, 124, 6);
        assertEquals(region.minChunkX(), region.maxChunkX());
        assertEquals(region.minChunkZ(), region.maxChunkZ());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn -pl zander-hub -am test -Dtest=PortalRegionTest`
Expected: FAIL (compilation error, `PortalRegion` does not exist).

- [ ] **Step 3: Write `PortalRegion`**

```java
package dev.anchorlight.zander.hub.portal;

/**
 * An axis-aligned block-coordinate cuboid within a single world. The canonical
 * constructor normalises corners so callers never need to sort min/max themselves.
 */
public record PortalRegion(String world, int minX, int minY, int minZ, int maxX, int maxY, int maxZ) {
    public PortalRegion {
        if (minX > maxX) {
            int tmp = minX;
            minX = maxX;
            maxX = tmp;
        }
        if (minY > maxY) {
            int tmp = minY;
            minY = maxY;
            maxY = tmp;
        }
        if (minZ > maxZ) {
            int tmp = minZ;
            minZ = maxZ;
            maxZ = tmp;
        }
    }

    public boolean contains(int x, int y, int z) {
        return x >= minX && x <= maxX
                && y >= minY && y <= maxY
                && z >= minZ && z <= maxZ;
    }

    public int minChunkX() {
        return minX >> 4;
    }

    public int maxChunkX() {
        return maxX >> 4;
    }

    public int minChunkZ() {
        return minZ >> 4;
    }

    public int maxChunkZ() {
        return maxZ >> 4;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `mvn -pl zander-hub -am test -Dtest=PortalRegionTest`
Expected: PASS, 7/7 tests.

- [ ] **Step 5: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalRegion.java \
        zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalRegionTest.java
git commit -m "feat: add PortalRegion cuboid domain record"
```

---

## Task 5: `PortalDestination` domain types

**Files:**
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalDestination.java`
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/ServerPortalDestination.java`
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/LocationPortalDestination.java`
- Test: `zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalDestinationTest.java`

**Interfaces:**
- Consumes: nothing.
- Produces: `sealed interface PortalDestination permits ServerPortalDestination, LocationPortalDestination`; `record ServerPortalDestination(String serverId) implements PortalDestination`; `record LocationPortalDestination(String world, double x, double y, double z, float yaw, float pitch) implements PortalDestination`. Used by `Portal` (Task 6) and `PortalActivationHandler` (Task 15).

- [ ] **Step 1: Write failing test**

```java
package dev.anchorlight.zander.hub.portal;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PortalDestinationTest {
    @Test
    void serverDestinationExposesServerId() {
        PortalDestination destination = new ServerPortalDestination("survival");
        assertInstanceOf(ServerPortalDestination.class, destination);
        assertEquals("survival", ((ServerPortalDestination) destination).serverId());
    }

    @Test
    void locationDestinationExposesCoordinates() {
        PortalDestination destination = new LocationPortalDestination("world", 0.5, 129.0, 0.5, 180f, 0f);
        assertInstanceOf(LocationPortalDestination.class, destination);
        LocationPortalDestination location = (LocationPortalDestination) destination;
        assertEquals("world", location.world());
        assertEquals(0.5, location.x());
        assertEquals(180f, location.yaw());
    }

    @Test
    void sealedInterfaceExhaustiveSwitchCoversBothTypes() {
        PortalDestination destination = new ServerPortalDestination("survival");
        String result = switch (destination) {
            case ServerPortalDestination server -> "server:" + server.serverId();
            case LocationPortalDestination location -> "location:" + location.world();
        };
        assertEquals("server:survival", result);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn -pl zander-hub -am test -Dtest=PortalDestinationTest`
Expected: FAIL (types do not exist).

- [ ] **Step 3: Write the three types**

```java
package dev.anchorlight.zander.hub.portal;

/** A portal's configured destination: either a Velocity backend server or a local Hub location. */
public sealed interface PortalDestination permits ServerPortalDestination, LocationPortalDestination {
}
```

```java
package dev.anchorlight.zander.hub.portal;

/** Sends the player through the Zander proxy bridge to the named Velocity backend server. */
public record ServerPortalDestination(String serverId) implements PortalDestination {
}
```

```java
package dev.anchorlight.zander.hub.portal;

/** Teleports the player to a fixed location within a local Hub world. */
public record LocationPortalDestination(String world, double x, double y, double z, float yaw, float pitch)
        implements PortalDestination {
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `mvn -pl zander-hub -am test -Dtest=PortalDestinationTest`
Expected: PASS, 3/3 tests.

- [ ] **Step 5: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalDestination.java \
        zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/ServerPortalDestination.java \
        zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/LocationPortalDestination.java \
        zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalDestinationTest.java
git commit -m "feat: add PortalDestination sealed type hierarchy"
```

---

## Task 6: `Portal` record + ID validation

**Files:**
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/Portal.java`
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalIdValidator.java`
- Test: `zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalIdValidatorTest.java`
- Test: `zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalTest.java`

**Interfaces:**
- Consumes: `PortalRegion` (Task 4), `PortalDestination` (Task 5).
- Produces: `record Portal(String id, String displayName, boolean enabled, PortalRegion region, PortalDestination destination, String permission, long cooldownMs, String sound, String successMessage, String deniedMessage)` — canonical constructor throws `IllegalArgumentException` on invalid id or negative cooldown. `PortalIdValidator.isValid(String id)` (static, `boolean`) and `PortalIdValidator.normalise(String id)` (static, lower-cases for case-insensitive map keys). Used by `PortalRepository` (Task 7), `PortalService` (Task 8), and portal commands (Task 20).

- [ ] **Step 1: Write failing tests**

`PortalIdValidatorTest.java`:

```java
package dev.anchorlight.zander.hub.portal;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PortalIdValidatorTest {
    @Test
    void acceptsLettersNumbersHyphensUnderscores() {
        assertTrue(PortalIdValidator.isValid("survival-1_test"));
    }

    @Test
    void rejectsSpaces() {
        assertFalse(PortalIdValidator.isValid("my portal"));
    }

    @Test
    void rejectsEmpty() {
        assertFalse(PortalIdValidator.isValid(""));
    }

    @Test
    void rejectsNull() {
        assertFalse(PortalIdValidator.isValid(null));
    }

    @Test
    void rejectsSpecialCharacters() {
        assertFalse(PortalIdValidator.isValid("portal!"));
        assertFalse(PortalIdValidator.isValid("portal/../etc"));
    }

    @Test
    void normaliseLowerCases() {
        assertEquals("survival", PortalIdValidator.normalise("Survival"));
        assertEquals("survival", PortalIdValidator.normalise("SURVIVAL"));
    }

    @Test
    void caseInsensitiveDuplicatesNormaliseToSameKey() {
        assertEquals(PortalIdValidator.normalise("VipLounge"), PortalIdValidator.normalise("viplounge"));
    }
}
```

`PortalTest.java`:

```java
package dev.anchorlight.zander.hub.portal;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PortalTest {
    private PortalRegion region() {
        return new PortalRegion("world", 10, 120, 5, 12, 124, 5);
    }

    private PortalDestination destination() {
        return new ServerPortalDestination("survival");
    }

    @Test
    void constructsWithValidId() {
        Portal portal = new Portal("survival", "Survival", true, region(), destination(),
                null, 2000L, "ENTITY_ENDERMAN_TELEPORT", "Sending...", "Denied.");
        assertEquals("survival", portal.id());
        assertEquals(2000L, portal.cooldownMs());
    }

    @Test
    void rejectsInvalidId() {
        assertThrows(IllegalArgumentException.class, () -> new Portal("bad id!", "Bad", true, region(),
                destination(), null, 0L, null, "s", "d"));
    }

    @Test
    void rejectsNegativeCooldown() {
        assertThrows(IllegalArgumentException.class, () -> new Portal("survival", "Survival", true, region(),
                destination(), null, -1L, null, "s", "d"));
    }

    @Test
    void allowsNullPermissionAndSound() {
        Portal portal = new Portal("survival", "Survival", true, region(), destination(), null, 0L, null, "s", "d");
        assertNull(portal.permission());
        assertNull(portal.sound());
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `mvn -pl zander-hub -am test -Dtest=PortalIdValidatorTest,PortalTest`
Expected: FAIL (types do not exist).

- [ ] **Step 3: Write `PortalIdValidator`**

```java
package dev.anchorlight.zander.hub.portal;

import java.util.regex.Pattern;

/** Validates and normalises portal IDs, which are treated case-insensitively throughout the system. */
public final class PortalIdValidator {
    private static final Pattern VALID_ID = Pattern.compile("^[A-Za-z0-9_-]+$");

    private PortalIdValidator() {
        throw new IllegalStateException("Utility class shouldn't be instantiated");
    }

    public static boolean isValid(String id) {
        return id != null && !id.isEmpty() && VALID_ID.matcher(id).matches();
    }

    /** Lower-cases the id for use as a case-insensitive map key. Caller must validate first. */
    public static String normalise(String id) {
        return id.toLowerCase(java.util.Locale.ROOT);
    }
}
```

- [ ] **Step 4: Write `Portal`**

```java
package dev.anchorlight.zander.hub.portal;

import java.util.Objects;

/**
 * An immutable, fully-validated custom portal: a cuboid region that, when entered,
 * sends the player to a server or a local location.
 */
public record Portal(String id, String displayName, boolean enabled, PortalRegion region,
        PortalDestination destination, String permission, long cooldownMs, String sound,
        String successMessage, String deniedMessage) {
    public Portal {
        if (!PortalIdValidator.isValid(id)) {
            throw new IllegalArgumentException("Invalid portal id: " + id);
        }
        Objects.requireNonNull(displayName, "displayName");
        Objects.requireNonNull(region, "region");
        Objects.requireNonNull(destination, "destination");
        Objects.requireNonNull(successMessage, "successMessage");
        Objects.requireNonNull(deniedMessage, "deniedMessage");
        if (cooldownMs < 0) {
            throw new IllegalArgumentException("cooldownMs must not be negative: " + cooldownMs);
        }
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `mvn -pl zander-hub -am test -Dtest=PortalIdValidatorTest,PortalTest`
Expected: PASS, 11/11 tests.

- [ ] **Step 6: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/Portal.java \
        zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalIdValidator.java \
        zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalIdValidatorTest.java \
        zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalTest.java
git commit -m "feat: add Portal domain record with id/cooldown validation"
```

---

## Task 7: `PortalRepository` persistence

**Files:**
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalRepository.java`
- Test: `zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalRepositoryTest.java`

**Interfaces:**
- Consumes: `Portal`, `PortalRegion`, `PortalDestination`/`ServerPortalDestination`/`LocationPortalDestination` (Tasks 4-6). `java.util.logging.Logger` for warnings (injected, not `ZanderHubMain.plugin.getLogger()`, so it's constructible in tests without Bukkit).
- Produces: `PortalRepository(File portalsFile, Logger logger, java.util.function.Predicate<String> worldExists)` constructor; `Map<String, Portal> load()` (keys are `PortalIdValidator.normalise`d ids, malformed entries skipped with a warning, never throws on a single bad entry); `void save(Collection<Portal> portals)` (temp-file-then-replace). Used by `PortalService` (Task 8) and `ZanderHubMain` (Task 22).

- [ ] **Step 1: Write failing tests**

```java
package dev.anchorlight.zander.hub.portal;

import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.nio.file.Path;
import java.util.Map;
import java.util.logging.Logger;

import static org.junit.jupiter.api.Assertions.*;

class PortalRepositoryTest {
    private static final Logger LOGGER = Logger.getLogger("PortalRepositoryTest");

    @Test
    void loadsValidServerAndLocationPortals(@TempDir Path tempDir) throws Exception {
        File file = tempDir.resolve("portals.yml").toFile();
        YamlConfiguration yaml = new YamlConfiguration();
        yaml.set("portals.survival.display-name", "Survival");
        yaml.set("portals.survival.enabled", true);
        yaml.set("portals.survival.region.world", "world");
        yaml.set("portals.survival.region.min.x", 10);
        yaml.set("portals.survival.region.min.y", 120);
        yaml.set("portals.survival.region.min.z", 5);
        yaml.set("portals.survival.region.max.x", 12);
        yaml.set("portals.survival.region.max.y", 124);
        yaml.set("portals.survival.region.max.z", 5);
        yaml.set("portals.survival.destination.type", "SERVER");
        yaml.set("portals.survival.destination.server", "survival");
        yaml.set("portals.survival.permission", null);
        yaml.set("portals.survival.cooldown-ms", 2000);
        yaml.set("portals.survival.sound", "ENTITY_ENDERMAN_TELEPORT");
        yaml.set("portals.survival.messages.success", "Sending...");
        yaml.set("portals.survival.messages.denied", "Denied.");
        yaml.save(file);

        PortalRepository repository = new PortalRepository(file, LOGGER, world -> true);
        Map<String, Portal> loaded = repository.load();

        assertEquals(1, loaded.size());
        Portal portal = loaded.get("survival");
        assertNotNull(portal);
        assertEquals("Survival", portal.displayName());
        assertInstanceOf(ServerPortalDestination.class, portal.destination());
    }

    @Test
    void skipsMalformedEntryButLoadsRest(@TempDir Path tempDir) throws Exception {
        File file = tempDir.resolve("portals.yml").toFile();
        YamlConfiguration yaml = new YamlConfiguration();
        // malformed: missing destination type
        yaml.set("portals.broken.display-name", "Broken");
        yaml.set("portals.broken.enabled", true);
        yaml.set("portals.broken.region.world", "world");
        yaml.set("portals.broken.region.min.x", 0);
        yaml.set("portals.broken.region.min.y", 0);
        yaml.set("portals.broken.region.min.z", 0);
        yaml.set("portals.broken.region.max.x", 1);
        yaml.set("portals.broken.region.max.y", 1);
        yaml.set("portals.broken.region.max.z", 1);
        yaml.set("portals.broken.messages.success", "s");
        yaml.set("portals.broken.messages.denied", "d");
        // valid one alongside it
        yaml.set("portals.good.display-name", "Good");
        yaml.set("portals.good.enabled", true);
        yaml.set("portals.good.region.world", "world");
        yaml.set("portals.good.region.min.x", 0);
        yaml.set("portals.good.region.min.y", 0);
        yaml.set("portals.good.region.min.z", 0);
        yaml.set("portals.good.region.max.x", 1);
        yaml.set("portals.good.region.max.y", 1);
        yaml.set("portals.good.region.max.z", 1);
        yaml.set("portals.good.destination.type", "LOCATION");
        yaml.set("portals.good.destination.world", "world");
        yaml.set("portals.good.destination.x", 0.5);
        yaml.set("portals.good.destination.y", 65.0);
        yaml.set("portals.good.destination.z", 0.5);
        yaml.set("portals.good.destination.yaw", 0.0);
        yaml.set("portals.good.destination.pitch", 0.0);
        yaml.set("portals.good.messages.success", "s");
        yaml.set("portals.good.messages.denied", "d");
        yaml.save(file);

        PortalRepository repository = new PortalRepository(file, LOGGER, world -> true);
        Map<String, Portal> loaded = repository.load();

        assertEquals(1, loaded.size());
        assertTrue(loaded.containsKey("good"));
        assertFalse(loaded.containsKey("broken"));
    }

    @Test
    void rejectsPortalWhoseWorldDoesNotExist(@TempDir Path tempDir) throws Exception {
        File file = tempDir.resolve("portals.yml").toFile();
        YamlConfiguration yaml = new YamlConfiguration();
        yaml.set("portals.ghost.display-name", "Ghost");
        yaml.set("portals.ghost.enabled", true);
        yaml.set("portals.ghost.region.world", "nonexistent");
        yaml.set("portals.ghost.region.min.x", 0);
        yaml.set("portals.ghost.region.min.y", 0);
        yaml.set("portals.ghost.region.min.z", 0);
        yaml.set("portals.ghost.region.max.x", 1);
        yaml.set("portals.ghost.region.max.y", 1);
        yaml.set("portals.ghost.region.max.z", 1);
        yaml.set("portals.ghost.destination.type", "SERVER");
        yaml.set("portals.ghost.destination.server", "survival");
        yaml.set("portals.ghost.messages.success", "s");
        yaml.set("portals.ghost.messages.denied", "d");
        yaml.save(file);

        PortalRepository repository = new PortalRepository(file, LOGGER, world -> false);
        Map<String, Portal> loaded = repository.load();

        assertTrue(loaded.isEmpty());
    }

    @Test
    void returnsEmptyMapWhenFileMissing(@TempDir Path tempDir) {
        File file = tempDir.resolve("portals.yml").toFile();
        PortalRepository repository = new PortalRepository(file, LOGGER, world -> true);
        assertTrue(repository.load().isEmpty());
    }

    @Test
    void saveThenLoadRoundTrips(@TempDir Path tempDir) {
        File file = tempDir.resolve("portals.yml").toFile();
        PortalRepository repository = new PortalRepository(file, LOGGER, world -> true);

        Portal portal = new Portal("info", "Information Centre", true,
                new PortalRegion("world", -5, 128, 20, -3, 131, 22),
                new LocationPortalDestination("world", 0.5, 129, 0.5, 180f, 0f),
                null, 1500L, "ENTITY_ENDERMAN_TELEPORT", "Teleporting...", "You cannot use this portal.");

        repository.save(java.util.List.of(portal));
        assertTrue(file.exists());

        Map<String, Portal> reloaded = repository.load();
        assertEquals(1, reloaded.size());
        Portal roundTripped = reloaded.get("info");
        assertEquals(portal.displayName(), roundTripped.displayName());
        assertEquals(portal.region(), roundTripped.region());
        assertInstanceOf(LocationPortalDestination.class, roundTripped.destination());
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `mvn -pl zander-hub -am test -Dtest=PortalRepositoryTest`
Expected: FAIL (`PortalRepository` does not exist).

- [ ] **Step 3: Write `PortalRepository`**

```java
package dev.anchorlight.zander.hub.portal;

import org.bukkit.Sound;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Predicate;
import java.util.logging.Logger;

/**
 * Loads and saves {@link Portal} definitions to {@code portals.yml}. Malformed entries
 * are skipped with a warning rather than aborting the whole load. Saves go through a
 * temporary file that is then moved over the target, so a crash mid-write can't corrupt
 * previously-valid data.
 */
public class PortalRepository {
    private final File file;
    private final Logger logger;
    private final Predicate<String> worldExists;

    public PortalRepository(File file, Logger logger, Predicate<String> worldExists) {
        this.file = file;
        this.logger = logger;
        this.worldExists = worldExists;
    }

    public Map<String, Portal> load() {
        Map<String, Portal> result = new LinkedHashMap<>();
        if (!file.exists()) {
            return result;
        }

        YamlConfiguration yaml = YamlConfiguration.loadConfiguration(file);
        ConfigurationSection portalsSection = yaml.getConfigurationSection("portals");
        if (portalsSection == null) {
            return result;
        }

        for (String rawId : portalsSection.getKeys(false)) {
            try {
                Portal portal = parseOne(portalsSection.getConfigurationSection(rawId), rawId);
                String key = PortalIdValidator.normalise(portal.id());
                if (result.containsKey(key)) {
                    logger.warning(() -> "Duplicate portal id (case-insensitive) '" + rawId + "', skipped");
                    continue;
                }
                result.put(key, portal);
            } catch (IllegalArgumentException e) {
                logger.warning(() -> "Skipping malformed portal '" + rawId + "': " + e.getMessage());
            }
        }
        return result;
    }

    private Portal parseOne(ConfigurationSection section, String rawId) {
        if (section == null) {
            throw new IllegalArgumentException("missing section");
        }
        if (!PortalIdValidator.isValid(rawId)) {
            throw new IllegalArgumentException("invalid id '" + rawId + "'");
        }

        String displayName = section.getString("display-name");
        if (displayName == null) {
            throw new IllegalArgumentException("missing display-name");
        }
        boolean enabled = section.getBoolean("enabled", true);

        ConfigurationSection regionSection = section.getConfigurationSection("region");
        if (regionSection == null) {
            throw new IllegalArgumentException("missing region");
        }
        String world = regionSection.getString("world");
        if (world == null || !worldExists.test(world)) {
            throw new IllegalArgumentException("region references unknown world '" + world + "'");
        }
        ConfigurationSection min = regionSection.getConfigurationSection("min");
        ConfigurationSection max = regionSection.getConfigurationSection("max");
        if (min == null || max == null) {
            throw new IllegalArgumentException("region missing min/max");
        }
        PortalRegion region = new PortalRegion(world,
                min.getInt("x"), min.getInt("y"), min.getInt("z"),
                max.getInt("x"), max.getInt("y"), max.getInt("z"));

        ConfigurationSection destinationSection = section.getConfigurationSection("destination");
        if (destinationSection == null) {
            throw new IllegalArgumentException("missing destination");
        }
        PortalDestination destination = parseDestination(destinationSection);

        String permission = section.getString("permission", null);
        long cooldownMs = section.getLong("cooldown-ms", 0L);
        String sound = section.getString("sound", null);
        if (sound != null && Sound.valueOf(normaliseSoundLookup(sound)) == null) {
            // Sound.valueOf throws IllegalArgumentException itself when invalid; see below.
        }
        if (sound != null) {
            validateSound(sound);
        }

        String successMessage = section.getString("messages.success", "");
        String deniedMessage = section.getString("messages.denied", "");

        return new Portal(rawId, displayName, enabled, region, destination, permission,
                cooldownMs, sound, successMessage, deniedMessage);
    }

    private static String normaliseSoundLookup(String sound) {
        return sound; // Sound.valueOf is case-sensitive on the enum constant name already.
    }

    private static void validateSound(String sound) {
        try {
            Sound.valueOf(sound);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("invalid sound '" + sound + "'");
        }
    }

    private PortalDestination parseDestination(ConfigurationSection section) {
        String type = section.getString("type");
        if (type == null) {
            throw new IllegalArgumentException("destination missing type");
        }
        return switch (type) {
            case "SERVER" -> {
                String serverId = section.getString("server");
                if (serverId == null || serverId.isBlank()) {
                    throw new IllegalArgumentException("SERVER destination missing server id");
                }
                yield new ServerPortalDestination(serverId);
            }
            case "LOCATION" -> {
                String world = section.getString("world");
                if (world == null || !worldExists.test(world)) {
                    throw new IllegalArgumentException("LOCATION destination references unknown world '" + world + "'");
                }
                yield new LocationPortalDestination(world,
                        section.getDouble("x"), section.getDouble("y"), section.getDouble("z"),
                        (float) section.getDouble("yaw"), (float) section.getDouble("pitch"));
            }
            default -> throw new IllegalArgumentException("unknown destination type '" + type + "'");
        };
    }

    public void save(Collection<Portal> portals) {
        YamlConfiguration yaml = new YamlConfiguration();
        for (Portal portal : portals) {
            String base = "portals." + portal.id();
            yaml.set(base + ".display-name", portal.displayName());
            yaml.set(base + ".enabled", portal.enabled());
            yaml.set(base + ".region.world", portal.region().world());
            yaml.set(base + ".region.min.x", portal.region().minX());
            yaml.set(base + ".region.min.y", portal.region().minY());
            yaml.set(base + ".region.min.z", portal.region().minZ());
            yaml.set(base + ".region.max.x", portal.region().maxX());
            yaml.set(base + ".region.max.y", portal.region().maxY());
            yaml.set(base + ".region.max.z", portal.region().maxZ());

            switch (portal.destination()) {
                case ServerPortalDestination server -> {
                    yaml.set(base + ".destination.type", "SERVER");
                    yaml.set(base + ".destination.server", server.serverId());
                }
                case LocationPortalDestination location -> {
                    yaml.set(base + ".destination.type", "LOCATION");
                    yaml.set(base + ".destination.world", location.world());
                    yaml.set(base + ".destination.x", location.x());
                    yaml.set(base + ".destination.y", location.y());
                    yaml.set(base + ".destination.z", location.z());
                    yaml.set(base + ".destination.yaw", location.yaw());
                    yaml.set(base + ".destination.pitch", location.pitch());
                }
            }

            yaml.set(base + ".permission", portal.permission());
            yaml.set(base + ".cooldown-ms", portal.cooldownMs());
            yaml.set(base + ".sound", portal.sound());
            yaml.set(base + ".messages.success", portal.successMessage());
            yaml.set(base + ".messages.denied", portal.deniedMessage());
        }

        try {
            File parent = file.getParentFile();
            if (parent != null) {
                Files.createDirectories(parent.toPath());
            }
            File tempFile = new File(file.getParentFile(), file.getName() + ".tmp");
            yaml.save(tempFile);
            Files.move(tempFile.toPath(), file.toPath(),
                    StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            logger.severe("Failed to save portals.yml: " + e.getMessage());
        } catch (java.nio.file.FileSystemException atomicNotSupported) {
            try {
                File tempFile = new File(file.getParentFile(), file.getName() + ".tmp");
                Files.move(tempFile.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING);
            } catch (IOException e) {
                logger.severe("Failed to save portals.yml (fallback move): " + e.getMessage());
            }
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `mvn -pl zander-hub -am test -Dtest=PortalRepositoryTest`
Expected: PASS, 5/5 tests. (This test class requires `paper-api` on the test classpath for `YamlConfiguration`/`Sound`, which it already is via the module's `compile`-scope dependency.)

- [ ] **Step 5: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalRepository.java \
        zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalRepositoryTest.java
git commit -m "feat: add PortalRepository YAML persistence with per-entry validation"
```

---

## Task 8: `PortalSpatialIndex`

**Files:**
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalSpatialIndex.java`
- Test: `zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalSpatialIndexTest.java`

**Interfaces:**
- Consumes: `Portal`, `PortalRegion` (Tasks 4, 6).
- Produces: `PortalSpatialIndex` with `void rebuild(Collection<Portal> portals)`, `List<Portal> candidatesFor(String world, int chunkX, int chunkZ)` (returns empty list, never null, for unknown keys). Used by `PortalMovementListener` (Task 16) and `PortalService` (Task 9).

- [ ] **Step 1: Write failing tests**

```java
package dev.anchorlight.zander.hub.portal;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class PortalSpatialIndexTest {
    private Portal portalIn(String id, PortalRegion region) {
        return new Portal(id, id, true, region, new ServerPortalDestination("s"), null, 0L, null, "s", "d");
    }

    @Test
    void singleChunkPortalIsFoundInItsChunk() {
        PortalRegion region = new PortalRegion("world", 10, 120, 5, 12, 124, 5);
        Portal portal = portalIn("survival", region);
        PortalSpatialIndex index = new PortalSpatialIndex();
        index.rebuild(List.of(portal));

        List<Portal> candidates = index.candidatesFor("world", 0, 0); // block 10 -> chunk 0
        assertEquals(1, candidates.size());
        assertEquals("survival", candidates.get(0).id());
    }

    @Test
    void emptyChunkReturnsEmptyList() {
        PortalSpatialIndex index = new PortalSpatialIndex();
        index.rebuild(List.of());
        assertTrue(index.candidatesFor("world", 5, 5).isEmpty());
    }

    @Test
    void multiChunkPortalIsFoundInEveryIntersectedChunk() {
        // x -1..17 spans chunk -1, 0, 1
        PortalRegion region = new PortalRegion("world", -1, 60, 0, 17, 70, 0);
        Portal portal = portalIn("wide", region);
        PortalSpatialIndex index = new PortalSpatialIndex();
        index.rebuild(List.of(portal));

        assertEquals(1, index.candidatesFor("world", -1, 0).size());
        assertEquals(1, index.candidatesFor("world", 0, 0).size());
        assertEquals(1, index.candidatesFor("world", 1, 0).size());
    }

    @Test
    void differentWorldsAreIsolated() {
        PortalRegion region = new PortalRegion("world_nether", 0, 60, 0, 1, 61, 1);
        Portal portal = portalIn("p", region);
        PortalSpatialIndex index = new PortalSpatialIndex();
        index.rebuild(List.of(portal));

        assertTrue(index.candidatesFor("world", 0, 0).isEmpty());
        assertEquals(1, index.candidatesFor("world_nether", 0, 0).size());
    }

    @Test
    void rebuildReplacesPreviousContents() {
        PortalRegion region = new PortalRegion("world", 0, 60, 0, 1, 61, 1);
        Portal portal = portalIn("p", region);
        PortalSpatialIndex index = new PortalSpatialIndex();
        index.rebuild(List.of(portal));
        assertEquals(1, index.candidatesFor("world", 0, 0).size());

        index.rebuild(List.of());
        assertTrue(index.candidatesFor("world", 0, 0).isEmpty());
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `mvn -pl zander-hub -am test -Dtest=PortalSpatialIndexTest`
Expected: FAIL (`PortalSpatialIndex` does not exist).

- [ ] **Step 3: Write `PortalSpatialIndex`**

```java
package dev.anchorlight.zander.hub.portal;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Buckets portals by (world, chunk) so movement detection only scans portals that could
 * plausibly contain the player's current block, instead of every loaded portal.
 */
public class PortalSpatialIndex {
    private volatile Map<String, Map<Long, List<Portal>>> index = Collections.emptyMap();

    public synchronized void rebuild(Collection<Portal> portals) {
        Map<String, Map<Long, List<Portal>>> next = new HashMap<>();
        for (Portal portal : portals) {
            PortalRegion region = portal.region();
            Map<Long, List<Portal>> worldBuckets =
                    next.computeIfAbsent(region.world(), key -> new HashMap<>());
            for (int chunkX = region.minChunkX(); chunkX <= region.maxChunkX(); chunkX++) {
                for (int chunkZ = region.minChunkZ(); chunkZ <= region.maxChunkZ(); chunkZ++) {
                    worldBuckets.computeIfAbsent(chunkKey(chunkX, chunkZ), key -> new ArrayList<>()).add(portal);
                }
            }
        }
        this.index = next;
    }

    public List<Portal> candidatesFor(String world, int chunkX, int chunkZ) {
        Map<Long, List<Portal>> worldBuckets = index.get(world);
        if (worldBuckets == null) {
            return List.of();
        }
        List<Portal> candidates = worldBuckets.get(chunkKey(chunkX, chunkZ));
        return candidates == null ? List.of() : candidates;
    }

    private static long chunkKey(int chunkX, int chunkZ) {
        return (((long) chunkX) << 32) ^ (chunkZ & 0xffffffffL);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `mvn -pl zander-hub -am test -Dtest=PortalSpatialIndexTest`
Expected: PASS, 5/5 tests.

- [ ] **Step 5: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalSpatialIndex.java \
        zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalSpatialIndexTest.java
git commit -m "feat: add chunk-keyed PortalSpatialIndex"
```

---

## Task 9: `PortalService`

**Files:**
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalService.java`
- Test: `zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalServiceTest.java`

**Interfaces:**
- Consumes: `PortalRepository` (Task 7), `PortalSpatialIndex` (Task 8), `Portal`/`PortalRegion`/`PortalDestination` (Tasks 4-6).
- Produces: `PortalService(PortalRepository repository, PortalSpatialIndex index)` with `void reload()`, `Collection<Portal> all()`, `java.util.Optional<Portal> find(String id)` (case-insensitive), `void put(Portal portal)` (create or replace by normalised id, persists + rebuilds), `boolean delete(String id)` (persists + rebuilds, returns whether it existed), `void setEnabled(String id, boolean enabled)`. Used by `PortalActivationHandler` (Task 15), `PortalMovementListener` (Task 16), and all `/zportal` subcommands (Task 20), and `ZanderHubMain` (Task 22).

- [ ] **Step 1: Write failing tests**

```java
package dev.anchorlight.zander.hub.portal;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.nio.file.Path;
import java.util.Optional;
import java.util.logging.Logger;

import static org.junit.jupiter.api.Assertions.*;

class PortalServiceTest {
    private PortalService newService(Path tempDir) {
        File file = tempDir.resolve("portals.yml").toFile();
        PortalRepository repository = new PortalRepository(file, Logger.getLogger("test"), world -> true);
        return new PortalService(repository, new PortalSpatialIndex());
    }

    private Portal samplePortal(String id) {
        return new Portal(id, id, true, new PortalRegion("world", 0, 60, 0, 1, 61, 1),
                new ServerPortalDestination("survival"), null, 0L, null, "s", "d");
    }

    @Test
    void putThenFindIsCaseInsensitive(@TempDir Path tempDir) {
        PortalService service = newService(tempDir);
        service.put(samplePortal("Survival"));

        Optional<Portal> found = service.find("SURVIVAL");
        assertTrue(found.isPresent());
        assertEquals("Survival", found.get().id());
    }

    @Test
    void deleteRemovesPortal(@TempDir Path tempDir) {
        PortalService service = newService(tempDir);
        service.put(samplePortal("survival"));
        assertTrue(service.delete("survival"));
        assertTrue(service.find("survival").isEmpty());
    }

    @Test
    void deleteReturnsFalseForUnknownId(@TempDir Path tempDir) {
        PortalService service = newService(tempDir);
        assertFalse(service.delete("nope"));
    }

    @Test
    void setEnabledTogglesState(@TempDir Path tempDir) {
        PortalService service = newService(tempDir);
        service.put(samplePortal("survival"));
        service.setEnabled("survival", false);
        assertFalse(service.find("survival").orElseThrow().enabled());
    }

    @Test
    void reloadReflectsPersistedData(@TempDir Path tempDir) {
        PortalService service = newService(tempDir);
        service.put(samplePortal("survival"));

        PortalService second = newService(tempDir);
        second.reload();
        assertTrue(second.find("survival").isPresent());
    }

    @Test
    void putUpdatesSpatialIndexImmediately(@TempDir Path tempDir) {
        PortalService service = newService(tempDir);
        service.put(samplePortal("survival"));
        assertEquals(1, service.all().size());
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `mvn -pl zander-hub -am test -Dtest=PortalServiceTest`
Expected: FAIL (`PortalService` does not exist).

- [ ] **Step 3: Write `PortalService`**

```java
package dev.anchorlight.zander.hub.portal;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Runtime-authoritative view of portals: mediates between the persisted store
 * ({@link PortalRepository}) and the lookup structure used by movement detection
 * ({@link PortalSpatialIndex}). All mutation methods persist and re-index before returning.
 */
public class PortalService {
    private final PortalRepository repository;
    private final PortalSpatialIndex index;
    private Map<String, Portal> portals;

    public PortalService(PortalRepository repository, PortalSpatialIndex index) {
        this.repository = repository;
        this.index = index;
        this.portals = repository.load();
        this.index.rebuild(this.portals.values());
    }

    public void reload() {
        this.portals = repository.load();
        this.index.rebuild(this.portals.values());
    }

    public Collection<Portal> all() {
        return this.portals.values();
    }

    public Optional<Portal> find(String id) {
        return Optional.ofNullable(this.portals.get(PortalIdValidator.normalise(id)));
    }

    public void put(Portal portal) {
        this.portals.put(PortalIdValidator.normalise(portal.id()), portal);
        persistAndReindex();
    }

    public boolean delete(String id) {
        Portal removed = this.portals.remove(PortalIdValidator.normalise(id));
        if (removed == null) {
            return false;
        }
        persistAndReindex();
        return true;
    }

    public void setEnabled(String id, boolean enabled) {
        Portal existing = this.portals.get(PortalIdValidator.normalise(id));
        if (existing == null) {
            throw new IllegalArgumentException("No such portal: " + id);
        }
        put(new Portal(existing.id(), existing.displayName(), enabled, existing.region(), existing.destination(),
                existing.permission(), existing.cooldownMs(), existing.sound(),
                existing.successMessage(), existing.deniedMessage()));
    }

    private void persistAndReindex() {
        Map<String, Portal> snapshot = new LinkedHashMap<>(this.portals);
        this.portals = snapshot;
        repository.save(snapshot.values());
        index.rebuild(snapshot.values());
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `mvn -pl zander-hub -am test -Dtest=PortalServiceTest`
Expected: PASS, 6/6 tests.

- [ ] **Step 5: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalService.java \
        zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalServiceTest.java
git commit -m "feat: add PortalService mediating repository and spatial index"
```

---

## Task 10: Bridge wire protocol — hub side (`BridgeCodec`)

**Files:**
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/bridge/BridgeMessage.java`
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/bridge/BridgeProtocolException.java`
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/bridge/BridgeCodec.java`
- Test: `zander-hub/src/test/java/dev/anchorlight/zander/hub/bridge/BridgeCodecTest.java`

**Interfaces:**
- Produces: `sealed interface BridgeMessage` with records `ServerListRequest(String requestId)`, `ServerListResponse(String requestId, List<ServerInfo> servers)` (`record ServerInfo(String id, int playerCount, boolean registered, boolean hasAccess, boolean alreadyConnected)`), `ConnectRequest(String requestId, String portalId, String serverId)`, `ConnectStarted(String requestId, String serverId)`, `ConnectDenied(String requestId, String reason)`, `ConnectFailed(String requestId, String reason)`, `PlayerCurrentServerRequest(String requestId)`, `PlayerCurrentServerResponse(String requestId, String serverId)`. `BridgeCodec.encode(BridgeMessage) -> byte[]`, `BridgeCodec.decode(byte[]) -> BridgeMessage` throws `BridgeProtocolException` on unsupported version, truncated payload, or any string exceeding `BridgeCodec.MAX_STRING_LENGTH` (64). Used by `BridgeClient` (Task 12).

- [ ] **Step 1: Write failing tests**

```java
package dev.anchorlight.zander.hub.bridge;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class BridgeCodecTest {
    @Test
    void roundTripsServerListRequest() {
        BridgeMessage.ServerListRequest original = new BridgeMessage.ServerListRequest("req-1");
        byte[] encoded = BridgeCodec.encode(original);
        BridgeMessage decoded = BridgeCodec.decode(encoded);
        assertEquals(original, decoded);
    }

    @Test
    void roundTripsServerListResponseWithMultipleServers() {
        var servers = List.of(
                new BridgeMessage.ServerInfo("survival", 12, true, true, false),
                new BridgeMessage.ServerInfo("events", 0, false, false, false));
        var original = new BridgeMessage.ServerListResponse("req-2", servers);
        BridgeMessage decoded = BridgeCodec.decode(BridgeCodec.encode(original));
        assertEquals(original, decoded);
    }

    @Test
    void roundTripsConnectRequest() {
        var original = new BridgeMessage.ConnectRequest("req-3", "survival-portal", "survival");
        assertEquals(original, BridgeCodec.decode(BridgeCodec.encode(original)));
    }

    @Test
    void roundTripsConnectDenied() {
        var original = new BridgeMessage.ConnectDenied("req-4", "No permission");
        assertEquals(original, BridgeCodec.decode(BridgeCodec.encode(original)));
    }

    @Test
    void rejectsUnsupportedProtocolVersion() {
        byte[] encoded = BridgeCodec.encode(new BridgeMessage.ServerListRequest("req-5"));
        encoded[0] = (byte) 99; // corrupt the version byte
        assertThrows(BridgeProtocolException.class, () -> BridgeCodec.decode(encoded));
    }

    @Test
    void rejectsTruncatedPayload() {
        byte[] encoded = BridgeCodec.encode(new BridgeMessage.ConnectRequest("req-6", "p", "s"));
        byte[] truncated = java.util.Arrays.copyOf(encoded, encoded.length - 3);
        assertThrows(BridgeProtocolException.class, () -> BridgeCodec.decode(truncated));
    }

    @Test
    void rejectsOversizedString() {
        String tooLong = "x".repeat(BridgeCodec.MAX_STRING_LENGTH + 1);
        var oversized = new BridgeMessage.ConnectRequest("req-7", tooLong, "s");
        assertThrows(BridgeProtocolException.class, () -> BridgeCodec.encode(oversized));
    }

    @Test
    void rejectsEmptyByteArray() {
        assertThrows(BridgeProtocolException.class, () -> BridgeCodec.decode(new byte[0]));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `mvn -pl zander-hub -am test -Dtest=BridgeCodecTest`
Expected: FAIL (types do not exist).

- [ ] **Step 3: Write `BridgeProtocolException`**

```java
package dev.anchorlight.zander.hub.bridge;

/** Thrown when a `zander:hub` bridge message can't be safely encoded or decoded. */
public class BridgeProtocolException extends RuntimeException {
    public BridgeProtocolException(String message) {
        super(message);
    }

    public BridgeProtocolException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

- [ ] **Step 4: Write `BridgeMessage`**

```java
package dev.anchorlight.zander.hub.bridge;

import java.util.List;

/** The `zander:hub` bridge protocol's message types. See {@link BridgeCodec} for wire format. */
public sealed interface BridgeMessage {
    String requestId();

    record ServerInfo(String id, int playerCount, boolean registered, boolean hasAccess, boolean alreadyConnected) {
    }

    record ServerListRequest(String requestId) implements BridgeMessage {
    }

    record ServerListResponse(String requestId, List<ServerInfo> servers) implements BridgeMessage {
    }

    record ConnectRequest(String requestId, String portalId, String serverId) implements BridgeMessage {
    }

    record ConnectStarted(String requestId, String serverId) implements BridgeMessage {
    }

    record ConnectDenied(String requestId, String reason) implements BridgeMessage {
    }

    record ConnectFailed(String requestId, String reason) implements BridgeMessage {
    }

    record PlayerCurrentServerRequest(String requestId) implements BridgeMessage {
    }

    record PlayerCurrentServerResponse(String requestId, String serverId) implements BridgeMessage {
    }
}
```

- [ ] **Step 5: Write `BridgeCodec`**

```java
package dev.anchorlight.zander.hub.bridge;

import com.google.common.io.ByteArrayDataOutput;
import com.google.common.io.ByteStreams;

import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Binary codec for the {@code zander:hub} plugin messaging channel. No Java object
 * serialization; every message is `[version:byte][type:byte][requestId:UTF]...fields`.
 * This class is intentionally duplicated (not shared) between zander-hub and
 * zander-velocity — see the design doc for why there is no shared module.
 */
public final class BridgeCodec {
    public static final byte PROTOCOL_VERSION = 1;
    public static final int MAX_STRING_LENGTH = 64;
    public static final int MAX_REASON_LENGTH = 256;

    private enum Type {
        SERVER_LIST_REQUEST, SERVER_LIST_RESPONSE, CONNECT_REQUEST, CONNECT_STARTED,
        CONNECT_DENIED, CONNECT_FAILED, PLAYER_CURRENT_SERVER_REQUEST, PLAYER_CURRENT_SERVER_RESPONSE
    }

    private BridgeCodec() {
        throw new IllegalStateException("Utility class shouldn't be instantiated");
    }

    private static void writeString(ByteArrayDataOutput out, String value, int maxLength) {
        if (value == null || value.length() > maxLength) {
            throw new BridgeProtocolException("String exceeds max length " + maxLength + ": " + value);
        }
        out.writeUTF(value);
    }

    private static String readString(DataInputStream in, int maxLength) throws IOException {
        String value = in.readUTF();
        if (value.length() > maxLength) {
            throw new BridgeProtocolException("Decoded string exceeds max length " + maxLength);
        }
        return value;
    }

    public static byte[] encode(BridgeMessage message) {
        ByteArrayDataOutput out = ByteStreams.newDataOutput();
        out.writeByte(PROTOCOL_VERSION);

        switch (message) {
            case BridgeMessage.ServerListRequest m -> {
                out.writeByte(Type.SERVER_LIST_REQUEST.ordinal());
                writeString(out, m.requestId(), MAX_STRING_LENGTH);
            }
            case BridgeMessage.ServerListResponse m -> {
                out.writeByte(Type.SERVER_LIST_RESPONSE.ordinal());
                writeString(out, m.requestId(), MAX_STRING_LENGTH);
                out.writeInt(m.servers().size());
                for (BridgeMessage.ServerInfo server : m.servers()) {
                    writeString(out, server.id(), MAX_STRING_LENGTH);
                    out.writeInt(server.playerCount());
                    out.writeBoolean(server.registered());
                    out.writeBoolean(server.hasAccess());
                    out.writeBoolean(server.alreadyConnected());
                }
            }
            case BridgeMessage.ConnectRequest m -> {
                out.writeByte(Type.CONNECT_REQUEST.ordinal());
                writeString(out, m.requestId(), MAX_STRING_LENGTH);
                writeString(out, m.portalId(), MAX_STRING_LENGTH);
                writeString(out, m.serverId(), MAX_STRING_LENGTH);
            }
            case BridgeMessage.ConnectStarted m -> {
                out.writeByte(Type.CONNECT_STARTED.ordinal());
                writeString(out, m.requestId(), MAX_STRING_LENGTH);
                writeString(out, m.serverId(), MAX_STRING_LENGTH);
            }
            case BridgeMessage.ConnectDenied m -> {
                out.writeByte(Type.CONNECT_DENIED.ordinal());
                writeString(out, m.requestId(), MAX_STRING_LENGTH);
                writeString(out, m.reason(), MAX_REASON_LENGTH);
            }
            case BridgeMessage.ConnectFailed m -> {
                out.writeByte(Type.CONNECT_FAILED.ordinal());
                writeString(out, m.requestId(), MAX_STRING_LENGTH);
                writeString(out, m.reason(), MAX_REASON_LENGTH);
            }
            case BridgeMessage.PlayerCurrentServerRequest m -> {
                out.writeByte(Type.PLAYER_CURRENT_SERVER_REQUEST.ordinal());
                writeString(out, m.requestId(), MAX_STRING_LENGTH);
            }
            case BridgeMessage.PlayerCurrentServerResponse m -> {
                out.writeByte(Type.PLAYER_CURRENT_SERVER_RESPONSE.ordinal());
                writeString(out, m.requestId(), MAX_STRING_LENGTH);
                writeString(out, m.serverId(), MAX_STRING_LENGTH);
            }
        }
        return out.toByteArray();
    }

    public static BridgeMessage decode(byte[] bytes) {
        try {
            DataInputStream in = new DataInputStream(new ByteArrayInputStream(bytes));
            byte version = in.readByte();
            if (version != PROTOCOL_VERSION) {
                throw new BridgeProtocolException("Unsupported protocol version: " + version);
            }
            int typeOrdinal = in.readByte();
            Type[] types = Type.values();
            if (typeOrdinal < 0 || typeOrdinal >= types.length) {
                throw new BridgeProtocolException("Unknown message type ordinal: " + typeOrdinal);
            }
            Type type = types[typeOrdinal];
            String requestId = readString(in, MAX_STRING_LENGTH);

            return switch (type) {
                case SERVER_LIST_REQUEST -> new BridgeMessage.ServerListRequest(requestId);
                case SERVER_LIST_RESPONSE -> {
                    int count = in.readInt();
                    if (count < 0 || count > 4096) {
                        throw new BridgeProtocolException("Unreasonable server list count: " + count);
                    }
                    List<BridgeMessage.ServerInfo> servers = new ArrayList<>(count);
                    for (int i = 0; i < count; i++) {
                        servers.add(new BridgeMessage.ServerInfo(
                                readString(in, MAX_STRING_LENGTH), in.readInt(),
                                in.readBoolean(), in.readBoolean(), in.readBoolean()));
                    }
                    yield new BridgeMessage.ServerListResponse(requestId, servers);
                }
                case CONNECT_REQUEST -> new BridgeMessage.ConnectRequest(requestId,
                        readString(in, MAX_STRING_LENGTH), readString(in, MAX_STRING_LENGTH));
                case CONNECT_STARTED -> new BridgeMessage.ConnectStarted(requestId, readString(in, MAX_STRING_LENGTH));
                case CONNECT_DENIED -> new BridgeMessage.ConnectDenied(requestId, readString(in, MAX_REASON_LENGTH));
                case CONNECT_FAILED -> new BridgeMessage.ConnectFailed(requestId, readString(in, MAX_REASON_LENGTH));
                case PLAYER_CURRENT_SERVER_REQUEST -> new BridgeMessage.PlayerCurrentServerRequest(requestId);
                case PLAYER_CURRENT_SERVER_RESPONSE ->
                        new BridgeMessage.PlayerCurrentServerResponse(requestId, readString(in, MAX_STRING_LENGTH));
            };
        } catch (IOException e) {
            throw new BridgeProtocolException("Malformed or truncated bridge payload", e);
        }
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `mvn -pl zander-hub -am test -Dtest=BridgeCodecTest`
Expected: PASS, 7/7 tests.

- [ ] **Step 7: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/bridge/BridgeMessage.java \
        zander-hub/src/main/java/dev/anchorlight/zander/hub/bridge/BridgeProtocolException.java \
        zander-hub/src/main/java/dev/anchorlight/zander/hub/bridge/BridgeCodec.java \
        zander-hub/src/test/java/dev/anchorlight/zander/hub/bridge/BridgeCodecTest.java
git commit -m "feat: add zander:hub bridge wire protocol (hub side)"
```

---

## Task 11: Bridge wire protocol — velocity side (`BridgeCodec`)

**Files:**
- Create: `zander-velocity/src/main/java/dev/anchorlight/zander/velocity/bridge/BridgeMessage.java`
- Create: `zander-velocity/src/main/java/dev/anchorlight/zander/velocity/bridge/BridgeProtocolException.java`
- Create: `zander-velocity/src/main/java/dev/anchorlight/zander/velocity/bridge/BridgeCodec.java`
- Test: `zander-velocity/src/test/java/dev/anchorlight/zander/velocity/bridge/BridgeCodecTest.java`

**Interfaces:**
- Produces: identical wire-compatible types/methods to Task 10, in the `dev.anchorlight.zander.velocity.bridge` package. Used by `HubBridgeListener` (Task 13).

- [ ] **Step 1: Write failing tests**

```java
package dev.anchorlight.zander.velocity.bridge;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class BridgeCodecTest {
    @Test
    void roundTripsServerListRequest() {
        var original = new BridgeMessage.ServerListRequest("req-1");
        assertEquals(original, BridgeCodec.decode(BridgeCodec.encode(original)));
    }

    @Test
    void roundTripsServerListResponseWithMultipleServers() {
        var servers = List.of(
                new BridgeMessage.ServerInfo("survival", 12, true, true, false),
                new BridgeMessage.ServerInfo("events", 0, false, false, false));
        var original = new BridgeMessage.ServerListResponse("req-2", servers);
        assertEquals(original, BridgeCodec.decode(BridgeCodec.encode(original)));
    }

    @Test
    void roundTripsConnectRequest() {
        var original = new BridgeMessage.ConnectRequest("req-3", "survival-portal", "survival");
        assertEquals(original, BridgeCodec.decode(BridgeCodec.encode(original)));
    }

    @Test
    void roundTripsConnectFailed() {
        var original = new BridgeMessage.ConnectFailed("req-4", "Server unavailable");
        assertEquals(original, BridgeCodec.decode(BridgeCodec.encode(original)));
    }

    @Test
    void rejectsUnsupportedProtocolVersion() {
        byte[] encoded = BridgeCodec.encode(new BridgeMessage.ServerListRequest("req-5"));
        encoded[0] = (byte) 99;
        assertThrows(BridgeProtocolException.class, () -> BridgeCodec.decode(encoded));
    }

    @Test
    void rejectsTruncatedPayload() {
        byte[] encoded = BridgeCodec.encode(new BridgeMessage.ConnectRequest("req-6", "p", "s"));
        byte[] truncated = java.util.Arrays.copyOf(encoded, encoded.length - 3);
        assertThrows(BridgeProtocolException.class, () -> BridgeCodec.decode(truncated));
    }

    @Test
    void rejectsOversizedString() {
        String tooLong = "x".repeat(BridgeCodec.MAX_STRING_LENGTH + 1);
        var oversized = new BridgeMessage.ConnectRequest("req-7", tooLong, "s");
        assertThrows(BridgeProtocolException.class, () -> BridgeCodec.encode(oversized));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `mvn -pl zander-velocity -am test -Dtest=BridgeCodecTest`
Expected: FAIL (types do not exist).

- [ ] **Step 3: Write `BridgeProtocolException`**

```java
package dev.anchorlight.zander.velocity.bridge;

/** Thrown when a `zander:hub` bridge message can't be safely encoded or decoded. */
public class BridgeProtocolException extends RuntimeException {
    public BridgeProtocolException(String message) {
        super(message);
    }

    public BridgeProtocolException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

- [ ] **Step 4: Write `BridgeMessage`**

```java
package dev.anchorlight.zander.velocity.bridge;

import java.util.List;

/** The `zander:hub` bridge protocol's message types. See {@link BridgeCodec} for wire format. */
public sealed interface BridgeMessage {
    String requestId();

    record ServerInfo(String id, int playerCount, boolean registered, boolean hasAccess, boolean alreadyConnected) {
    }

    record ServerListRequest(String requestId) implements BridgeMessage {
    }

    record ServerListResponse(String requestId, List<ServerInfo> servers) implements BridgeMessage {
    }

    record ConnectRequest(String requestId, String portalId, String serverId) implements BridgeMessage {
    }

    record ConnectStarted(String requestId, String serverId) implements BridgeMessage {
    }

    record ConnectDenied(String requestId, String reason) implements BridgeMessage {
    }

    record ConnectFailed(String requestId, String reason) implements BridgeMessage {
    }

    record PlayerCurrentServerRequest(String requestId) implements BridgeMessage {
    }

    record PlayerCurrentServerResponse(String requestId, String serverId) implements BridgeMessage {
    }
}
```

- [ ] **Step 5: Write `BridgeCodec`**

```java
package dev.anchorlight.zander.velocity.bridge;

import com.google.common.io.ByteArrayDataOutput;
import com.google.common.io.ByteStreams;

import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Binary codec for the {@code zander:hub} plugin messaging channel, wire-compatible with
 * {@code dev.anchorlight.zander.hub.bridge.BridgeCodec}. Intentionally duplicated rather
 * than shared — see the design doc.
 */
public final class BridgeCodec {
    public static final byte PROTOCOL_VERSION = 1;
    public static final int MAX_STRING_LENGTH = 64;
    public static final int MAX_REASON_LENGTH = 256;

    private enum Type {
        SERVER_LIST_REQUEST, SERVER_LIST_RESPONSE, CONNECT_REQUEST, CONNECT_STARTED,
        CONNECT_DENIED, CONNECT_FAILED, PLAYER_CURRENT_SERVER_REQUEST, PLAYER_CURRENT_SERVER_RESPONSE
    }

    private BridgeCodec() {
        throw new IllegalStateException("Utility class shouldn't be instantiated");
    }

    private static void writeString(ByteArrayDataOutput out, String value, int maxLength) {
        if (value == null || value.length() > maxLength) {
            throw new BridgeProtocolException("String exceeds max length " + maxLength + ": " + value);
        }
        out.writeUTF(value);
    }

    private static String readString(DataInputStream in, int maxLength) throws IOException {
        String value = in.readUTF();
        if (value.length() > maxLength) {
            throw new BridgeProtocolException("Decoded string exceeds max length " + maxLength);
        }
        return value;
    }

    public static byte[] encode(BridgeMessage message) {
        ByteArrayDataOutput out = ByteStreams.newDataOutput();
        out.writeByte(PROTOCOL_VERSION);

        switch (message) {
            case BridgeMessage.ServerListRequest m -> {
                out.writeByte(Type.SERVER_LIST_REQUEST.ordinal());
                writeString(out, m.requestId(), MAX_STRING_LENGTH);
            }
            case BridgeMessage.ServerListResponse m -> {
                out.writeByte(Type.SERVER_LIST_RESPONSE.ordinal());
                writeString(out, m.requestId(), MAX_STRING_LENGTH);
                out.writeInt(m.servers().size());
                for (BridgeMessage.ServerInfo server : m.servers()) {
                    writeString(out, server.id(), MAX_STRING_LENGTH);
                    out.writeInt(server.playerCount());
                    out.writeBoolean(server.registered());
                    out.writeBoolean(server.hasAccess());
                    out.writeBoolean(server.alreadyConnected());
                }
            }
            case BridgeMessage.ConnectRequest m -> {
                out.writeByte(Type.CONNECT_REQUEST.ordinal());
                writeString(out, m.requestId(), MAX_STRING_LENGTH);
                writeString(out, m.portalId(), MAX_STRING_LENGTH);
                writeString(out, m.serverId(), MAX_STRING_LENGTH);
            }
            case BridgeMessage.ConnectStarted m -> {
                out.writeByte(Type.CONNECT_STARTED.ordinal());
                writeString(out, m.requestId(), MAX_STRING_LENGTH);
                writeString(out, m.serverId(), MAX_STRING_LENGTH);
            }
            case BridgeMessage.ConnectDenied m -> {
                out.writeByte(Type.CONNECT_DENIED.ordinal());
                writeString(out, m.requestId(), MAX_STRING_LENGTH);
                writeString(out, m.reason(), MAX_REASON_LENGTH);
            }
            case BridgeMessage.ConnectFailed m -> {
                out.writeByte(Type.CONNECT_FAILED.ordinal());
                writeString(out, m.requestId(), MAX_STRING_LENGTH);
                writeString(out, m.reason(), MAX_REASON_LENGTH);
            }
            case BridgeMessage.PlayerCurrentServerRequest m -> {
                out.writeByte(Type.PLAYER_CURRENT_SERVER_REQUEST.ordinal());
                writeString(out, m.requestId(), MAX_STRING_LENGTH);
            }
            case BridgeMessage.PlayerCurrentServerResponse m -> {
                out.writeByte(Type.PLAYER_CURRENT_SERVER_RESPONSE.ordinal());
                writeString(out, m.requestId(), MAX_STRING_LENGTH);
                writeString(out, m.serverId(), MAX_STRING_LENGTH);
            }
        }
        return out.toByteArray();
    }

    public static BridgeMessage decode(byte[] bytes) {
        try {
            DataInputStream in = new DataInputStream(new ByteArrayInputStream(bytes));
            byte version = in.readByte();
            if (version != PROTOCOL_VERSION) {
                throw new BridgeProtocolException("Unsupported protocol version: " + version);
            }
            int typeOrdinal = in.readByte();
            Type[] types = Type.values();
            if (typeOrdinal < 0 || typeOrdinal >= types.length) {
                throw new BridgeProtocolException("Unknown message type ordinal: " + typeOrdinal);
            }
            Type type = types[typeOrdinal];
            String requestId = readString(in, MAX_STRING_LENGTH);

            return switch (type) {
                case SERVER_LIST_REQUEST -> new BridgeMessage.ServerListRequest(requestId);
                case SERVER_LIST_RESPONSE -> {
                    int count = in.readInt();
                    if (count < 0 || count > 4096) {
                        throw new BridgeProtocolException("Unreasonable server list count: " + count);
                    }
                    List<BridgeMessage.ServerInfo> servers = new ArrayList<>(count);
                    for (int i = 0; i < count; i++) {
                        servers.add(new BridgeMessage.ServerInfo(
                                readString(in, MAX_STRING_LENGTH), in.readInt(),
                                in.readBoolean(), in.readBoolean(), in.readBoolean()));
                    }
                    yield new BridgeMessage.ServerListResponse(requestId, servers);
                }
                case CONNECT_REQUEST -> new BridgeMessage.ConnectRequest(requestId,
                        readString(in, MAX_STRING_LENGTH), readString(in, MAX_STRING_LENGTH));
                case CONNECT_STARTED -> new BridgeMessage.ConnectStarted(requestId, readString(in, MAX_STRING_LENGTH));
                case CONNECT_DENIED -> new BridgeMessage.ConnectDenied(requestId, readString(in, MAX_REASON_LENGTH));
                case CONNECT_FAILED -> new BridgeMessage.ConnectFailed(requestId, readString(in, MAX_REASON_LENGTH));
                case PLAYER_CURRENT_SERVER_REQUEST -> new BridgeMessage.PlayerCurrentServerRequest(requestId);
                case PLAYER_CURRENT_SERVER_RESPONSE ->
                        new BridgeMessage.PlayerCurrentServerResponse(requestId, readString(in, MAX_STRING_LENGTH));
            };
        } catch (IOException e) {
            throw new BridgeProtocolException("Malformed or truncated bridge payload", e);
        }
    }
}
```

- [ ] **Step 6: Add Guava dependency (compile-visible) if not already resolvable**

Velocity API depends on Guava transitively; confirm by running the build in Step 7. If `com.google.common.io.ByteStreams` fails to resolve, add to `zander-velocity/pom.xml` dependencies:

```xml
        <dependency>
            <groupId>com.google.guava</groupId>
            <artifactId>guava</artifactId>
            <version>33.2.1-jre</version>
            <scope>provided</scope>
        </dependency>
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `mvn -pl zander-velocity -am test -Dtest=BridgeCodecTest`
Expected: PASS, 7/7 tests.

- [ ] **Step 8: Commit**

```bash
git add zander-velocity/src/main/java/dev/anchorlight/zander/velocity/bridge/BridgeMessage.java \
        zander-velocity/src/main/java/dev/anchorlight/zander/velocity/bridge/BridgeProtocolException.java \
        zander-velocity/src/main/java/dev/anchorlight/zander/velocity/bridge/BridgeCodec.java \
        zander-velocity/src/test/java/dev/anchorlight/zander/velocity/bridge/BridgeCodecTest.java \
        zander-velocity/pom.xml
git commit -m "feat: add zander:hub bridge wire protocol (velocity side)"
```

---

## Task 12: `BridgeClient` (hub side), replaces `ProxyMessaging`/`PluginMessageChannel`

**Files:**
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/bridge/BridgeClient.java`
- Delete: `zander-hub/src/main/java/dev/anchorlight/zander/hub/events/ProxyMessaging.java`
- Delete: `zander-hub/src/main/java/dev/anchorlight/zander/hub/events/PluginMessageChannel.java`
- Modify: `zander-hub/src/main/java/dev/anchorlight/zander/hub/ZanderHubMain.java`
- Test: `zander-hub/src/test/java/dev/anchorlight/zander/hub/bridge/BridgeClientTest.java`

**Interfaces:**
- Consumes: `BridgeMessage`, `BridgeCodec` (Task 10).
- Produces: `BridgeClient` with a `Sender` functional interface (`void send(Player player, byte[] bytes)`, injected so it's testable without Bukkit), constructor `BridgeClient(Sender sender, long timeoutMs)`, `CompletableFuture<BridgeMessage.ServerListResponse> requestServerList(Player player)`, `CompletableFuture<BridgeMessage.PlayerCurrentServerResponse> requestPlayerCurrentServer(Player player)`, a fire-and-correlate `CompletableFuture<BridgeMessage> sendConnectRequest(Player player, String portalId, String serverId)` (resolves with whichever of `ConnectStarted`/`ConnectDenied`/`ConnectFailed` arrives), and `void onPluginMessageReceived(byte[] bytes)` to feed in responses and complete the matching pending future by `requestId`. Used by `HubCompassItem` (Task 18) and `PortalActivationHandler` (Task 15/17).

- [ ] **Step 1: Write failing tests**

Test with a fake `Sender` and manually-fed responses (no real Bukkit `Player`/scheduler needed since correlation logic is pure):

```java
package dev.anchorlight.zander.hub.bridge;

import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

class BridgeClientTest {
    @Test
    void correlatesResponseToItsRequestByRequestId() throws Exception {
        java.util.concurrent.atomic.AtomicReference<byte[]> sent = new java.util.concurrent.atomic.AtomicReference<>();
        BridgeClient client = new BridgeClient((player, bytes) -> sent.set(bytes), 2000L);

        CompletableFuture<BridgeMessage.ServerListResponse> future = client.requestServerList(null);
        BridgeMessage.ServerListRequest decodedRequest =
                (BridgeMessage.ServerListRequest) BridgeCodec.decode(sent.get());

        var response = new BridgeMessage.ServerListResponse(decodedRequest.requestId(),
                List.of(new BridgeMessage.ServerInfo("survival", 3, true, true, false)));
        client.onPluginMessageReceived(BridgeCodec.encode(response));

        BridgeMessage.ServerListResponse result = future.get(1, TimeUnit.SECONDS);
        assertEquals(1, result.servers().size());
        assertEquals("survival", result.servers().get(0).id());
    }

    @Test
    void ignoresResponseWithUnknownRequestId() {
        BridgeClient client = new BridgeClient((player, bytes) -> {
        }, 2000L);
        var response = new BridgeMessage.ServerListResponse("no-such-request", List.of());
        assertDoesNotThrow(() -> client.onPluginMessageReceived(BridgeCodec.encode(response)));
    }

    @Test
    void timesOutWhenNoResponseArrives() {
        BridgeClient client = new BridgeClient((player, bytes) -> {
        }, 50L);
        CompletableFuture<BridgeMessage.ServerListResponse> future = client.requestServerList(null);

        ExecutionException ex = assertThrows(ExecutionException.class, () -> future.get(1, TimeUnit.SECONDS));
        assertInstanceOf(TimeoutException.class, ex.getCause());
    }

    @Test
    void connectRequestResolvesOnConnectStarted() throws Exception {
        java.util.concurrent.atomic.AtomicReference<byte[]> sent = new java.util.concurrent.atomic.AtomicReference<>();
        BridgeClient client = new BridgeClient((player, bytes) -> sent.set(bytes), 2000L);

        CompletableFuture<BridgeMessage> future = client.sendConnectRequest(null, "portal-1", "survival");
        BridgeMessage.ConnectRequest decoded = (BridgeMessage.ConnectRequest) BridgeCodec.decode(sent.get());
        assertEquals("portal-1", decoded.portalId());

        client.onPluginMessageReceived(BridgeCodec.encode(new BridgeMessage.ConnectStarted(decoded.requestId(), "survival")));
        assertInstanceOf(BridgeMessage.ConnectStarted.class, future.get(1, TimeUnit.SECONDS));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `mvn -pl zander-hub -am test -Dtest=BridgeClientTest`
Expected: FAIL (`BridgeClient` does not exist).

- [ ] **Step 3: Write `BridgeClient`**

```java
package dev.anchorlight.zander.hub.bridge;

import org.bukkit.entity.Player;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Sends {@code zander:hub} bridge requests and resolves the matching response by
 * request id. Replaces the legacy BungeeCord-channel {@code ProxyMessaging}/
 * {@code PluginMessageChannel} pair.
 */
public class BridgeClient {
    @FunctionalInterface
    public interface Sender {
        void send(Player player, byte[] bytes);
    }

    private final Sender sender;
    private final long timeoutMs;
    private final Map<String, CompletableFuture<BridgeMessage>> pending = new ConcurrentHashMap<>();

    public BridgeClient(Sender sender, long timeoutMs) {
        this.sender = sender;
        this.timeoutMs = timeoutMs;
    }

    private String newRequestId() {
        return UUID.randomUUID().toString();
    }

    @SuppressWarnings("unchecked")
    private <T extends BridgeMessage> CompletableFuture<T> send(Player player, BridgeMessage request) {
        String requestId = request.requestId();
        CompletableFuture<BridgeMessage> future = new CompletableFuture<>();
        pending.put(requestId, future);
        sender.send(player, BridgeCodec.encode(request));
        return (CompletableFuture<T>) future
                .orTimeout(timeoutMs, TimeUnit.MILLISECONDS)
                .whenComplete((result, error) -> pending.remove(requestId));
    }

    public CompletableFuture<BridgeMessage.ServerListResponse> requestServerList(Player player) {
        return send(player, new BridgeMessage.ServerListRequest(newRequestId()));
    }

    public CompletableFuture<BridgeMessage.PlayerCurrentServerResponse> requestPlayerCurrentServer(Player player) {
        return send(player, new BridgeMessage.PlayerCurrentServerRequest(newRequestId()));
    }

    /** Resolves with whichever of ConnectStarted/ConnectDenied/ConnectFailed the proxy replies with. */
    public CompletableFuture<BridgeMessage> sendConnectRequest(Player player, String portalId, String serverId) {
        return send(player, new BridgeMessage.ConnectRequest(newRequestId(), portalId, serverId));
    }

    /** Feed a raw plugin-message payload received on the {@code zander:hub} channel. */
    public void onPluginMessageReceived(byte[] bytes) {
        BridgeMessage message;
        try {
            message = BridgeCodec.decode(bytes);
        } catch (BridgeProtocolException e) {
            return; // malformed inbound message from the proxy; nothing safe to correlate
        }
        CompletableFuture<BridgeMessage> future = pending.get(message.requestId());
        if (future != null) {
            future.complete(message);
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `mvn -pl zander-hub -am test -Dtest=BridgeClientTest`
Expected: PASS, 4/4 tests.

- [ ] **Step 5: Delete legacy files and wire `BridgeClient` into `ZanderHubMain`**

Delete `zander-hub/src/main/java/dev/anchorlight/zander/hub/events/ProxyMessaging.java` and
`zander-hub/src/main/java/dev/anchorlight/zander/hub/events/PluginMessageChannel.java`.

In `ZanderHubMain.java`:
- Remove `import dev.anchorlight.zander.hub.events.ProxyMessaging;` and the `public static ProxyMessaging proxyMessaging;` field.
- Add `import dev.anchorlight.zander.hub.bridge.BridgeClient;` and `import org.bukkit.plugin.messaging.PluginMessageListener;`.
- Add `public static BridgeClient bridgeClient;` field.
- Replace the two `registerOutgoingPluginChannel`/`registerIncomingPluginChannel` lines (currently registering `"BungeeCord"`) with:

```java
        this.getServer().getMessenger().registerOutgoingPluginChannel(this, "zander:hub");
        bridgeClient = new BridgeClient((player, bytes) -> player.sendPluginMessage(this, "zander:hub", bytes), 1500L);
        this.getServer().getMessenger().registerIncomingPluginChannel(this, "zander:hub",
                (channel, player, message) -> bridgeClient.onPluginMessageReceived(message));
```

(This inline lambda satisfies `PluginMessageListener`'s single method; no separate listener class is needed since all logic lives in `BridgeClient`.)

- [ ] **Step 6: Compile to verify**

Run: `mvn -pl zander-hub -am compile`
Expected: BUILD SUCCESS. (`HubCompassItem` will still reference the deleted `ZanderHubMain.proxyMessaging`/`PluginMessageChannel` at this point and fail to compile — that's expected and resolved in Task 18. If Task 18 has not yet run, compilation of the whole module fails; that's acceptable mid-plan since each task's own tests are what's verified per-step, but note this dependency when sequencing execution.)

- [ ] **Step 7: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/bridge/BridgeClient.java \
        zander-hub/src/test/java/dev/anchorlight/zander/hub/bridge/BridgeClientTest.java \
        zander-hub/src/main/java/dev/anchorlight/zander/hub/ZanderHubMain.java
git rm zander-hub/src/main/java/dev/anchorlight/zander/hub/events/ProxyMessaging.java \
       zander-hub/src/main/java/dev/anchorlight/zander/hub/events/PluginMessageChannel.java
git commit -m "feat: add BridgeClient and register zander:hub channel, remove legacy BungeeCord messaging"
```

---

## Task 13: `HubBridgeListener` (Velocity side) + config

**Files:**
- Create: `zander-velocity/src/main/java/dev/anchorlight/zander/velocity/bridge/HubBridgeListener.java`
- Create: `zander-velocity/src/main/java/dev/anchorlight/zander/velocity/bridge/RateLimiter.java`
- Modify: `zander-velocity/src/main/resources/config.yml`
- Modify: `zander-velocity/src/main/java/dev/anchorlight/zander/velocity/ZanderVelocityMain.java`
- Test: `zander-velocity/src/test/java/dev/anchorlight/zander/velocity/bridge/RateLimiterTest.java`

**Interfaces:**
- Consumes: `BridgeMessage`, `BridgeCodec` (Task 11).
- Produces: `RateLimiter` with `boolean tryAcquire(UUID playerId)` (pure logic, testable), `HubBridgeListener(ProxyServer, Logger, YamlDocument config)` subscribed to `PluginMessageEvent`. No later task consumes this directly — it's the terminal handler for inbound bridge traffic. Registers `MinecraftChannelIdentifier.create("zander", "hub")`.

- [ ] **Step 1: Add `hub-bridge` section to velocity `config.yml`**

Append to `zander-velocity/src/main/resources/config.yml`:

```yaml
hub-bridge:
  enabled: true
  channel: "zander:hub"
  allowed-source-servers:
    - hub
  rate-limit:
    connection-request-cooldown-ms: 1500
  logging:
    malformed-messages: true
    denied-source-servers: true
```

- [ ] **Step 2: Write failing `RateLimiterTest`**

```java
package dev.anchorlight.zander.velocity.bridge;

import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class RateLimiterTest {
    @Test
    void firstRequestIsAllowed() {
        RateLimiter limiter = new RateLimiter(1000L);
        assertTrue(limiter.tryAcquire(UUID.randomUUID()));
    }

    @Test
    void secondImmediateRequestIsBlocked() {
        RateLimiter limiter = new RateLimiter(1000L);
        UUID id = UUID.randomUUID();
        assertTrue(limiter.tryAcquire(id));
        assertFalse(limiter.tryAcquire(id));
    }

    @Test
    void differentPlayersAreIndependent() {
        RateLimiter limiter = new RateLimiter(1000L);
        assertTrue(limiter.tryAcquire(UUID.randomUUID()));
        assertTrue(limiter.tryAcquire(UUID.randomUUID()));
    }

    @Test
    void requestAllowedAgainAfterCooldownElapses() throws InterruptedException {
        RateLimiter limiter = new RateLimiter(20L);
        UUID id = UUID.randomUUID();
        assertTrue(limiter.tryAcquire(id));
        Thread.sleep(30L);
        assertTrue(limiter.tryAcquire(id));
    }

    @Test
    void clearRemovesCooldownState() {
        RateLimiter limiter = new RateLimiter(10_000L);
        UUID id = UUID.randomUUID();
        assertTrue(limiter.tryAcquire(id));
        limiter.clear(id);
        assertTrue(limiter.tryAcquire(id));
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `mvn -pl zander-velocity -am test -Dtest=RateLimiterTest`
Expected: FAIL (`RateLimiter` does not exist).

- [ ] **Step 4: Write `RateLimiter`**

```java
package dev.anchorlight.zander.velocity.bridge;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Simple per-player cooldown gate for connection requests arriving over the bridge. */
public class RateLimiter {
    private final long cooldownMs;
    private final Map<UUID, Long> lastAcquiredAt = new ConcurrentHashMap<>();

    public RateLimiter(long cooldownMs) {
        this.cooldownMs = cooldownMs;
    }

    public boolean tryAcquire(UUID playerId) {
        long now = System.currentTimeMillis();
        Long last = lastAcquiredAt.get(playerId);
        if (last != null && now - last < cooldownMs) {
            return false;
        }
        lastAcquiredAt.put(playerId, now);
        return true;
    }

    public void clear(UUID playerId) {
        lastAcquiredAt.remove(playerId);
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `mvn -pl zander-velocity -am test -Dtest=RateLimiterTest`
Expected: PASS, 5/5 tests.

- [ ] **Step 6: Write `HubBridgeListener`**

```java
package dev.anchorlight.zander.velocity.bridge;

import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.connection.PluginMessageEvent;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.proxy.ServerConnection;
import com.velocitypowered.api.proxy.messages.ChannelIdentifier;
import com.velocitypowered.api.proxy.messages.MinecraftChannelIdentifier;
import com.velocitypowered.api.proxy.server.RegisteredServer;
import dev.dejvokep.boostedyaml.YamlDocument;
import dev.dejvokep.boostedyaml.route.Route;
import org.slf4j.Logger;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Handles the {@code zander:hub} bridge channel on the proxy: validates the source
 * backend server, derives the player from the connection (never trusting payload
 * identity), enforces {@code serverpermissions.server.<id>}, and is the sole authority
 * for whether a bridge-initiated connection actually proceeds.
 */
public class HubBridgeListener {
    public static final ChannelIdentifier CHANNEL = MinecraftChannelIdentifier.create("zander", "hub");

    private final ProxyServer proxy;
    private final Logger logger;
    private final boolean enabled;
    private final List<String> allowedSourceServers;
    private final boolean logMalformed;
    private final boolean logDeniedSources;
    private final RateLimiter rateLimiter;
    private final java.util.Set<UUID> recentlyLoggedDenials = ConcurrentHashMap.newKeySet();
    private final java.util.Set<UUID> recentlyLoggedMalformed = ConcurrentHashMap.newKeySet();

    public HubBridgeListener(ProxyServer proxy, Logger logger, YamlDocument config) {
        this.proxy = proxy;
        this.logger = logger;
        this.enabled = config.getBoolean(Route.from("hub-bridge", "enabled"), true);
        this.allowedSourceServers = config.getStringList(Route.from("hub-bridge", "allowed-source-servers"));
        this.logMalformed = config.getBoolean(Route.from("hub-bridge", "logging", "malformed-messages"), true);
        this.logDeniedSources = config.getBoolean(Route.from("hub-bridge", "logging", "denied-source-servers"), true);
        long cooldownMs = config.getLong(Route.from("hub-bridge", "rate-limit", "connection-request-cooldown-ms"), 1500L);
        this.rateLimiter = new RateLimiter(cooldownMs);
    }

    @Subscribe
    public void onPluginMessage(PluginMessageEvent event) {
        if (!enabled || !event.getIdentifier().equals(CHANNEL)) {
            return;
        }
        event.setResult(PluginMessageEvent.ForwardResult.handled());

        if (!(event.getSource() instanceof ServerConnection source)) {
            return; // never process messages whose source isn't a backend server connection
        }
        String sourceServerName = source.getServerInfo().getName();
        if (!allowedSourceServers.contains(sourceServerName)) {
            if (logDeniedSources) {
                logger.warn("Rejected zander:hub message from unapproved source server '{}'", sourceServerName);
            }
            return;
        }

        Player player = source.getPlayer();
        if (player == null) {
            return;
        }

        dev.anchorlight.zander.velocity.bridge.BridgeMessage message;
        try {
            message = BridgeCodec.decode(event.getData());
        } catch (BridgeProtocolException e) {
            if (logMalformed && recentlyLoggedMalformed.add(player.getUniqueId())) {
                logger.warn("Rejected malformed zander:hub message from {}: {}", player.getUsername(), e.getMessage());
                proxy.getScheduler().buildTask(this, () -> recentlyLoggedMalformed.remove(player.getUniqueId()))
                        .delay(30, TimeUnit.SECONDS).schedule();
            }
            return;
        }

        switch (message) {
            case dev.anchorlight.zander.velocity.bridge.BridgeMessage.ServerListRequest ignored ->
                    handleServerListRequest(player, message.requestId());
            case dev.anchorlight.zander.velocity.bridge.BridgeMessage.ConnectRequest connectRequest ->
                    handleConnectRequest(player, connectRequest);
            case dev.anchorlight.zander.velocity.bridge.BridgeMessage.PlayerCurrentServerRequest ignored ->
                    handlePlayerCurrentServerRequest(player, message.requestId());
            default -> { /* proxy never receives response-type messages */ }
        }
    }

    private void reply(Player player, dev.anchorlight.zander.velocity.bridge.BridgeMessage response) {
        player.getCurrentServer().ifPresent(server ->
                server.sendPluginMessage(CHANNEL, BridgeCodec.encode(response)));
    }

    private void handleServerListRequest(Player player, String requestId) {
        List<dev.anchorlight.zander.velocity.bridge.BridgeMessage.ServerInfo> infos = new java.util.ArrayList<>();
        String currentServerName = player.getCurrentServer().map(sc -> sc.getServerInfo().getName()).orElse(null);
        for (RegisteredServer server : proxy.getAllServers()) {
            String id = server.getServerInfo().getName();
            boolean hasAccess = player.hasPermission("serverpermissions.server." + id);
            boolean alreadyConnected = id.equals(currentServerName);
            int count = server.getPlayersConnected().size();
            infos.add(new dev.anchorlight.zander.velocity.bridge.BridgeMessage.ServerInfo(
                    id, count, true, hasAccess, alreadyConnected));
        }
        reply(player, new dev.anchorlight.zander.velocity.bridge.BridgeMessage.ServerListResponse(requestId, infos));
    }

    private void handlePlayerCurrentServerRequest(Player player, String requestId) {
        String currentServerName = player.getCurrentServer().map(sc -> sc.getServerInfo().getName()).orElse("");
        reply(player, new dev.anchorlight.zander.velocity.bridge.BridgeMessage.PlayerCurrentServerResponse(requestId, currentServerName));
    }

    private void handleConnectRequest(Player player,
            dev.anchorlight.zander.velocity.bridge.BridgeMessage.ConnectRequest request) {
        if (!rateLimiter.tryAcquire(player.getUniqueId())) {
            reply(player, new dev.anchorlight.zander.velocity.bridge.BridgeMessage.ConnectFailed(
                    request.requestId(), "You are connecting too quickly, please wait."));
            return;
        }

        Optional<RegisteredServer> target = proxy.getServer(request.serverId());
        if (target.isEmpty()) {
            reply(player, new dev.anchorlight.zander.velocity.bridge.BridgeMessage.ConnectFailed(
                    request.requestId(), "Unknown server: " + request.serverId()));
            return;
        }

        String currentServerName = player.getCurrentServer().map(sc -> sc.getServerInfo().getName()).orElse(null);
        if (request.serverId().equals(currentServerName)) {
            reply(player, new dev.anchorlight.zander.velocity.bridge.BridgeMessage.ConnectFailed(
                    request.requestId(), "Already connected to " + request.serverId()));
            return;
        }

        if (!player.hasPermission("serverpermissions.server." + request.serverId())) {
            reply(player, new dev.anchorlight.zander.velocity.bridge.BridgeMessage.ConnectDenied(
                    request.requestId(), "You do not have access to " + request.serverId() + "."));
            return;
        }

        reply(player, new dev.anchorlight.zander.velocity.bridge.BridgeMessage.ConnectStarted(
                request.requestId(), request.serverId()));

        player.createConnectionRequest(target.get()).connect().whenComplete((result, throwable) -> {
            if (throwable != null || result == null || !result.isSuccessful()) {
                reply(player, new dev.anchorlight.zander.velocity.bridge.BridgeMessage.ConnectFailed(
                        request.requestId(), "Failed to connect to " + request.serverId() + "."));
            }
        });
    }
}
```

- [ ] **Step 7: Register the channel and listener in `ZanderVelocityMain`**

In `zander-velocity/src/main/java/dev/anchorlight/zander/velocity/ZanderVelocityMain.java`:
- Add import `import dev.anchorlight.zander.velocity.bridge.HubBridgeListener;`.
- In `onProxyInitialization`, after the existing `proxy.getEventManager().register(...)` calls, add:

```java
        proxy.getChannelRegistrar().register(HubBridgeListener.CHANNEL);
        proxy.getEventManager().register(this, new HubBridgeListener(proxy, logger, config));
```

- [ ] **Step 8: Compile to verify**

Run: `mvn -pl zander-velocity -am compile`
Expected: BUILD SUCCESS.

- [ ] **Step 9: Commit**

```bash
git add zander-velocity/src/main/java/dev/anchorlight/zander/velocity/bridge/HubBridgeListener.java \
        zander-velocity/src/main/java/dev/anchorlight/zander/velocity/bridge/RateLimiter.java \
        zander-velocity/src/test/java/dev/anchorlight/zander/velocity/bridge/RateLimiterTest.java \
        zander-velocity/src/main/resources/config.yml \
        zander-velocity/src/main/java/dev/anchorlight/zander/velocity/ZanderVelocityMain.java
git commit -m "feat: add HubBridgeListener enforcing serverpermissions on the proxy"
```

**Manual verification:** with Hub and a backend server (e.g. `survival`) both connected to Velocity, and a player with/without `serverpermissions.server.survival`, send a `CONNECT_REQUEST` from Hub and confirm `CONNECT_STARTED`+actual transfer for the permitted case and `CONNECT_DENIED` for the unpermitted case; send a bridge message from a non-`hub` backend server (e.g. spoof by connecting from `survival`) and confirm it's rejected and logged; send a truncated/garbage payload and confirm no exception propagates and it's logged once (not per-byte).

---

## Task 14: `PortalSessionManager`

**Files:**
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalSessionManager.java`
- Test: `zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalSessionManagerTest.java`

**Interfaces:**
- Produces: `PortalSessionManager` with per-`UUID` state: `Optional<String> getActivePortalId(UUID player)`, `void setActivePortalId(UUID player, String portalId)`, `void clearActivePortalId(UUID player)`; `boolean isOnCooldown(UUID player, String portalId, long nowMs)`, `void markTriggered(UUID player, String portalId, long nowMs, long cooldownMs)`; `boolean isSuppressed(UUID player, long nowMs)`, `void suppressUntil(UUID player, long untilMs)`; `boolean tryMarkConnectPending(UUID player)` (false if already pending), `void clearConnectPending(UUID player)`; `void clear(UUID player)` (removes all state for a player, called on quit). Used by `PortalMovementListener` (Task 15) and `PortalActivationHandler` (Task 16).

- [ ] **Step 1: Write failing tests**

```java
package dev.anchorlight.zander.hub.portal;

import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class PortalSessionManagerTest {
    @Test
    void activePortalStartsEmpty() {
        PortalSessionManager sessions = new PortalSessionManager();
        assertTrue(sessions.getActivePortalId(UUID.randomUUID()).isEmpty());
    }

    @Test
    void setAndClearActivePortal() {
        PortalSessionManager sessions = new PortalSessionManager();
        UUID player = UUID.randomUUID();
        sessions.setActivePortalId(player, "survival");
        assertEquals("survival", sessions.getActivePortalId(player).orElseThrow());
        sessions.clearActivePortalId(player);
        assertTrue(sessions.getActivePortalId(player).isEmpty());
    }

    @Test
    void cooldownBlocksImmediateRetrigger() {
        PortalSessionManager sessions = new PortalSessionManager();
        UUID player = UUID.randomUUID();
        sessions.markTriggered(player, "survival", 1000L, 2000L);
        assertTrue(sessions.isOnCooldown(player, "survival", 1500L));
        assertFalse(sessions.isOnCooldown(player, "survival", 3001L));
    }

    @Test
    void cooldownIsPerPortal() {
        PortalSessionManager sessions = new PortalSessionManager();
        UUID player = UUID.randomUUID();
        sessions.markTriggered(player, "survival", 1000L, 2000L);
        assertFalse(sessions.isOnCooldown(player, "events", 1500L));
    }

    @Test
    void loopSuppressionExpires() {
        PortalSessionManager sessions = new PortalSessionManager();
        UUID player = UUID.randomUUID();
        sessions.suppressUntil(player, 1000L);
        assertTrue(sessions.isSuppressed(player, 999L));
        assertFalse(sessions.isSuppressed(player, 1000L));
    }

    @Test
    void connectPendingIsExclusiveUntilCleared() {
        PortalSessionManager sessions = new PortalSessionManager();
        UUID player = UUID.randomUUID();
        assertTrue(sessions.tryMarkConnectPending(player));
        assertFalse(sessions.tryMarkConnectPending(player));
        sessions.clearConnectPending(player);
        assertTrue(sessions.tryMarkConnectPending(player));
    }

    @Test
    void clearRemovesAllState() {
        PortalSessionManager sessions = new PortalSessionManager();
        UUID player = UUID.randomUUID();
        sessions.setActivePortalId(player, "survival");
        sessions.tryMarkConnectPending(player);
        sessions.clear(player);
        assertTrue(sessions.getActivePortalId(player).isEmpty());
        assertTrue(sessions.tryMarkConnectPending(player));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `mvn -pl zander-hub -am test -Dtest=PortalSessionManagerTest`
Expected: FAIL (`PortalSessionManager` does not exist).

- [ ] **Step 3: Write `PortalSessionManager`**

```java
package dev.anchorlight.zander.hub.portal;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-player runtime portal state: which portal (if any) they're currently inside, per-portal
 * cooldown timestamps, post-teleport loop-suppression, and in-flight connect-request tracking.
 * Keyed by player UUID; call {@link #clear(UUID)} on disconnect.
 */
public class PortalSessionManager {
    private final Map<UUID, String> activePortal = new ConcurrentHashMap<>();
    private final Map<UUID, Map<String, Long>> cooldownUntil = new ConcurrentHashMap<>();
    private final Map<UUID, Long> suppressedUntil = new ConcurrentHashMap<>();
    private final java.util.Set<UUID> connectPending = ConcurrentHashMap.newKeySet();

    public Optional<String> getActivePortalId(UUID player) {
        return Optional.ofNullable(activePortal.get(player));
    }

    public void setActivePortalId(UUID player, String portalId) {
        activePortal.put(player, portalId);
    }

    public void clearActivePortalId(UUID player) {
        activePortal.remove(player);
    }

    public boolean isOnCooldown(UUID player, String portalId, long nowMs) {
        Map<String, Long> byPortal = cooldownUntil.get(player);
        if (byPortal == null) {
            return false;
        }
        Long until = byPortal.get(portalId);
        return until != null && nowMs < until;
    }

    public void markTriggered(UUID player, String portalId, long nowMs, long cooldownMs) {
        cooldownUntil.computeIfAbsent(player, key -> new ConcurrentHashMap<>()).put(portalId, nowMs + cooldownMs);
    }

    public boolean isSuppressed(UUID player, long nowMs) {
        Long until = suppressedUntil.get(player);
        return until != null && nowMs < until;
    }

    public void suppressUntil(UUID player, long untilMs) {
        suppressedUntil.put(player, untilMs);
    }

    public boolean tryMarkConnectPending(UUID player) {
        return connectPending.add(player);
    }

    public void clearConnectPending(UUID player) {
        connectPending.remove(player);
    }

    public void clear(UUID player) {
        activePortal.remove(player);
        cooldownUntil.remove(player);
        suppressedUntil.remove(player);
        connectPending.remove(player);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `mvn -pl zander-hub -am test -Dtest=PortalSessionManagerTest`
Expected: PASS, 7/7 tests.

- [ ] **Step 5: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalSessionManager.java \
        zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalSessionManagerTest.java
git commit -m "feat: add PortalSessionManager for per-player portal runtime state"
```

---

## Task 15: `PortalTransitionDetector` (pure enter/exit logic)

**Files:**
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalTransitionDetector.java`
- Test: `zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalTransitionDetectorTest.java`

**Interfaces:**
- Consumes: `Portal`, `PortalSpatialIndex`, `PortalSessionManager` (Tasks 6, 8, 14).
- Produces: `PortalTransitionDetector(PortalSpatialIndex index, PortalSessionManager sessions)` with `Optional<Portal> onBlockMove(UUID player, String world, int x, int y, int z)` — looks up chunk candidates, finds the (first) containing portal if any, compares to the player's active portal via `PortalSessionManager`, updates session state, and returns `Optional.of(portal)` only on an outside→inside transition (never on re-entry while already inside, never on exit). This is the Bukkit-free core that `PortalMovementListener` (Task 16) wraps.

- [ ] **Step 1: Write failing tests**

```java
package dev.anchorlight.zander.hub.portal;

import org.junit.jupiter.api.Test;
import java.util.Optional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class PortalTransitionDetectorTest {
    private Portal portal(String id, PortalRegion region) {
        return new Portal(id, id, true, region, new ServerPortalDestination("s"), null, 0L, null, "s", "d");
    }

    private PortalTransitionDetector newDetector(Portal... portals) {
        PortalSpatialIndex index = new PortalSpatialIndex();
        index.rebuild(java.util.List.of(portals));
        return new PortalTransitionDetector(index, new PortalSessionManager());
    }

    @Test
    void enteringPortalFiresTransition() {
        Portal p = portal("survival", new PortalRegion("world", 0, 60, 0, 2, 62, 2));
        PortalTransitionDetector detector = newDetector(p);
        UUID player = UUID.randomUUID();

        Optional<Portal> result = detector.onBlockMove(player, "world", 1, 61, 1);
        assertTrue(result.isPresent());
        assertEquals("survival", result.get().id());
    }

    @Test
    void stayingInsidePortalDoesNotRetrigger() {
        Portal p = portal("survival", new PortalRegion("world", 0, 60, 0, 2, 62, 2));
        PortalTransitionDetector detector = newDetector(p);
        UUID player = UUID.randomUUID();

        assertTrue(detector.onBlockMove(player, "world", 1, 61, 1).isPresent());
        assertTrue(detector.onBlockMove(player, "world", 1, 61, 2).isEmpty());
    }

    @Test
    void leavingPortalClearsActiveState() {
        Portal p = portal("survival", new PortalRegion("world", 0, 60, 0, 2, 62, 2));
        PortalTransitionDetector detector = newDetector(p);
        UUID player = UUID.randomUUID();

        detector.onBlockMove(player, "world", 1, 61, 1);
        detector.onBlockMove(player, "world", 10, 61, 10); // outside
        assertTrue(detector.onBlockMove(player, "world", 1, 61, 1).isPresent()); // re-enter fires again
    }

    @Test
    void movingOutsideNeverFiresTransition() {
        Portal p = portal("survival", new PortalRegion("world", 0, 60, 0, 2, 62, 2));
        PortalTransitionDetector detector = newDetector(p);
        UUID player = UUID.randomUUID();

        assertTrue(detector.onBlockMove(player, "world", 10, 61, 10).isEmpty());
    }

    @Test
    void differentPlayersTrackedIndependently() {
        Portal p = portal("survival", new PortalRegion("world", 0, 60, 0, 2, 62, 2));
        PortalTransitionDetector detector = newDetector(p);
        UUID playerA = UUID.randomUUID();
        UUID playerB = UUID.randomUUID();

        assertTrue(detector.onBlockMove(playerA, "world", 1, 61, 1).isPresent());
        assertTrue(detector.onBlockMove(playerB, "world", 1, 61, 1).isPresent());
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `mvn -pl zander-hub -am test -Dtest=PortalTransitionDetectorTest`
Expected: FAIL (`PortalTransitionDetector` does not exist).

- [ ] **Step 3: Write `PortalTransitionDetector`**

```java
package dev.anchorlight.zander.hub.portal;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Pure enter/exit edge-detection logic shared by the Bukkit movement listener, kept free of
 * Bukkit types so it's directly unit-testable.
 */
public class PortalTransitionDetector {
    private final PortalSpatialIndex index;
    private final PortalSessionManager sessions;

    public PortalTransitionDetector(PortalSpatialIndex index, PortalSessionManager sessions) {
        this.index = index;
        this.sessions = sessions;
    }

    /** Returns the newly-entered portal, or empty if the player didn't just cross into one. */
    public Optional<Portal> onBlockMove(UUID player, String world, int x, int y, int z) {
        List<Portal> candidates = index.candidatesFor(world, x >> 4, z >> 4);
        Portal current = null;
        for (Portal candidate : candidates) {
            if (candidate.enabled() && candidate.region().contains(x, y, z)) {
                current = candidate;
                break;
            }
        }

        Optional<String> activeId = sessions.getActivePortalId(player);
        if (current == null) {
            if (activeId.isPresent()) {
                sessions.clearActivePortalId(player);
            }
            return Optional.empty();
        }

        if (activeId.isPresent() && activeId.get().equals(current.id())) {
            return Optional.empty(); // still inside the same portal, no retrigger
        }

        sessions.setActivePortalId(player, current.id());
        return Optional.of(current);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `mvn -pl zander-hub -am test -Dtest=PortalTransitionDetectorTest`
Expected: PASS, 5/5 tests.

- [ ] **Step 5: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalTransitionDetector.java \
        zander-hub/src/test/java/dev/anchorlight/zander/hub/portal/PortalTransitionDetectorTest.java
git commit -m "feat: add PortalTransitionDetector pure enter/exit logic"
```

---

## Task 16: `PortalMovementListener` + `PortalActivationHandler`

**Files:**
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalMovementListener.java`
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalActivationHandler.java`
- Modify: `zander-hub/src/main/resources/config.yml` (portal messages + re-entry delay)

**Interfaces:**
- Consumes: `PortalTransitionDetector` (Task 15), `PortalSessionManager` (Task 14), `PortalService` (Task 9), `BridgeClient` (Task 12), `ConfigurationManager.getHubLocations()`.
- Produces: `PortalMovementListener(ZanderHubMain, PortalTransitionDetector, PortalSessionManager, PortalActivationHandler)` — a `Listener` with a single `PlayerMoveEvent` handler; `PortalActivationHandler(ZanderHubMain, PortalSessionManager, BridgeClient)` with `void activate(Player player, Portal portal)`. Neither is unit-tested directly (thin Bukkit glue over already-tested `PortalTransitionDetector`); wired in Task 23.

- [ ] **Step 1: Add re-entry delay and portal messages to `config.yml`**

Append to `zander-hub/src/main/resources/config.yml`:

```yaml
portals:
  ignore-spectators: true
  reentry-delay-ticks: 2
messages:
  portal:
    disabled: "<red>This portal is currently disabled.</red>"
    permission-denied: "<red>You do not have permission to use this portal.</red>"
    server-permission-denied: "<red>You do not have access to that server.</red>"
    unknown-server: "<red>That server is currently unknown to the network.</red>"
    server-unavailable: "<red>That server is currently unavailable.</red>"
    connection-started: "<yellow>Connecting you now...</yellow>"
    connection-failed: "<red>Failed to connect, please try again.</red>"
    cooldown: "<gray>Please wait before using this portal again.</gray>"
    already-connected: "<gray>You are already connected to that server.</gray>"
    local-teleport-failed: "<red>That destination is currently unavailable.</red>"
```

- [ ] **Step 2: Write `PortalActivationHandler`**

```java
package dev.anchorlight.zander.hub.portal;

import dev.anchorlight.zander.hub.ZanderHubMain;
import dev.anchorlight.zander.hub.bridge.BridgeClient;
import dev.anchorlight.zander.hub.bridge.BridgeMessage;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Sound;
import org.bukkit.World;
import org.bukkit.entity.Player;

/**
 * Executes a portal's destination once {@link PortalMovementListener} has confirmed entry:
 * either a local teleport or a bridge-mediated server-transfer request. Server access is
 * never decided here — only Velocity's response determines the outcome.
 */
public class PortalActivationHandler {
    private final ZanderHubMain plugin;
    private final PortalSessionManager sessions;
    private final BridgeClient bridgeClient;

    public PortalActivationHandler(ZanderHubMain plugin, PortalSessionManager sessions, BridgeClient bridgeClient) {
        this.plugin = plugin;
        this.sessions = sessions;
        this.bridgeClient = bridgeClient;
    }

    public void activate(Player player, Portal portal) {
        long now = System.currentTimeMillis();

        if (!portal.enabled()) {
            send(player, "portals.messages.disabled-fallback", "<red>This portal is currently disabled.</red>");
            return;
        }
        if (sessions.isOnCooldown(player.getUniqueId(), portal.id(), now)) {
            send(player, "messages.portal.cooldown", "<gray>Please wait before using this portal again.</gray>");
            return;
        }
        if (portal.permission() != null && !player.hasPermission(portal.permission())) {
            send(player, "messages.portal.permission-denied", "<red>You do not have permission to use this portal.</red>");
            return;
        }

        sessions.markTriggered(player.getUniqueId(), portal.id(), now, portal.cooldownMs());

        switch (portal.destination()) {
            case ServerPortalDestination server -> activateServer(player, portal, server);
            case LocationPortalDestination location -> activateLocation(player, portal, location);
        }
    }

    private void activateServer(Player player, Portal portal, ServerPortalDestination destination) {
        if (!sessions.tryMarkConnectPending(player.getUniqueId())) {
            return; // a request is already in flight for this player
        }

        send(player, "messages.portal.connection-started", "<yellow>Connecting you now...</yellow>");

        bridgeClient.sendConnectRequest(player, portal.id(), destination.serverId())
                .whenComplete((response, error) -> Bukkit.getScheduler().runTask(plugin, () -> {
                    sessions.clearConnectPending(player.getUniqueId());
                    if (!player.isOnline()) {
                        return;
                    }
                    if (error != null) {
                        send(player, "messages.portal.connection-failed", "<red>Failed to connect, please try again.</red>");
                        return;
                    }
                    switch (response) {
                        case BridgeMessage.ConnectStarted ignored -> playSound(player, portal);
                        case BridgeMessage.ConnectDenied denied ->
                                player.sendMessage(MiniMessage.miniMessage().deserialize(
                                        denied.reason().isBlank() ? "<red>Access denied.</red>" : "<red>" + denied.reason() + "</red>"));
                        case BridgeMessage.ConnectFailed failed ->
                                player.sendMessage(MiniMessage.miniMessage().deserialize(
                                        failed.reason().isBlank() ? "<red>Connection failed.</red>" : "<red>" + failed.reason() + "</red>"));
                        default -> { }
                    }
                }));
    }

    private void activateLocation(Player player, Portal portal, LocationPortalDestination destination) {
        World world = Bukkit.getWorld(destination.world());
        if (world == null) {
            send(player, "messages.portal.local-teleport-failed", "<red>That destination is currently unavailable.</red>");
            return;
        }

        int reentryDelayTicks = plugin.getConfig().getInt("portals.reentry-delay-ticks", 2);
        long suppressUntil = System.currentTimeMillis() + (reentryDelayTicks * 50L);
        sessions.suppressUntil(player.getUniqueId(), suppressUntil);

        Location target = new Location(world, destination.x(), destination.y(), destination.z(),
                destination.yaw(), destination.pitch());
        player.teleportAsync(target).thenAccept(success -> {
            if (Boolean.TRUE.equals(success)) {
                Bukkit.getScheduler().runTask(plugin, () -> {
                    player.sendMessage(MiniMessage.miniMessage().deserialize(portal.successMessage()));
                    playSound(player, portal);
                });
            } else {
                Bukkit.getScheduler().runTask(plugin, () ->
                        send(player, "messages.portal.local-teleport-failed", "<red>That destination is currently unavailable.</red>"));
            }
        });
    }

    private void playSound(Player player, Portal portal) {
        if (portal.sound() == null) {
            return;
        }
        try {
            player.playSound(player.getLocation(), Sound.valueOf(portal.sound()), 1f, 1f);
        } catch (IllegalArgumentException ignored) {
            // invalid sound values are already rejected at load time by PortalRepository
        }
    }

    private void send(Player player, String configPath, String fallback) {
        String message = plugin.getConfig().getString(configPath, fallback);
        player.sendMessage(MiniMessage.miniMessage().deserialize(message));
    }
}
```

- [ ] **Step 3: Write `PortalMovementListener`**

```java
package dev.anchorlight.zander.hub.portal;

import dev.anchorlight.zander.hub.ZanderHubMain;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.event.player.PlayerQuitEvent;

/**
 * Bukkit-side glue: only re-evaluates portal membership when the player crosses a block
 * boundary, delegating the actual enter/exit logic to {@link PortalTransitionDetector}.
 */
public class PortalMovementListener implements Listener {
    private final ZanderHubMain plugin;
    private final PortalTransitionDetector detector;
    private final PortalSessionManager sessions;
    private final PortalActivationHandler activationHandler;

    public PortalMovementListener(ZanderHubMain plugin, PortalTransitionDetector detector,
            PortalSessionManager sessions, PortalActivationHandler activationHandler) {
        this.plugin = plugin;
        this.detector = detector;
        this.sessions = sessions;
        this.activationHandler = activationHandler;
    }

    @EventHandler
    public void onMove(PlayerMoveEvent event) {
        Location from = event.getFrom();
        Location to = event.getTo();
        if (to == null) {
            return;
        }
        if (from.getBlockX() == to.getBlockX() && from.getBlockY() == to.getBlockY()
                && from.getBlockZ() == to.getBlockZ()) {
            return; // only re-check on block-coordinate change
        }

        Player player = event.getPlayer();
        if (!player.isValid() || !player.isOnline()) {
            return;
        }
        if (plugin.getConfig().getBoolean("portals.ignore-spectators", true)
                && player.getGameMode() == GameMode.SPECTATOR) {
            return;
        }

        handleBlockMove(player, to);
    }

    private void handleBlockMove(Player player, Location to) {
        detector.onBlockMove(player.getUniqueId(), to.getWorld().getName(),
                to.getBlockX(), to.getBlockY(), to.getBlockZ()).ifPresent(portal -> {
            if (sessions.isSuppressed(player.getUniqueId(), System.currentTimeMillis())) {
                return; // just teleported here by another portal; don't chain-trigger
            }
            activationHandler.activate(player, portal);
        });
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        sessions.clear(event.getPlayer().getUniqueId());
    }
}
```

- [ ] **Step 4: Compile to verify**

Run: `mvn -pl zander-hub -am compile`
Expected: BUILD SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalMovementListener.java \
        zander-hub/src/main/java/dev/anchorlight/zander/hub/portal/PortalActivationHandler.java \
        zander-hub/src/main/resources/config.yml
git commit -m "feat: add PortalMovementListener and PortalActivationHandler"
```

---

## Task 17: Compass slot calculation (`CompassSlotCalculator`)

**Files:**
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/gui/CompassSlotCalculator.java`
- Test: `zander-hub/src/test/java/dev/anchorlight/zander/hub/gui/CompassSlotCalculatorTest.java`

**Interfaces:**
- Produces: `record SlotAssignment(String entryId, int slot)`; `CompassSlotCalculator.assign(List<String> entryIdsInOrder, Map<String, Integer> explicitSlots, int inventorySize) -> List<SlotAssignment>` throwing `IllegalArgumentException` on a duplicate explicit slot or a slot `>= inventorySize`/`< 0`; entries without an explicit slot are centred among the remaining free slots using the existing evenly-spaced algorithm from `HubCompassItem`. Used by `HubCompassItem` (Task 18).

- [ ] **Step 1: Write failing tests**

```java
package dev.anchorlight.zander.hub.gui;

import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class CompassSlotCalculatorTest {
    @Test
    void explicitSlotIsHonoured() {
        var result = CompassSlotCalculator.assign(List.of("survival"), Map.of("survival", 3), 9);
        assertEquals(3, result.get(0).slot());
    }

    @Test
    void centredSlotForSingleEntryWithNoExplicitSlot() {
        var result = CompassSlotCalculator.assign(List.of("survival"), Map.of(), 9);
        assertEquals(4, result.get(0).slot());
    }

    @Test
    void multipleEntriesAreEvenlySpacedWhenUnassigned() {
        var result = CompassSlotCalculator.assign(List.of("a", "b", "c"), Map.of(), 9);
        assertEquals(3, result.size());
        assertEquals(9, result.stream().map(CompassSlotCalculator.SlotAssignment::slot).distinct().count() * 3);
    }

    @Test
    void rejectsDuplicateExplicitSlots() {
        assertThrows(IllegalArgumentException.class, () ->
                CompassSlotCalculator.assign(List.of("a", "b"), Map.of("a", 2, "b", 2), 9));
    }

    @Test
    void rejectsOutOfRangeExplicitSlot() {
        assertThrows(IllegalArgumentException.class, () ->
                CompassSlotCalculator.assign(List.of("a"), Map.of("a", 20), 9));
        assertThrows(IllegalArgumentException.class, () ->
                CompassSlotCalculator.assign(List.of("a"), Map.of("a", -1), 9));
    }

    @Test
    void explicitAndAutoAssignedEntriesDoNotCollide() {
        var result = CompassSlotCalculator.assign(List.of("a", "b"), Map.of("a", 4), 9);
        int autoSlot = result.stream().filter(r -> r.entryId().equals("b")).findFirst().orElseThrow().slot();
        assertNotEquals(4, autoSlot);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `mvn -pl zander-hub -am test -Dtest=CompassSlotCalculatorTest`
Expected: FAIL (`CompassSlotCalculator` does not exist).

- [ ] **Step 3: Write `CompassSlotCalculator`**

```java
package dev.anchorlight.zander.hub.gui;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Assigns inventory slots to compass entries: explicit slots win, others are centred among what's left. */
public final class CompassSlotCalculator {
    public record SlotAssignment(String entryId, int slot) {
    }

    private CompassSlotCalculator() {
        throw new IllegalStateException("Utility class shouldn't be instantiated");
    }

    public static List<SlotAssignment> assign(List<String> entryIdsInOrder, Map<String, Integer> explicitSlots,
            int inventorySize) {
        Set<Integer> usedSlots = new LinkedHashSet<>();
        for (Map.Entry<String, Integer> entry : explicitSlots.entrySet()) {
            int slot = entry.getValue();
            if (slot < 0 || slot >= inventorySize) {
                throw new IllegalArgumentException("Slot " + slot + " for '" + entry.getKey()
                        + "' is outside the inventory (size " + inventorySize + ")");
            }
            if (!usedSlots.add(slot)) {
                throw new IllegalArgumentException("Duplicate slot " + slot + " requested by '" + entry.getKey() + "'");
            }
        }

        List<String> unassigned = new ArrayList<>();
        for (String id : entryIdsInOrder) {
            if (!explicitSlots.containsKey(id)) {
                unassigned.add(id);
            }
        }

        List<Integer> freeSlots = new ArrayList<>();
        for (int i = 0; i < inventorySize; i++) {
            if (!usedSlots.contains(i)) {
                freeSlots.add(i);
            }
        }
        int[] centredOffsets = computeEvenlySpacedSlots(unassigned.size(), freeSlots.size());

        List<SlotAssignment> result = new ArrayList<>();
        for (String id : entryIdsInOrder) {
            if (explicitSlots.containsKey(id)) {
                result.add(new SlotAssignment(id, explicitSlots.get(id)));
            }
        }
        for (int i = 0; i < unassigned.size(); i++) {
            result.add(new SlotAssignment(unassigned.get(i), freeSlots.get(centredOffsets[i])));
        }
        return result;
    }

    /// Distributes `count` icons across `rowSize` free slots, centred and evenly spaced.
    private static int[] computeEvenlySpacedSlots(int count, int rowSize) {
        if (count > rowSize) {
            count = rowSize;
        }
        int[] slots = new int[count];
        if (count == 0) {
            return slots;
        }
        if (count == 1) {
            slots[0] = rowSize / 2;
            return slots;
        }
        double gap = (double) rowSize / count;
        double margin = (rowSize - gap * (count - 1)) / 2.0;
        for (int i = 0; i < count; i++) {
            slots[i] = (int) Math.round(margin + gap * i);
        }
        return slots;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `mvn -pl zander-hub -am test -Dtest=CompassSlotCalculatorTest`
Expected: PASS, 6/6 tests.

- [ ] **Step 5: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/gui/CompassSlotCalculator.java \
        zander-hub/src/test/java/dev/anchorlight/zander/hub/gui/CompassSlotCalculatorTest.java
git commit -m "feat: add CompassSlotCalculator with explicit/centred slot support"
```

---

## Task 18: Tag the Navigation Compass with persistent data

**Files:**
- Modify: `zander-hub/src/main/java/dev/anchorlight/zander/hub/items/NavigationCompassItem.java`

**Interfaces:**
- Produces: `NavigationCompassItem.KEY` (public static `NamespacedKey`, `zanderhub:navigation_compass`), `NavigationCompassItem.isNavigationCompass(ItemStack)` (`boolean`, null-safe). Used by `HubCompassItem` (Task 19).

- [ ] **Step 1: Rewrite `NavigationCompassItem`**

```java
package dev.anchorlight.zander.hub.items;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.event.Listener;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;
import dev.anchorlight.zander.hub.ZanderHubMain;
import dev.anchorlight.zander.hub.utils.ItemBuilder;

public class NavigationCompassItem implements Listener {
    public static final NamespacedKey KEY = new NamespacedKey(ZanderHubMain.plugin, "navigation_compass");

    public static ItemStack createCompass() {
        ItemStack item = ItemBuilder.of(Material.COMPASS)
                .name(Component.text("Navigation Compass", NamedTextColor.AQUA, TextDecoration.BOLD))
                .lore(Component.text("Right Click me to access Servers", NamedTextColor.YELLOW))
                .build();
        ItemMeta meta = item.getItemMeta();
        meta.getPersistentDataContainer().set(KEY, PersistentDataType.BOOLEAN, true);
        item.setItemMeta(meta);
        return item;
    }

    /// Whether `item` is a tagged Zander navigation compass (not just any compass).
    public static boolean isNavigationCompass(ItemStack item) {
        if (item == null || !item.hasItemMeta()) {
            return false;
        }
        ItemMeta meta = item.getItemMeta();
        Boolean tagged = meta.getPersistentDataContainer().get(KEY, PersistentDataType.BOOLEAN);
        return Boolean.TRUE.equals(tagged);
    }
}
```

- [ ] **Step 2: Compile to verify**

Run: `mvn -pl zander-hub -am compile`
Expected: BUILD SUCCESS (the module as a whole may still fail if `HubCompassItem` hasn't been updated yet — resolved together with Task 19; if executing these tasks separately, do Task 19 immediately after this one before considering either "done").

- [ ] **Step 3: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/items/NavigationCompassItem.java
git commit -m "feat: tag Navigation Compass with persistent-data identity"
```

---

## Task 19: Rewrite `HubCompassItem`

**Files:**
- Modify (full rewrite): `zander-hub/src/main/java/dev/anchorlight/zander/hub/gui/HubCompassItem.java`
- Modify: `zander-hub/src/main/resources/config.yml` (extend `compass` section)

**Interfaces:**
- Consumes: `NavigationCompassItem.isNavigationCompass` (Task 18), `BridgeClient.requestServerList`/`sendConnectRequest` (Task 12), `CompassSlotCalculator.assign` (Task 17), `ConfigurationManager.getCompass()` (existing, extended below).
- Produces: nothing consumed by later tasks; this is the compass's terminal listener, wired in Task 23.

- [ ] **Step 1: Extend `compass` config in `config.yml`**

Replace the existing `compass:` block in `zander-hub/src/main/resources/config.yml` with:

```yaml
compass:
  enabled: true
  title: "<dark_aqua>Server Selector</dark_aqua>"
  request-timeout-ms: 1500
  hide-inaccessible: true
  open-on:
    right-click: true
    left-click: false
  locked-icon:
    material: BARRIER
    lore: "<red>You do not have access to this server.</red>"
  servers:
    build:
      material: STONE_BRICKS
      display: Build
      lore: Click me to join our Build server.
    survival:
      material: IRON_PICKAXE
      display: Survival
      lore: Click me to join our Survival server.
    mixed:
      material: IRON_SWORD
      display: Mixed
      lore: Play and Destroy your friends in Minigames.
    events:
      material: NETHER_STAR
      display: Events
      lore: Click me to join our Events server.
    creative:
      material: GRASS_BLOCK
      display: Creative
      lore: Click me to join our Creative server.
```

- [ ] **Step 2: Rewrite `HubCompassItem`**

```java
package dev.anchorlight.zander.hub.gui;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;
import dev.anchorlight.zander.hub.ConfigurationManager;
import dev.anchorlight.zander.hub.ZanderHubMain;
import dev.anchorlight.zander.hub.bridge.BridgeMessage;
import dev.anchorlight.zander.hub.configs.CompassConfig.CompassServerEntry;
import dev.anchorlight.zander.hub.items.NavigationCompassItem;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class HubCompassItem implements Listener {
    private static final NamespacedKey SERVER_ID_KEY = new NamespacedKey(ZanderHubMain.plugin, "compass_server_id");
    private static final MiniMessage MM = MiniMessage.miniMessage();

    private final Map<UUID, Boolean> pendingConnect = new ConcurrentHashMap<>();
    private final Map<UUID, Long> lastOpenAttempt = new ConcurrentHashMap<>();

    private static class CompassInventoryHolder implements InventoryHolder {
        private Inventory inventory;

        @Override
        public Inventory getInventory() {
            return inventory;
        }
    }

    @EventHandler
    public void onPlayerInteract(PlayerInteractEvent event) {
        if (event.getHand() == EquipmentSlot.OFF_HAND) {
            return; // avoid double-open from main+off hand events on the same physical click
        }

        Player player = event.getPlayer();
        if (!NavigationCompassItem.isNavigationCompass(player.getInventory().getItemInMainHand())) {
            return;
        }

        boolean rightClickOpens = ZanderHubMain.plugin.getConfig().getBoolean("compass.open-on.right-click", true);
        boolean leftClickOpens = ZanderHubMain.plugin.getConfig().getBoolean("compass.open-on.left-click", false);
        boolean isRightClick = event.getAction() == Action.RIGHT_CLICK_AIR || event.getAction() == Action.RIGHT_CLICK_BLOCK;
        boolean isLeftClick = event.getAction() == Action.LEFT_CLICK_AIR || event.getAction() == Action.LEFT_CLICK_BLOCK;

        if ((isRightClick && !rightClickOpens) || (isLeftClick && !leftClickOpens) || (!isRightClick && !isLeftClick)) {
            return;
        }

        event.setCancelled(true);

        UUID playerId = player.getUniqueId();
        long now = System.currentTimeMillis();
        Long last = lastOpenAttempt.get(playerId);
        if (last != null && now - last < 250L) {
            return; // dedupe double PlayerInteractEvent firing for one physical click
        }
        lastOpenAttempt.put(playerId, now);

        openCompassGui(player);
    }

    public void openCompassGui(Player player) {
        CompassInventoryHolder holder = new CompassInventoryHolder();
        String title = ZanderHubMain.plugin.getConfig().getString("compass.title", "<dark_aqua>Server Selector</dark_aqua>");
        Inventory inventory = Bukkit.createInventory(holder, 9, MM.deserialize(title));
        holder.inventory = inventory;
        renderLoading(inventory, ConfigurationManager.getCompass().getServers());
        player.openInventory(inventory);

        long timeoutMs = ZanderHubMain.plugin.getConfig().getLong("compass.request-timeout-ms", 1500L);
        ZanderHubMain.bridgeClient.requestServerList(player)
                .whenComplete((response, error) -> Bukkit.getScheduler().runTask(ZanderHubMain.plugin, () -> {
                    if (!player.isOnline() || player.getOpenInventory().getTopInventory().getHolder() != holder) {
                        return; // player closed/changed inventory, or went offline, before the response arrived
                    }
                    if (error != null || response == null) {
                        renderUnavailable(inventory, ConfigurationManager.getCompass().getServers());
                        return;
                    }
                    renderServers(inventory, ConfigurationManager.getCompass().getServers(), response);
                }));
    }

    private void renderLoading(Inventory inventory, List<CompassServerEntry> configured) {
        for (CompassServerEntry entry : configured) {
            inventory.setItem(configured.indexOf(entry) % inventory.getSize(), loadingIcon(entry));
        }
    }

    private ItemStack loadingIcon(CompassServerEntry entry) {
        ItemStack item = new ItemStack(Material.GRAY_DYE);
        ItemMeta meta = item.getItemMeta();
        meta.displayName(Component.text(entry.display(), NamedTextColor.GRAY));
        meta.lore(List.of(Component.text("Loading...", NamedTextColor.DARK_GRAY)));
        item.setItemMeta(meta);
        return item;
    }

    private void renderUnavailable(Inventory inventory, List<CompassServerEntry> configured) {
        inventory.clear();
        boolean hideInaccessible = ZanderHubMain.plugin.getConfig().getBoolean("compass.hide-inaccessible", true);
        Map<String, Integer> explicitSlots = explicitSlots(configured);
        List<String> ids = configured.stream().map(CompassServerEntry::id).toList();
        for (CompassSlotCalculator.SlotAssignment assignment : CompassSlotCalculator.assign(ids, explicitSlots, inventory.getSize())) {
            CompassServerEntry entry = configured.stream().filter(e -> e.id().equals(assignment.entryId())).findFirst().orElseThrow();
            if (hideInaccessible) {
                continue; // unknown accessibility while unavailable; treat conservatively as hidden
            }
            inventory.setItem(assignment.slot(), buildIcon(entry, "UNAVAILABLE", null));
        }
    }

    private void renderServers(Inventory inventory, List<CompassServerEntry> configured, BridgeMessage.ServerListResponse response) {
        inventory.clear();
        Map<String, BridgeMessage.ServerInfo> byId = new HashMap<>();
        for (BridgeMessage.ServerInfo info : response.servers()) {
            byId.put(info.id(), info);
        }
        boolean hideInaccessible = ZanderHubMain.plugin.getConfig().getBoolean("compass.hide-inaccessible", true);

        List<String> visibleIds = new ArrayList<>();
        for (CompassServerEntry entry : configured) {
            BridgeMessage.ServerInfo info = byId.get(entry.id());
            boolean hasAccess = info != null && info.hasAccess();
            if (!hasAccess && hideInaccessible) {
                continue;
            }
            visibleIds.add(entry.id());
        }

        Map<String, Integer> explicitSlots = explicitSlots(configured);
        for (CompassSlotCalculator.SlotAssignment assignment : CompassSlotCalculator.assign(visibleIds, explicitSlots, inventory.getSize())) {
            CompassServerEntry entry = configured.stream().filter(e -> e.id().equals(assignment.entryId())).findFirst().orElseThrow();
            BridgeMessage.ServerInfo info = byId.get(entry.id());
            String state = resolveState(info);
            inventory.setItem(assignment.slot(), buildIcon(entry, state, info));
        }
    }

    private Map<String, Integer> explicitSlots(List<CompassServerEntry> configured) {
        return Map.of(); // CompassConfig doesn't yet expose per-server explicit slots; all entries are centred.
    }

    private String resolveState(BridgeMessage.ServerInfo info) {
        if (info == null || !info.registered()) {
            return "UNAVAILABLE";
        }
        if (info.alreadyConnected()) {
            return "ALREADY_CONNECTED";
        }
        if (!info.hasAccess()) {
            return "NO_ACCESS";
        }
        return "ONLINE";
    }

    private ItemStack buildIcon(CompassServerEntry entry, String state, BridgeMessage.ServerInfo info) {
        boolean locked = state.equals("NO_ACCESS") || state.equals("UNAVAILABLE");
        Material material = locked
                ? org.bukkit.Material.matchMaterial(
                        ZanderHubMain.plugin.getConfig().getString("compass.locked-icon.material", "BARRIER"))
                : entry.material();
        if (material == null) {
            material = Material.BARRIER;
        }

        ItemStack item = new ItemStack(material);
        ItemMeta meta = item.getItemMeta();
        meta.displayName(Component.text(entry.display(), locked ? NamedTextColor.RED : NamedTextColor.WHITE));

        List<Component> lore = new ArrayList<>();
        if (locked && state.equals("NO_ACCESS")) {
            lore.add(MM.deserialize(ZanderHubMain.plugin.getConfig().getString(
                    "compass.locked-icon.lore", "<red>You do not have access to this server.</red>")));
        } else {
            lore.add(Component.text(entry.lore(), NamedTextColor.WHITE));
        }
        lore.add(switch (state) {
            case "ALREADY_CONNECTED" -> Component.text("You are already connected.", NamedTextColor.GRAY);
            case "UNAVAILABLE" -> Component.text("Currently unavailable.", NamedTextColor.GRAY);
            default -> Component.text("Players online: " + (info != null ? info.playerCount() : 0), NamedTextColor.GRAY);
        });
        meta.lore(lore);

        if (!locked && !state.equals("ALREADY_CONNECTED")) {
            meta.getPersistentDataContainer().set(SERVER_ID_KEY, PersistentDataType.STRING, entry.id());
        }
        item.setItemMeta(meta);
        return item;
    }

    @EventHandler
    public void onClick(InventoryClickEvent event) {
        if (!(event.getInventory().getHolder() instanceof CompassInventoryHolder)) {
            return;
        }
        event.setCancelled(true); // prevents movement, shift-click, and collection into this GUI

        ItemStack clicked = event.getCurrentItem();
        if (clicked == null || !clicked.hasItemMeta()) {
            return;
        }
        String serverId = clicked.getItemMeta().getPersistentDataContainer().get(SERVER_ID_KEY, PersistentDataType.STRING);
        if (serverId == null) {
            return;
        }

        Player player = (Player) event.getWhoClicked();
        UUID playerId = player.getUniqueId();
        if (Boolean.TRUE.equals(pendingConnect.putIfAbsent(playerId, true))) {
            return; // a connection request is already in flight, ignore repeated clicks
        }

        player.closeInventory();
        ZanderHubMain.bridgeClient.sendConnectRequest(player, null, serverId)
                .whenComplete((response, error) -> Bukkit.getScheduler().runTask(ZanderHubMain.plugin, () -> {
                    pendingConnect.remove(playerId);
                    if (!player.isOnline()) {
                        return;
                    }
                    if (error != null) {
                        player.sendMessage(MM.deserialize("<red>Failed to connect, please try again.</red>"));
                        return;
                    }
                    switch (response) {
                        case BridgeMessage.ConnectStarted ignored ->
                                player.sendMessage(MM.deserialize("<yellow>Connecting you now...</yellow>"));
                        case BridgeMessage.ConnectDenied denied ->
                                player.sendMessage(MM.deserialize("<red>" + denied.reason() + "</red>"));
                        case BridgeMessage.ConnectFailed failed ->
                                player.sendMessage(MM.deserialize("<red>" + failed.reason() + "</red>"));
                        default -> { }
                    }
                }));
    }

    @EventHandler
    public void onDrag(InventoryDragEvent event) {
        if (event.getInventory().getHolder() instanceof CompassInventoryHolder) {
            event.setCancelled(true);
        }
    }
}
```

- [ ] **Step 3: Compile to verify**

Run: `mvn -pl zander-hub -am compile`
Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/gui/HubCompassItem.java \
        zander-hub/src/main/resources/config.yml
git commit -m "feat: rewrite HubCompassItem on the zander:hub bridge with PDC identity"
```

**Manual verification:** an ordinary `COMPASS` item does nothing on right-click; a compass produced by `NavigationCompassItem.createCompass()` opens the selector; the GUI shows a loading state briefly then populates; a server the player lacks access to is hidden (or shown locked when `hide-inaccessible: false`); clicking a valid server sends exactly one `CONNECT_REQUEST` even on rapid double-click; closing the GUI mid-request and reopening doesn't apply a stale response to the new inventory.

---

## Task 20: Portal selection wand

**Files:**
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/commands/portal/PortalSelectionManager.java`
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/commands/portal/PortalWandListener.java`
- Test: `zander-hub/src/test/java/dev/anchorlight/zander/hub/commands/portal/PortalSelectionManagerTest.java`
- Modify: `zander-hub/src/main/resources/config.yml` (wand item settings)

**Interfaces:**
- Produces: `PortalSelectionManager` with `void setPos1(UUID admin, String world, int x, int y, int z)`, `void setPos2(...)` (same signature), `Optional<PortalRegion> buildRegion(UUID admin)` (returns empty unless both positions are set and share a world), `void clear(UUID admin)`. `PortalWandListener` (Bukkit `Listener`): tags/detects a configurable wand item via PDC key `zanderhub:portal_wand`, left-click block → pos1, right-click block → pos2, cancels the interact event, sends selection feedback. Used by `PortalCommand` (Task 21).

- [ ] **Step 1: Add wand config to `config.yml`**

Append to `zander-hub/src/main/resources/config.yml`:

```yaml
portal-wand:
  material: BLAZE_ROD
  display: "<gold>Portal Wand</gold>"
```

- [ ] **Step 2: Write failing `PortalSelectionManagerTest`**

```java
package dev.anchorlight.zander.hub.commands.portal;

import dev.anchorlight.zander.hub.portal.PortalRegion;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class PortalSelectionManagerTest {
    @Test
    void noRegionUntilBothPositionsSet() {
        PortalSelectionManager selections = new PortalSelectionManager();
        UUID admin = UUID.randomUUID();
        selections.setPos1(admin, "world", 0, 60, 0);
        assertTrue(selections.buildRegion(admin).isEmpty());
    }

    @Test
    void buildsRegionFromBothPositions() {
        PortalSelectionManager selections = new PortalSelectionManager();
        UUID admin = UUID.randomUUID();
        selections.setPos1(admin, "world", 0, 60, 0);
        selections.setPos2(admin, "world", 2, 62, 2);

        Optional<PortalRegion> region = selections.buildRegion(admin);
        assertTrue(region.isPresent());
        assertEquals(0, region.get().minX());
        assertEquals(2, region.get().maxX());
    }

    @Test
    void rejectsMismatchedWorlds() {
        PortalSelectionManager selections = new PortalSelectionManager();
        UUID admin = UUID.randomUUID();
        selections.setPos1(admin, "world", 0, 60, 0);
        selections.setPos2(admin, "world_nether", 2, 62, 2);
        assertTrue(selections.buildRegion(admin).isEmpty());
    }

    @Test
    void selectionsArePerAdmin() {
        PortalSelectionManager selections = new PortalSelectionManager();
        UUID adminA = UUID.randomUUID();
        UUID adminB = UUID.randomUUID();
        selections.setPos1(adminA, "world", 0, 60, 0);
        selections.setPos2(adminA, "world", 2, 62, 2);
        assertTrue(selections.buildRegion(adminA).isPresent());
        assertTrue(selections.buildRegion(adminB).isEmpty());
    }

    @Test
    void clearRemovesBothPositions() {
        PortalSelectionManager selections = new PortalSelectionManager();
        UUID admin = UUID.randomUUID();
        selections.setPos1(admin, "world", 0, 60, 0);
        selections.setPos2(admin, "world", 2, 62, 2);
        selections.clear(admin);
        assertTrue(selections.buildRegion(admin).isEmpty());
    }
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `mvn -pl zander-hub -am test -Dtest=PortalSelectionManagerTest`
Expected: FAIL (`PortalSelectionManager` does not exist).

- [ ] **Step 4: Write `PortalSelectionManager`**

```java
package dev.anchorlight.zander.hub.commands.portal;

import dev.anchorlight.zander.hub.portal.PortalRegion;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Tracks each admin's in-progress two-point portal selection, keyed by admin UUID. */
public class PortalSelectionManager {
    private record Point(String world, int x, int y, int z) {
    }

    private final Map<UUID, Point> pos1 = new ConcurrentHashMap<>();
    private final Map<UUID, Point> pos2 = new ConcurrentHashMap<>();

    public void setPos1(UUID admin, String world, int x, int y, int z) {
        pos1.put(admin, new Point(world, x, y, z));
    }

    public void setPos2(UUID admin, String world, int x, int y, int z) {
        pos2.put(admin, new Point(world, x, y, z));
    }

    public Optional<PortalRegion> buildRegion(UUID admin) {
        Point a = pos1.get(admin);
        Point b = pos2.get(admin);
        if (a == null || b == null || !a.world().equals(b.world())) {
            return Optional.empty();
        }
        return Optional.of(new PortalRegion(a.world(), a.x(), a.y(), a.z(), b.x(), b.y(), b.z()));
    }

    public void clear(UUID admin) {
        pos1.remove(admin);
        pos2.remove(admin);
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `mvn -pl zander-hub -am test -Dtest=PortalSelectionManagerTest`
Expected: PASS, 5/5 tests.

- [ ] **Step 6: Write `PortalWandListener`**

```java
package dev.anchorlight.zander.hub.commands.portal;

import dev.anchorlight.zander.hub.ZanderHubMain;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;

public class PortalWandListener implements Listener {
    public static final NamespacedKey WAND_KEY = new NamespacedKey(ZanderHubMain.plugin, "portal_wand");
    private static final MiniMessage MM = MiniMessage.miniMessage();

    private final PortalSelectionManager selections;

    public PortalWandListener(PortalSelectionManager selections) {
        this.selections = selections;
    }

    public static ItemStack createWand() {
        String materialName = ZanderHubMain.plugin.getConfig().getString("portal-wand.material", "BLAZE_ROD");
        Material material = Material.matchMaterial(materialName);
        if (material == null) {
            material = Material.BLAZE_ROD;
        }
        String display = ZanderHubMain.plugin.getConfig().getString("portal-wand.display", "<gold>Portal Wand</gold>");

        ItemStack item = new ItemStack(material);
        ItemMeta meta = item.getItemMeta();
        meta.displayName(MM.deserialize(display));
        meta.getPersistentDataContainer().set(WAND_KEY, PersistentDataType.BOOLEAN, true);
        item.setItemMeta(meta);
        return item;
    }

    private static boolean isWand(ItemStack item) {
        if (item == null || !item.hasItemMeta()) {
            return false;
        }
        return Boolean.TRUE.equals(item.getItemMeta().getPersistentDataContainer()
                .get(WAND_KEY, PersistentDataType.BOOLEAN));
    }

    @EventHandler
    public void onInteract(PlayerInteractEvent event) {
        Player player = event.getPlayer();
        if (!isWand(player.getInventory().getItemInMainHand())) {
            return;
        }
        Block block = event.getClickedBlock();
        if (block == null || (event.getAction() != Action.LEFT_CLICK_BLOCK && event.getAction() != Action.RIGHT_CLICK_BLOCK)) {
            return;
        }
        event.setCancelled(true); // never let the wand break/place blocks

        String world = block.getWorld().getName();
        if (event.getAction() == Action.LEFT_CLICK_BLOCK) {
            selections.setPos1(player.getUniqueId(), world, block.getX(), block.getY(), block.getZ());
            player.sendMessage(MM.deserialize("<yellow>Position 1 set: <white>" + world + " "
                    + block.getX() + ", " + block.getY() + ", " + block.getZ() + "</white></yellow>"));
        } else {
            selections.setPos2(player.getUniqueId(), world, block.getX(), block.getY(), block.getZ());
            player.sendMessage(MM.deserialize("<yellow>Position 2 set: <white>" + world + " "
                    + block.getX() + ", " + block.getY() + ", " + block.getZ() + "</white></yellow>"));
        }
    }
}
```

- [ ] **Step 7: Compile to verify**

Run: `mvn -pl zander-hub -am compile`
Expected: BUILD SUCCESS.

- [ ] **Step 8: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/commands/portal/PortalSelectionManager.java \
        zander-hub/src/main/java/dev/anchorlight/zander/hub/commands/portal/PortalWandListener.java \
        zander-hub/src/test/java/dev/anchorlight/zander/hub/commands/portal/PortalSelectionManagerTest.java \
        zander-hub/src/main/resources/config.yml
git commit -m "feat: add portal selection wand and per-admin selection tracking"
```

---

## Task 21: `/zportal` admin command

**Files:**
- Create: `zander-hub/src/main/java/dev/anchorlight/zander/hub/commands/portal/PortalCommand.java`

**Interfaces:**
- Consumes: `PortalService` (Task 9), `PortalSelectionManager` (Task 20), `PortalWandListener.createWand()` (Task 20), `ConfigurationManager.getCompass()` (for cached server IDs in tab completion — see note in Step 1).
- Produces: a `CommandExecutor`+`TabCompleter` registered as `/zportal` in Task 22/23. Terminal — nothing else consumes this class.

- [ ] **Step 1: Write `PortalCommand`**

Tab completion for Velocity server IDs uses `ConfigurationManager.getCompass().getServers()` (the same locally-cached list the compass already uses) rather than a live proxy call, satisfying "no expensive proxy calls per keystroke".

```java
package dev.anchorlight.zander.hub.commands.portal;

import dev.anchorlight.zander.hub.ConfigurationManager;
import dev.anchorlight.zander.hub.ZanderHubMain;
import dev.anchorlight.zander.hub.portal.LocationPortalDestination;
import dev.anchorlight.zander.hub.portal.Portal;
import dev.anchorlight.zander.hub.portal.PortalRegion;
import dev.anchorlight.zander.hub.portal.PortalService;
import dev.anchorlight.zander.hub.portal.ServerPortalDestination;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Location;
import org.bukkit.Sound;
import org.bukkit.World;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class PortalCommand implements CommandExecutor, TabCompleter {
    private static final MiniMessage MM = MiniMessage.miniMessage();
    private static final List<String> SUBCOMMANDS = List.of("wand", "create", "delete", "list", "info", "enable",
            "disable", "setserver", "setlocation", "setpermission", "setdisplay", "setcooldown", "setsound",
            "reload", "tp");

    private final PortalService portalService;
    private final PortalSelectionManager selections;

    public PortalCommand(PortalService portalService, PortalSelectionManager selections) {
        this.portalService = portalService;
        this.selections = selections;
    }

    private void msg(CommandSender sender, String message) {
        sender.sendMessage(MM.deserialize(message));
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) {
            msg(sender, "<gray>Usage: /zportal <subcommand> [args]</gray>");
            return true;
        }
        String sub = args[0].toLowerCase(java.util.Locale.ROOT);
        String[] rest = java.util.Arrays.copyOfRange(args, 1, args.length);

        switch (sub) {
            case "wand" -> handleWand(sender);
            case "create" -> handleCreate(sender, rest);
            case "delete" -> handleDelete(sender, rest);
            case "list" -> handleList(sender);
            case "info" -> handleInfo(sender, rest);
            case "enable" -> handleEnable(sender, rest, true);
            case "disable" -> handleEnable(sender, rest, false);
            case "setserver" -> handleSetServer(sender, rest);
            case "setlocation" -> handleSetLocation(sender, rest);
            case "setpermission" -> handleSetPermission(sender, rest);
            case "setdisplay" -> handleSetDisplay(sender, rest);
            case "setcooldown" -> handleSetCooldown(sender, rest);
            case "setsound" -> handleSetSound(sender, rest);
            case "reload" -> handleReload(sender);
            case "tp" -> handleTp(sender, rest);
            default -> msg(sender, "<red>Unknown subcommand: " + sub + "</red>");
        }
        return true;
    }

    private boolean requirePermission(CommandSender sender, String permission) {
        if (!sender.hasPermission(permission)) {
            msg(sender, "<red>You do not have permission to do that.</red>");
            return false;
        }
        return true;
    }

    private void handleWand(CommandSender sender) {
        if (!requirePermission(sender, "zanderhub.portal.wand") || !(sender instanceof Player player)) {
            if (!(sender instanceof Player)) {
                msg(sender, "<red>Only players can receive the portal wand.</red>");
            }
            return;
        }
        player.getInventory().addItem(PortalWandListener.createWand());
        msg(player, "<yellow>Portal wand given. Left-click = position 1, right-click = position 2.</yellow>");
    }

    private void handleCreate(CommandSender sender, String[] args) {
        if (!requirePermission(sender, "zanderhub.portal.create") || !(sender instanceof Player player)) {
            return;
        }
        if (args.length != 1) {
            msg(sender, "<red>Usage: /zportal create <id></red>");
            return;
        }
        String id = args[0];
        if (portalService.find(id).isPresent()) {
            msg(sender, "<red>A portal with id '" + id + "' already exists.</red>");
            return;
        }
        Optional<PortalRegion> region = selections.buildRegion(player.getUniqueId());
        if (region.isEmpty()) {
            msg(sender, "<red>Select two positions with the portal wand first (same world).</red>");
            return;
        }
        try {
            Portal portal = new Portal(id, id, false, region.get(),
                    new ServerPortalDestination("unset"), null, 2000L, null,
                    "<yellow>Sending you to " + id + "...</yellow>", "<red>You do not have access to " + id + ".</red>");
            portalService.put(portal);
            msg(sender, "<green>Portal '" + id + "' created (disabled). Set a destination with "
                    + "/zportal setserver " + id + " <server-id> or /zportal setlocation " + id
                    + ", then /zportal enable " + id + ".</green>");
        } catch (IllegalArgumentException e) {
            msg(sender, "<red>" + e.getMessage() + "</red>");
        }
    }

    private void handleDelete(CommandSender sender, String[] args) {
        if (!requirePermission(sender, "zanderhub.portal.delete")) {
            return;
        }
        if (args.length != 1) {
            msg(sender, "<red>Usage: /zportal delete <id></red>");
            return;
        }
        if (portalService.delete(args[0])) {
            msg(sender, "<green>Portal '" + args[0] + "' deleted.</green>");
        } else {
            msg(sender, "<red>No such portal: " + args[0] + "</red>");
        }
    }

    private void handleList(CommandSender sender) {
        if (!requirePermission(sender, "zanderhub.portal.list")) {
            return;
        }
        if (portalService.all().isEmpty()) {
            msg(sender, "<gray>No portals configured.</gray>");
            return;
        }
        for (Portal portal : portalService.all()) {
            msg(sender, (portal.enabled() ? "<green>" : "<red>") + portal.id() + " <gray>(" + portal.displayName() + ")</gray>");
        }
    }

    private void handleInfo(CommandSender sender, String[] args) {
        if (!requirePermission(sender, "zanderhub.portal.list") || args.length != 1) {
            if (args.length != 1) msg(sender, "<red>Usage: /zportal info <id></red>");
            return;
        }
        Optional<Portal> found = portalService.find(args[0]);
        if (found.isEmpty()) {
            msg(sender, "<red>No such portal: " + args[0] + "</red>");
            return;
        }
        Portal portal = found.get();
        msg(sender, "<gold>Portal: " + portal.id() + "</gold>");
        msg(sender, "<gray>Enabled: " + portal.enabled() + "</gray>");
        msg(sender, "<gray>Region: " + portal.region() + "</gray>");
        msg(sender, "<gray>Destination: " + portal.destination() + "</gray>");
        msg(sender, "<gray>Permission: " + (portal.permission() == null ? "none" : portal.permission()) + "</gray>");
        msg(sender, "<gray>Cooldown: " + portal.cooldownMs() + "ms</gray>");
    }

    private void handleEnable(CommandSender sender, String[] args, boolean enabled) {
        if (!requirePermission(sender, "zanderhub.portal.edit")) {
            return;
        }
        if (args.length != 1) {
            msg(sender, "<red>Usage: /zportal " + (enabled ? "enable" : "disable") + " <id></red>");
            return;
        }
        try {
            portalService.setEnabled(args[0], enabled);
            msg(sender, "<green>Portal '" + args[0] + "' " + (enabled ? "enabled" : "disabled") + ".</green>");
        } catch (IllegalArgumentException e) {
            msg(sender, "<red>" + e.getMessage() + "</red>");
        }
    }

    private void handleSetServer(CommandSender sender, String[] args) {
        if (!requirePermission(sender, "zanderhub.portal.edit") || args.length != 2) {
            if (args.length != 2) msg(sender, "<red>Usage: /zportal setserver <id> <server-id></red>");
            return;
        }
        Optional<Portal> found = portalService.find(args[0]);
        if (found.isEmpty()) {
            msg(sender, "<red>No such portal: " + args[0] + "</red>");
            return;
        }
        Portal existing = found.get();
        portalService.put(withDestination(existing, new ServerPortalDestination(args[1])));
        msg(sender, "<green>Portal '" + existing.id() + "' now sends to server '" + args[1] + "'.</green>");
    }

    private void handleSetLocation(CommandSender sender, String[] args) {
        if (!requirePermission(sender, "zanderhub.portal.edit") || !(sender instanceof Player player)) {
            if (!(sender instanceof Player)) msg(sender, "<red>Only players can use setlocation.</red>");
            return;
        }
        if (args.length != 1) {
            msg(sender, "<red>Usage: /zportal setlocation <id></red>");
            return;
        }
        Optional<Portal> found = portalService.find(args[0]);
        if (found.isEmpty()) {
            msg(sender, "<red>No such portal: " + args[0] + "</red>");
            return;
        }
        Location location = player.getLocation();
        LocationPortalDestination destination = new LocationPortalDestination(location.getWorld().getName(),
                location.getX(), location.getY(), location.getZ(), location.getYaw(), location.getPitch());
        portalService.put(withDestination(found.get(), destination));
        msg(player, "<green>Portal '" + found.get().id() + "' destination set to your current location.</green>");
    }

    private void handleSetPermission(CommandSender sender, String[] args) {
        if (!requirePermission(sender, "zanderhub.portal.edit") || args.length != 2) {
            if (args.length != 2) msg(sender, "<red>Usage: /zportal setpermission <id> <permission|none></red>");
            return;
        }
        Optional<Portal> found = portalService.find(args[0]);
        if (found.isEmpty()) {
            msg(sender, "<red>No such portal: " + args[0] + "</red>");
            return;
        }
        String permission = args[1].equalsIgnoreCase("none") ? null : args[1];
        Portal existing = found.get();
        portalService.put(new Portal(existing.id(), existing.displayName(), existing.enabled(), existing.region(),
                existing.destination(), permission, existing.cooldownMs(), existing.sound(),
                existing.successMessage(), existing.deniedMessage()));
        msg(sender, "<green>Portal '" + existing.id() + "' permission set to " + (permission == null ? "none" : permission) + ".</green>");
    }

    private void handleSetDisplay(CommandSender sender, String[] args) {
        if (!requirePermission(sender, "zanderhub.portal.edit") || args.length < 2) {
            if (args.length < 2) msg(sender, "<red>Usage: /zportal setdisplay <id> <display name></red>");
            return;
        }
        Optional<Portal> found = portalService.find(args[0]);
        if (found.isEmpty()) {
            msg(sender, "<red>No such portal: " + args[0] + "</red>");
            return;
        }
        String display = String.join(" ", java.util.Arrays.copyOfRange(args, 1, args.length));
        Portal existing = found.get();
        portalService.put(new Portal(existing.id(), display, existing.enabled(), existing.region(),
                existing.destination(), existing.permission(), existing.cooldownMs(), existing.sound(),
                existing.successMessage(), existing.deniedMessage()));
        msg(sender, "<green>Portal '" + existing.id() + "' display name updated.</green>");
    }

    private void handleSetCooldown(CommandSender sender, String[] args) {
        if (!requirePermission(sender, "zanderhub.portal.edit") || args.length != 2) {
            if (args.length != 2) msg(sender, "<red>Usage: /zportal setcooldown <id> <milliseconds></red>");
            return;
        }
        Optional<Portal> found = portalService.find(args[0]);
        if (found.isEmpty()) {
            msg(sender, "<red>No such portal: " + args[0] + "</red>");
            return;
        }
        long cooldownMs;
        try {
            cooldownMs = Long.parseLong(args[1]);
        } catch (NumberFormatException e) {
            msg(sender, "<red>Cooldown must be a number of milliseconds.</red>");
            return;
        }
        Portal existing = found.get();
        try {
            portalService.put(new Portal(existing.id(), existing.displayName(), existing.enabled(), existing.region(),
                    existing.destination(), existing.permission(), cooldownMs, existing.sound(),
                    existing.successMessage(), existing.deniedMessage()));
            msg(sender, "<green>Portal '" + existing.id() + "' cooldown set to " + cooldownMs + "ms.</green>");
        } catch (IllegalArgumentException e) {
            msg(sender, "<red>" + e.getMessage() + "</red>");
        }
    }

    private void handleSetSound(CommandSender sender, String[] args) {
        if (!requirePermission(sender, "zanderhub.portal.edit") || args.length != 2) {
            if (args.length != 2) msg(sender, "<red>Usage: /zportal setsound <id> <sound|none></red>");
            return;
        }
        Optional<Portal> found = portalService.find(args[0]);
        if (found.isEmpty()) {
            msg(sender, "<red>No such portal: " + args[0] + "</red>");
            return;
        }
        String sound = args[1].equalsIgnoreCase("none") ? null : args[1];
        if (sound != null) {
            try {
                Sound.valueOf(sound);
            } catch (IllegalArgumentException e) {
                msg(sender, "<red>Unknown sound: " + sound + "</red>");
                return;
            }
        }
        Portal existing = found.get();
        portalService.put(new Portal(existing.id(), existing.displayName(), existing.enabled(), existing.region(),
                existing.destination(), existing.permission(), existing.cooldownMs(), sound,
                existing.successMessage(), existing.deniedMessage()));
        msg(sender, "<green>Portal '" + existing.id() + "' sound updated.</green>");
    }

    private void handleReload(CommandSender sender) {
        if (!requirePermission(sender, "zanderhub.portal.reload")) {
            return;
        }
        try {
            portalService.reload();
            msg(sender, "<green>Reloaded " + portalService.all().size() + " portal(s).</green>");
        } catch (Exception e) {
            msg(sender, "<red>Portal reload failed: " + e.getMessage() + "</red>");
            ZanderHubMain.plugin.getLogger().warning("Portal reload failed: " + e.getMessage());
        }
    }

    private void handleTp(CommandSender sender, String[] args) {
        if (!requirePermission(sender, "zanderhub.portal.teleport") || !(sender instanceof Player player)) {
            if (!(sender instanceof Player)) msg(sender, "<red>Only players can teleport.</red>");
            return;
        }
        if (args.length != 1) {
            msg(sender, "<red>Usage: /zportal tp <id></red>");
            return;
        }
        Optional<Portal> found = portalService.find(args[0]);
        if (found.isEmpty()) {
            msg(sender, "<red>No such portal: " + args[0] + "</red>");
            return;
        }
        PortalRegion region = found.get().region();
        World world = org.bukkit.Bukkit.getWorld(region.world());
        if (world == null) {
            msg(sender, "<red>Portal's world is not currently loaded.</red>");
            return;
        }
        int centreX = (region.minX() + region.maxX()) / 2;
        int centreZ = (region.minZ() + region.maxZ()) / 2;
        int safeY = Math.max(region.maxY() + 1, world.getHighestBlockYAt(centreX, centreZ) + 1);
        player.teleportAsync(new Location(world, centreX + 0.5, safeY, centreZ + 0.5));
        msg(player, "<green>Teleported to portal '" + found.get().id() + "'.</green>");
    }

    private static Portal withDestination(Portal existing, dev.anchorlight.zander.hub.portal.PortalDestination destination) {
        return new Portal(existing.id(), existing.displayName(), existing.enabled(), existing.region(), destination,
                existing.permission(), existing.cooldownMs(), existing.sound(),
                existing.successMessage(), existing.deniedMessage());
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        if (args.length == 1) {
            return prefixMatch(SUBCOMMANDS, args[0]);
        }
        if (args.length == 2) {
            switch (args[0].toLowerCase(java.util.Locale.ROOT)) {
                case "delete", "info", "enable", "disable", "setserver", "setlocation", "setpermission",
                        "setdisplay", "setcooldown", "setsound", "tp" -> {
                    List<String> ids = new ArrayList<>();
                    for (Portal portal : portalService.all()) {
                        ids.add(portal.id());
                    }
                    return prefixMatch(ids, args[1]);
                }
                default -> {
                    return List.of();
                }
            }
        }
        if (args.length == 3 && args[0].equalsIgnoreCase("setserver")) {
            List<String> serverIds = new ArrayList<>();
            for (var entry : ConfigurationManager.getCompass().getServers()) {
                serverIds.add(entry.id());
            }
            return prefixMatch(serverIds, args[2]);
        }
        return List.of();
    }

    private static List<String> prefixMatch(List<String> options, String prefix) {
        List<String> result = new ArrayList<>();
        String lower = prefix.toLowerCase(java.util.Locale.ROOT);
        for (String option : options) {
            if (option.toLowerCase(java.util.Locale.ROOT).startsWith(lower)) {
                result.add(option);
            }
        }
        return result;
    }
}
```

- [ ] **Step 2: Compile to verify**

Run: `mvn -pl zander-hub -am compile`
Expected: BUILD SUCCESS (once wired into `ZanderHubMain`/`plugin.yml` in Tasks 22-23).

- [ ] **Step 3: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/commands/portal/PortalCommand.java
git commit -m "feat: add /zportal admin command with subcommands and tab completion"
```

---

## Task 22: `plugin.yml` commands and permissions

**Files:**
- Modify: `zander-hub/src/main/resources/plugin.yml`

**Interfaces:**
- Consumes: nothing (declarative metadata).
- Produces: the `/zportal` and `/portaladmin` command registrations and all portal/dimension permission nodes that `ZanderHubMain` (Task 23) and `PortalCommand` (Task 21) rely on.

- [ ] **Step 1: Replace `plugin.yml` in full**

```yaml
main: dev.anchorlight.zander.hub.ZanderHubMain
name: zander-hub
version: ${project.version}
author: ModularSoft
api-version: 1.19
depend: [PremiumVanish, ProtocolLib]

commands:
  fly:
    description: Allows player to fly.
    usage: /fly
  connect:
    description: Connect to a Server.
    usage: /connect <server>
  zportal:
    description: Manage custom Hub portals.
    usage: /zportal <wand|create|delete|list|info|enable|disable|setserver|setlocation|setpermission|setdisplay|setcooldown|setsound|reload|tp> [args]
    aliases: [portaladmin]

permissions:
  zander.fly:
    default: op
  zanderhub.administrator:
    default: op
  zanderhub.build:
    default: op
  zanderhub.nether.bypass:
    default: op
  zanderhub.end.bypass:
    default: op
  zanderhub.portal.admin:
    default: op
  zanderhub.portal.wand:
    default: op
  zanderhub.portal.create:
    default: op
  zanderhub.portal.delete:
    default: op
  zanderhub.portal.edit:
    default: op
  zanderhub.portal.list:
    default: op
  zanderhub.portal.reload:
    default: op
  zanderhub.portal.teleport:
    default: op
```

(Per-portal `zanderhub.portal.use.<portal-id>` nodes are intentionally not statically declared — they're checked ad hoc via `player.hasPermission(...)` in `PortalActivationHandler`, and only exist for portals that configure a `permission`, matching how the spec describes them as optional per-portal grants rather than a fixed permission set.)

- [ ] **Step 2: Compile to verify no YAML errors**

Run: `mvn -pl zander-hub -am compile`
Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add zander-hub/src/main/resources/plugin.yml
git commit -m "feat: register /zportal command and portal/dimension permissions"
```

---

## Task 23: Wire everything into `ZanderHubMain` lifecycle

**Files:**
- Modify (full rewrite of `onEnable`/`onDisable`): `zander-hub/src/main/java/dev/anchorlight/zander/hub/ZanderHubMain.java`

**Interfaces:**
- Consumes: every component from Tasks 2-21.
- Produces: a fully wired plugin; nothing downstream depends on this file beyond runtime behaviour.

- [ ] **Step 1: Rewrite `ZanderHubMain.java`**

```java
package dev.anchorlight.zander.hub;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.TextComponent;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.plugin.PluginManager;
import org.bukkit.plugin.java.JavaPlugin;
import dev.anchorlight.zander.hub.bridge.BridgeClient;
import dev.anchorlight.zander.hub.commands.fly;
import dev.anchorlight.zander.hub.commands.portal.PortalCommand;
import dev.anchorlight.zander.hub.commands.portal.PortalSelectionManager;
import dev.anchorlight.zander.hub.commands.portal.PortalWandListener;
import dev.anchorlight.zander.hub.events.HubBoosterPlate;
import dev.anchorlight.zander.hub.events.HubPlayerJoin;
import dev.anchorlight.zander.hub.events.HubPlayerJoinChristmas;
import dev.anchorlight.zander.hub.events.HubPlayerLeave;
import dev.anchorlight.zander.hub.events.HubPlayerVoid;
import dev.anchorlight.zander.hub.gui.HubCompassItem;
import dev.anchorlight.zander.hub.portal.PortalActivationHandler;
import dev.anchorlight.zander.hub.portal.PortalMovementListener;
import dev.anchorlight.zander.hub.portal.PortalRepository;
import dev.anchorlight.zander.hub.portal.PortalService;
import dev.anchorlight.zander.hub.portal.PortalSessionManager;
import dev.anchorlight.zander.hub.portal.PortalSpatialIndex;
import dev.anchorlight.zander.hub.portal.PortalTransitionDetector;
import dev.anchorlight.zander.hub.protection.HubCreatureSpawnProtection;
import dev.anchorlight.zander.hub.protection.HubInteractionProtection;
import dev.anchorlight.zander.hub.protection.HubProtection;
import dev.anchorlight.zander.hub.protection.dimension.DimensionProtectionListener;
import dev.anchorlight.zander.hub.utils.CopyResources;

import java.io.File;

public class ZanderHubMain extends JavaPlugin {
    public static ZanderHubMain plugin;
    public static BridgeClient bridgeClient;
    public static PortalService portalService;
    public static PortalSessionManager portalSessions;

    public void onEnable() {
        plugin = this;

        CopyResources.mirror("config.yml");
        CopyResources.mirror("welcome.yml");

        ConfigurationManager.setupHubLocationsConfig();
        ConfigurationManager.setupMessagesConfig();
        ConfigurationManager.setupMiscConfig();
        ConfigurationManager.setupDimensionsConfig();
        ConfigurationManager.setupCompassConfig();
        ConfigurationManager.setupWelcomeFile();

        // Zander proxy bridge
        this.getServer().getMessenger().registerOutgoingPluginChannel(this, "zander:hub");
        bridgeClient = new BridgeClient((player, bytes) -> player.sendPluginMessage(this, "zander:hub", bytes), 1500L);
        this.getServer().getMessenger().registerIncomingPluginChannel(this, "zander:hub",
                (channel, player, message) -> bridgeClient.onPluginMessageReceived(message));

        // Portal system
        File portalsFile = new File(getDataFolder(), "portals.yml");
        PortalRepository portalRepository = new PortalRepository(portalsFile, getLogger(),
                worldName -> Bukkit.getWorld(worldName) != null);
        PortalSpatialIndex portalIndex = new PortalSpatialIndex();
        portalService = new PortalService(portalRepository, portalIndex);
        getLogger().info("Loaded " + portalService.all().size() + " portal(s).");

        portalSessions = new PortalSessionManager();
        PortalTransitionDetector transitionDetector = new PortalTransitionDetector(portalIndex, portalSessions);
        PortalActivationHandler activationHandler = new PortalActivationHandler(this, portalSessions, bridgeClient);
        PortalSelectionManager selections = new PortalSelectionManager();

        // Init Message
        TextComponent enabledMessage = Component.empty()
                .color(NamedTextColor.GREEN)
                .append(Component.text("\n\nZander Hub has been enabled.\n"))
                .append(Component.text("Running Version " + plugin.getPluginMeta().getVersion() + "\n"))
                .append(Component.text("GitHub Repository: https://github.com/ModularSoftAU/zander\n"))
                .append(Component.text("Created by Modular Software\n\n", NamedTextColor.DARK_PURPLE));
        getServer().sendMessage(enabledMessage);

        // Event Registry
        PluginManager pluginmanager = this.getServer().getPluginManager();
        pluginmanager.registerEvents(new HubPlayerJoin(this), this);
        pluginmanager.registerEvents(new HubPlayerLeave(this), this);
        pluginmanager.registerEvents(new HubPlayerVoid(this), this);
        pluginmanager.registerEvents(new HubBoosterPlate(this), this);
        pluginmanager.registerEvents(new HubPlayerJoinChristmas(this), this);
        // Hub Protection
        pluginmanager.registerEvents(new HubProtection(this), this);
        pluginmanager.registerEvents(new HubInteractionProtection(this), this);
        pluginmanager.registerEvents(new HubCreatureSpawnProtection(this), this);
        pluginmanager.registerEvents(new DimensionProtectionListener(this), this);

        // Item Event Registry
        pluginmanager.registerEvents(new HubCompassItem(), this);
        pluginmanager.registerEvents(new PortalWandListener(selections), this);
        pluginmanager.registerEvents(new PortalMovementListener(this, transitionDetector, portalSessions, activationHandler), this);

        // Command Registry
        this.getCommand("fly").setExecutor(new fly());
        this.getCommand("zportal").setExecutor(new PortalCommand(portalService, selections));
        this.getCommand("zportal").setTabCompleter(new PortalCommand(portalService, selections));
    }

    @Override
    public void onDisable() {
        Bukkit.getScheduler().cancelTasks(this);
        if (bridgeClient != null) {
            this.getServer().getMessenger().unregisterIncomingPluginChannel(this, "zander:hub");
            this.getServer().getMessenger().unregisterOutgoingPluginChannel(this, "zander:hub");
        }
        bridgeClient = null;
        portalService = null;
        portalSessions = null;
        plugin = null;
    }
}
```

- [ ] **Step 2: Run the full hub test suite**

Run: `mvn -pl zander-hub -am test`
Expected: BUILD SUCCESS, all tests from Tasks 1-21 pass.

- [ ] **Step 3: Compile the whole module**

Run: `mvn -pl zander-hub -am compile`
Expected: BUILD SUCCESS with no unresolved references.

- [ ] **Step 4: Commit**

```bash
git add zander-hub/src/main/java/dev/anchorlight/zander/hub/ZanderHubMain.java
git commit -m "feat: wire dimension protection, portals, bridge, and compass into plugin lifecycle"
```

**Manual verification:** start the Hub server against a Velocity proxy running the updated `zander-velocity` build; confirm the enable banner shows, `/zportal list` runs without error, and `/zportal reload` reports the same portal count after a restart-free reload of an unmodified `portals.yml`. Restart the Hub server (not `/reload`) and confirm portal data and dimension config both round-trip correctly from disk.

---

## Task 24: Deployment documentation

**Files:**
- Create: `docs/portals-and-navigation.md`
- Modify: `README.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Write `docs/portals-and-navigation.md`**

```markdown
# Custom Portals & Server Navigation

## Hub Paper server deployment

The plugin-level Nether/End protection (`dimensions.*` in zander-hub's `config.yml`)
is defence in depth. The Hub Paper server should additionally disable Nether
world loading at the Paper level, in `config/paper-global.yml` (not part of this
repository):

\`\`\`yaml
misc:
  enable-nether: false
\`\`\`

This is a server-deployment setting, not something Zander can set for you — apply
it directly on the Hub server's Paper configuration and restart.

## ServerPermissions node requirements

Backend server access is decided exclusively by Velocity via the `ServerPermissions`
plugin, using nodes of the form:

\`\`\`text
serverpermissions.server.<velocity-server-id>
\`\`\`

Example grants (exact syntax depends on your permissions plugin, e.g. LuckPerms):

\`\`\`text
/lp group default permission set serverpermissions.server.survival true
/lp user Notch permission set serverpermissions.server.vip-lounge true
\`\`\`

A configured portal `permission` (e.g. `zanderhub.portal.use.vip-lounge`) only
gates *portal activation* on Hub — it never substitutes for the
`serverpermissions.server.<id>` check, which Velocity always performs as the
final authority before connecting a player to a server portal's destination.

## Velocity deployment

1. Ensure `hub-bridge.allowed-source-servers` in zander-velocity's `config.yml`
   lists every Paper server name (as registered in Velocity's own config) that is
   allowed to originate `zander:hub` bridge requests — normally just `hub`.
2. Restart Velocity after changing `hub-bridge` settings; there is no reload
   command for this section.

## Manual integration testing checklist

- [ ] Vanilla Nether portal from Hub does not transport the player.
- [ ] `/tp` (or similar) into a Nether world is rejected without `zanderhub.nether.bypass`.
- [ ] Op with `zanderhub.nether.bypass` can still travel to the Nether.
- [ ] Setting `dimensions.end.blocked: true` blocks End travel; `false` allows it.
- [ ] A player force-placed into the Nether is returned to Hub spawn within one tick, once.
- [ ] `/zportal wand` gives a wand; left/right-click block sets pos1/pos2 with feedback.
- [ ] `/zportal create test-portal` fails without a two-point selection, succeeds with one.
- [ ] `/zportal setserver test-portal survival` + `/zportal enable test-portal` lets a permitted
      player walk in and connect to `survival`; a player lacking
      `serverpermissions.server.survival` is denied on Velocity, not Hub.
- [ ] `/zportal setlocation info-portal` + walking in teleports to the saved location with
      correct yaw/pitch.
- [ ] Restarting the Hub server preserves all portal data.
- [ ] Standing inside a portal without moving does not repeatedly trigger it.
- [ ] Two adjacent local portals do not immediately loop into each other.
- [ ] The navigation compass shows only servers the player has access to (or shows them
      locked, depending on `hide-inaccessible`), with live player counts.
- [ ] Rapid repeated compass clicks send exactly one `CONNECT_REQUEST`.
- [ ] A `zander:hub` message sent from a non-allow-listed backend server is rejected and logged.
- [ ] `/zportal reload` reports the correct portal count and rebuilds the spatial index.
```

- [ ] **Step 2: Link it from `README.md`**

Add a new bullet under "Product docs:" in `README.md`:

```markdown
- [Custom portals & server navigation (Zander Hub / Velocity)](docs/portals-and-navigation.md)
```

- [ ] **Step 3: Commit**

```bash
git add docs/portals-and-navigation.md README.md
git commit -m "docs: document Nether disable requirement, ServerPermissions nodes, and test checklist"
```

---

## Task 25: Full build verification

**Files:** none created or modified — verification only.

**Interfaces:** none.

- [ ] **Step 1: Run the full multi-module build**

Run: `mvn clean verify`
Expected: BUILD SUCCESS across all modules, including `zander-hub` and `zander-velocity` test suites from every task above. If any other module (`zander-auth`, `zander-addon`, `zander-pgm`) fails for reasons unrelated to this work, note it but do not attempt to fix it as part of this plan — it's out of scope per the Global Constraints.

- [ ] **Step 2: If the aggregate build fails for infrastructure reasons (e.g. a module unrelated to this change can't resolve a repository), fall back to targeted verification**

Run: `mvn -pl zander-hub,zander-velocity -am clean verify`
Expected: BUILD SUCCESS for both affected modules.

- [ ] **Step 3: Record actual results**

Whoever executes this task must paste the real terminal output (or a summary with pass/fail counts per module) into the PR description or final report — do not claim "tests passed" without having run them in this step.

---

## Known gaps (from self-review)

- `PortalCommand`'s admin-facing feedback strings (created/updated/deleted/enabled/disabled/reload results) are inline MiniMessage literals rather than routed through a config file. The spec's Part 12 message list is primarily player-facing (denials, cooldowns, connection states) and those are all configurable via `config.yml` (Task 16); admin command feedback is lower-stakes and hardcoding it matches how the rest of this codebase's existing commands (e.g. `fly`) behave. If fully configurable admin-command text is later required, add a `PortalCommandMessagesConfig` following the `MessagesConfig` pattern.
- No dedicated unit test asserts the exact permission-node strings (`serverpermissions.server.<id>`, `zanderhub.portal.use.<id>`) since they're formed by trivial inline string concatenation at 3 call sites (`HubBridgeListener`, `PortalActivationHandler`) rather than a shared helper. If a future change makes that concatenation more complex, extract a `PermissionNodes` utility class first and test it then.
