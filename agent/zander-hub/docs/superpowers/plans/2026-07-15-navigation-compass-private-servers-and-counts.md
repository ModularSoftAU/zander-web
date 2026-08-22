# Navigation Compass: Private Servers + Player Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Navigation Compass GUI permission-gate every server entry (hiding ones the player can't access), read entries from config.yml instead of hardcoded Java, cross-check them against the live server list from the Velocity proxy, and show live player counts when the GUI opens.

**Architecture:** Three new/changed pieces: `CompassConfig` (parses `compass.servers` from config.yml), `ProxyMessaging` (sends `GetServers`/`PlayerCount` BungeeCord-protocol plugin messages and resolves `CompletableFuture`s from the incoming channel), and a rewritten `HubCompassItem` (builds a per-player `Inventory` using both, replacing the current static shared inventory and `Material`-based click switch).

**Tech Stack:** Java 21, Paper/Bukkit API, Google Guava `ByteArrayDataOutput`/`ByteStreams` (already a dependency, used by `PluginMessageChannel`), `java.util.concurrent.CompletableFuture`.

## Global Constraints

- No test framework exists in `zander-hub` (no MockBukkit/JUnit). Verification is manual, in-game, per the approved spec — do not attempt to add automated tests as part of this plan.
- Permission node for each server entry is always `bungeecord.server.<id>` (auto-derived, no config field) — matches the existing convention in the current click handler.
- Config parsing failures must log a warning and skip the offending entry; they must never throw or block plugin startup (matches `ConfigValidator`/`MiscConfig` conventions already in the codebase).
- Proxy request timeout is 3 seconds; a timeout must never hang the GUI open or crash — it degrades to "unavailable"/unfiltered behavior as specified.

---

### Task 1: `CompassConfig` — config-driven server entries

**Files:**
- Create: `src/main/java/org/modularsoft/zander/hub/configs/CompassConfig.java`
- Modify: `src/main/java/org/modularsoft/zander/hub/ConfigurationManager.java`
- Modify: `src/main/resources/config.yml`

**Interfaces:**
- Produces: `public record CompassConfig.CompassServerEntry(String id, Material material, String display, String lore)`, `public void CompassConfig.setupServers()`, `public List<CompassServerEntry> CompassConfig.getServers()` (returns an unmodifiable list, empty if nothing parsed).
- Produces: `ConfigurationManager.setupCompassConfig()`, `ConfigurationManager.getCompass()` (mirrors the existing `setupMiscConfig()`/`getMisc()` pattern at `ConfigurationManager.java:35-41` and `:65-68`).

- [ ] **Step 1: Add default `compass.servers` section to `config.yml`**

Edit `src/main/resources/config.yml`, appending after the existing `misc:` block:

```yaml
compass:
  servers:
    survival:
      material: IRON_PICKAXE
      display: 'Survival'
      lore: 'Click me to join our Survival server.'
    mixed:
      material: IRON_SWORD
      display: 'Mixed'
      lore: 'Play and Destroy your friends in Minigames.'
```

- [ ] **Step 2: Write `CompassConfig`**

Create `src/main/java/org/modularsoft/zander/hub/configs/CompassConfig.java`:

```java
package org.modularsoft.zander.hub.configs;

import org.bukkit.Material;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Manages the Navigation Compass' configured server entries, and their persistence.
 * Handles loading, validation, and access to managed data.
 */
public class CompassConfig {
    private final JavaPlugin plugin;

    private List<CompassServerEntry> servers = Collections.emptyList();

    public record CompassServerEntry(String id, Material material, String display, String lore) {
    }

    public CompassConfig(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    /// Configure the Navigation Compass' server entries.
    /// Validates each entry in server 'config.yml', skipping invalid ones with a warning.
    public void setupServers() {
        FileConfiguration config = plugin.getConfig();
        ConfigurationSection section = config.getConfigurationSection("compass.servers");
        List<CompassServerEntry> parsed = new ArrayList<>();

        if (section == null) {
            plugin.getLogger().warning("Missing 'compass.servers' in config.yml; Navigation Compass will show no servers.");
            this.servers = Collections.emptyList();
            return;
        }

        for (String id : section.getKeys(false)) {
            ConfigurationSection entry = section.getConfigurationSection(id);
            if (entry == null) {
                plugin.getLogger().warning(String.format("Invalid 'compass.servers.%s' entry in config.yml, skipped", id));
                continue;
            }

            String materialName = entry.getString("material");
            String display = entry.getString("display");
            String lore = entry.getString("lore");

            if (materialName == null || display == null || lore == null) {
                plugin.getLogger().warning(String.format(
                        "Incomplete 'compass.servers.%s' entry in config.yml (needs material, display, lore), skipped", id));
                continue;
            }

            Material material = Material.matchMaterial(materialName);
            if (material == null) {
                plugin.getLogger().warning(String.format(
                        "Invalid 'compass.servers.%s.material' value '%s' in config.yml, skipped", id, materialName));
                continue;
            }

            parsed.add(new CompassServerEntry(id, material, display, lore));
        }

        this.servers = Collections.unmodifiableList(parsed);
    }

    /// Retrieve the configured, valid Navigation Compass server entries.
    public List<CompassServerEntry> getServers() {
        return this.servers;
    }
}
```

- [ ] **Step 3: Wire `CompassConfig` into `ConfigurationManager`**

Edit `src/main/java/org/modularsoft/zander/hub/ConfigurationManager.java`:

Add the import alongside the existing config imports:

```java
import org.modularsoft.zander.hub.configs.CompassConfig;
```

Add a field alongside the other `private static ...Config` fields:

```java
private static CompassConfig compassConfig;
```

Add the setup method (mirroring `setupMiscConfig`):

```java
public static void setupCompassConfig() {
    if (compassConfig != null)
        throw new IllegalStateException("Already setup, ensure there's a single call");
    compassConfig = new CompassConfig(ZanderHubMain.plugin);
    compassConfig.setupServers();
}
```

Add the getter (mirroring `getMisc`):

```java
public static CompassConfig getCompass() {
    if (compassConfig == null)
        throw new IllegalStateException("Missing setup, first run 'ConfigurationManager.setupCompassConfig'");
    return compassConfig;
}
```

- [ ] **Step 4: Call the new setup from `ZanderHubMain.onEnable`**

Edit `src/main/java/org/modularsoft/zander/hub/ZanderHubMain.java`, adding this line after `ConfigurationManager.setupMiscConfig();` (currently line 31):

```java
ConfigurationManager.setupCompassConfig();
```

- [ ] **Step 5: Build and verify no compile errors**

Run: `cd zander-hub && mvn -q compile`
Expected: `BUILD SUCCESS`, no errors referencing `CompassConfig` or `ConfigurationManager`.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/org/modularsoft/zander/hub/configs/CompassConfig.java src/main/java/org/modularsoft/zander/hub/ConfigurationManager.java src/main/java/org/modularsoft/zander/hub/ZanderHubMain.java src/main/resources/config.yml
git commit -m "feat: add config-driven Navigation Compass server entries"
```

---

### Task 2: `ProxyMessaging` — GetServers / PlayerCount plugin messaging

**Files:**
- Create: `src/main/java/org/modularsoft/zander/hub/events/ProxyMessaging.java`
- Modify: `src/main/java/org/modularsoft/zander/hub/ZanderHubMain.java`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `public CompletableFuture<List<String>> ProxyMessaging.requestServerList(Player requester)`, `public CompletableFuture<Integer> ProxyMessaging.requestPlayerCount(Player requester, String serverId)`. Both futures resolve normally on a proxy response, or complete exceptionally with `TimeoutException` after 3 seconds. `ZanderHubMain.proxyMessaging` (public static field) holds the singleton instance, mirroring the existing `ZanderHubMain.plugin` static field pattern.

- [ ] **Step 1: Write `ProxyMessaging`**

Create `src/main/java/org/modularsoft/zander/hub/events/ProxyMessaging.java`:

```java
package org.modularsoft.zander.hub.events;

import com.google.common.io.ByteArrayDataOutput;
import com.google.common.io.ByteStreams;
import org.bukkit.entity.Player;
import org.bukkit.plugin.messaging.PluginMessageListener;
import org.modularsoft.zander.hub.ZanderHubMain;

import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Sends and resolves BungeeCord-protocol proxy queries (GetServers, PlayerCount)
 * over the "BungeeCord" plugin messaging channel, shared by both Velocity and BungeeCord proxies.
 */
public class ProxyMessaging implements PluginMessageListener {
    private static final long TIMEOUT_SECONDS = 3;
    private static final String CHANNEL = "BungeeCord";

    private final Map<UUID, CompletableFuture<List<String>>> pendingServerList = new ConcurrentHashMap<>();
    private final Map<String, CompletableFuture<Integer>> pendingPlayerCount = new ConcurrentHashMap<>();

    private static String playerCountKey(UUID playerId, String serverId) {
        return playerId + ":" + serverId;
    }

    /// Request the list of server ids currently registered on the proxy.
    /// Resolves exceptionally with TimeoutException if the proxy doesn't respond within 3 seconds.
    public CompletableFuture<List<String>> requestServerList(Player requester) {
        CompletableFuture<List<String>> future = new CompletableFuture<>();
        pendingServerList.put(requester.getUniqueId(), future);

        ByteArrayDataOutput output = ByteStreams.newDataOutput();
        output.writeUTF("GetServers");
        requester.sendPluginMessage(ZanderHubMain.plugin, CHANNEL, output.toByteArray());

        return future.orTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .whenComplete((result, error) -> pendingServerList.remove(requester.getUniqueId()));
    }

    /// Request the live player count for a specific server id.
    /// Resolves exceptionally with TimeoutException if the proxy doesn't respond within 3 seconds.
    public CompletableFuture<Integer> requestPlayerCount(Player requester, String serverId) {
        String key = playerCountKey(requester.getUniqueId(), serverId);
        CompletableFuture<Integer> future = new CompletableFuture<>();
        pendingPlayerCount.put(key, future);

        ByteArrayDataOutput output = ByteStreams.newDataOutput();
        output.writeUTF("PlayerCount");
        output.writeUTF(serverId);
        requester.sendPluginMessage(ZanderHubMain.plugin, CHANNEL, output.toByteArray());

        return future.orTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .whenComplete((result, error) -> pendingPlayerCount.remove(key));
    }

    @Override
    public void onPluginMessageReceived(String channel, Player player, byte[] message) {
        if (!channel.equals(CHANNEL)) {
            return;
        }

        try {
            DataInputStream input = new DataInputStream(new ByteArrayInputStream(message));
            String subchannel = input.readUTF();

            if (subchannel.equals("GetServers")) {
                String serverCsv = input.readUTF();
                List<String> servers = Arrays.asList(serverCsv.split(", ?"));
                CompletableFuture<List<String>> future = pendingServerList.get(player.getUniqueId());
                if (future != null) {
                    future.complete(servers);
                }
            } else if (subchannel.equals("PlayerCount")) {
                String serverId = input.readUTF();
                int count = input.readInt();
                CompletableFuture<Integer> future = pendingPlayerCount.get(playerCountKey(player.getUniqueId(), serverId));
                if (future != null) {
                    future.complete(count);
                }
            }
        } catch (IOException e) {
            ZanderHubMain.plugin.getLogger().warning("Failed to parse BungeeCord plugin message: " + e.getMessage());
        }
    }
}
```

- [ ] **Step 2: Register the incoming channel and expose the instance in `ZanderHubMain`**

Edit `src/main/java/org/modularsoft/zander/hub/ZanderHubMain.java`:

Add the import:

```java
import org.modularsoft.zander.hub.events.ProxyMessaging;
```

Add a public static field alongside `public static ZanderHubMain plugin;` (line 21):

```java
public static ProxyMessaging proxyMessaging;
```

Replace the commented-out incoming channel registration (currently lines 34-36):

```java
this.getServer().getMessenger().registerOutgoingPluginChannel(this, "BungeeCord");
// this.getServer().getMessenger().registerIncomingPluginChannel(this,
// "BungeeCord", new PluginMessageChannel(this));
```

with:

```java
proxyMessaging = new ProxyMessaging();
this.getServer().getMessenger().registerOutgoingPluginChannel(this, "BungeeCord");
this.getServer().getMessenger().registerIncomingPluginChannel(this, "BungeeCord", proxyMessaging);
```

- [ ] **Step 3: Build and verify no compile errors**

Run: `cd zander-hub && mvn -q compile`
Expected: `BUILD SUCCESS`.

- [ ] **Step 4: Manual verification against a running proxy**

Deploy to a test Velocity + backend setup. Join the hub server and run (temporarily, e.g. from a throwaway debug command or breakpoint) `ZanderHubMain.proxyMessaging.requestServerList(player).thenAccept(System.out::println)` — confirm the console prints the real list of registered backend server ids within 3 seconds. This step has no persisted code; it's a manual smoke check before wiring the GUI in Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/org/modularsoft/zander/hub/events/ProxyMessaging.java src/main/java/org/modularsoft/zander/hub/ZanderHubMain.java
git commit -m "feat: add GetServers/PlayerCount proxy messaging support"
```

---

### Task 3: Rewrite `HubCompassItem` — permission-gated, live-count GUI

**Files:**
- Modify: `src/main/java/org/modularsoft/zander/hub/gui/HubCompassItem.java`

**Interfaces:**
- Consumes: `ConfigurationManager.getCompass().getServers()` → `List<CompassConfig.CompassServerEntry>` (Task 1); `ZanderHubMain.proxyMessaging.requestServerList(Player)` → `CompletableFuture<List<String>>` and `.requestPlayerCount(Player, String)` → `CompletableFuture<Integer>` (Task 2); `PluginMessageChannel.connect(Player, String)` (existing, unchanged).
- Produces: nothing consumed elsewhere — this is the leaf/GUI layer.

- [ ] **Step 1: Replace `HubCompassItem.java` entirely**

Replace the full contents of `src/main/java/org/modularsoft/zander/hub/gui/HubCompassItem.java`:

```java
package org.modularsoft.zander.hub.gui;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;
import org.modularsoft.zander.hub.ConfigurationManager;
import org.modularsoft.zander.hub.ZanderHubMain;
import org.modularsoft.zander.hub.configs.CompassConfig.CompassServerEntry;
import org.modularsoft.zander.hub.events.PluginMessageChannel;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

public class HubCompassItem implements Listener {
    private static final NamespacedKey SERVER_ID_KEY = new NamespacedKey(ZanderHubMain.plugin, "compass_server_id");
    private static final String COMPASS_TITLE = "Server Selector";

    /// Marker so the click handler can recognise a Navigation Compass inventory
    /// without relying on title text or a shared static instance.
    private static class CompassInventoryHolder implements InventoryHolder {
        private Inventory inventory;

        @Override
        public Inventory getInventory() {
            return inventory;
        }
    }

    @EventHandler
    public void onPlayerInteract(PlayerInteractEvent event) {
        Player player = event.getPlayer();

        if (player.getInventory().getItemInMainHand().getType() == Material.COMPASS) {
            if (event.getAction() == Action.LEFT_CLICK_AIR || event.getAction() == Action.RIGHT_CLICK_AIR || event.getAction() == Action.RIGHT_CLICK_BLOCK) {
                openCompassGui(player);
            }
        }
    }

    public void openCompassGui(Player player) {
        if (player == null) {
            return;
        }

        List<CompassServerEntry> permitted = new ArrayList<>();
        for (CompassServerEntry entry : ConfigurationManager.getCompass().getServers()) {
            if (player.hasPermission("bungeecord.server." + entry.id())) {
                permitted.add(entry);
            }
        }

        CompletableFuture<List<String>> serverListFuture = ZanderHubMain.proxyMessaging.requestServerList(player);
        List<CompletableFuture<Integer>> countFutures = new ArrayList<>();
        for (CompassServerEntry entry : permitted) {
            countFutures.add(ZanderHubMain.proxyMessaging.requestPlayerCount(player, entry.id()));
        }

        List<CompletableFuture<?>> allFutures = new ArrayList<>();
        allFutures.add(serverListFuture);
        allFutures.addAll(countFutures);

        CompletableFuture.allOf(allFutures.toArray(new CompletableFuture[0]))
                .handle((ignoredResult, ignoredError) -> null)
                .thenRun(() -> Bukkit.getScheduler().runTask(ZanderHubMain.plugin,
                        () -> buildAndShowGui(player, permitted, serverListFuture, countFutures)));
    }

    private void buildAndShowGui(Player player, List<CompassServerEntry> permitted,
            CompletableFuture<List<String>> serverListFuture, List<CompletableFuture<Integer>> countFutures) {
        List<String> liveServers = serverListFuture.getNow(null); // null => GetServers timed out, don't filter

        List<CompassServerEntry> visible = new ArrayList<>();
        List<Integer> counts = new ArrayList<>();
        for (int i = 0; i < permitted.size(); i++) {
            CompassServerEntry entry = permitted.get(i);
            if (liveServers != null && !liveServers.contains(entry.id())) {
                continue;
            }
            visible.add(entry);
            counts.add(countFutures.get(i).getNow(null));
        }

        CompassInventoryHolder holder = new CompassInventoryHolder();
        Inventory inventory = Bukkit.createInventory(holder, 9, Component.text(COMPASS_TITLE));
        holder.inventory = inventory;

        for (int slot = 0; slot < visible.size() && slot < 9; slot++) {
            CompassServerEntry entry = visible.get(slot);
            Integer count = counts.get(slot);
            String countLine = count != null ? "Players online: " + count : "Players online: unavailable";

            ItemStack item = new ItemStack(entry.material());
            ItemMeta meta = item.getItemMeta();
            meta.displayName(Component.text(entry.display(), NamedTextColor.WHITE));
            meta.lore(List.of(
                    Component.text(entry.lore(), NamedTextColor.WHITE),
                    Component.text(countLine, NamedTextColor.GRAY)));
            meta.getPersistentDataContainer().set(SERVER_ID_KEY, PersistentDataType.STRING, entry.id());
            item.setItemMeta(meta);
            inventory.setItem(slot, item);
        }

        player.openInventory(inventory);
    }

    @EventHandler
    public void onClick(InventoryClickEvent event) {
        if (!(event.getInventory().getHolder() instanceof CompassInventoryHolder)) {
            return;
        }

        Player player = (Player) event.getWhoClicked();
        event.setCancelled(true);

        ItemStack clicked = event.getCurrentItem();
        if (clicked == null || !clicked.hasItemMeta()) {
            player.closeInventory();
            return;
        }

        ItemMeta meta = clicked.getItemMeta();
        String serverId = meta.getPersistentDataContainer().get(SERVER_ID_KEY, PersistentDataType.STRING);
        if (serverId == null) {
            player.closeInventory();
            return;
        }

        player.closeInventory();

        String permission = "bungeecord.server." + serverId;
        if (!player.hasPermission(permission)) {
            player.sendMessage(Component.text("You do not have access to this server.", NamedTextColor.RED));
            return;
        }

        player.sendMessage(Component.text("Sending you to " + serverId + "...", NamedTextColor.YELLOW));
        PluginMessageChannel.connect(player, serverId);
    }
}
```

- [ ] **Step 2: Build and verify no compile errors**

Run: `cd zander-hub && mvn -q compile`
Expected: `BUILD SUCCESS`.

- [ ] **Step 3: Manual in-game verification checklist**

Deploy to a test Velocity + backend setup with at least: one public server (permission granted to default group, e.g. `survival`), and one private server (permission only granted to a test/staff account, e.g. `staff`) both registered on the proxy and both listed under `compass.servers` in `config.yml`.

- [ ] As a player without the private server's permission: right-click the compass, confirm only the public entries appear (private entry absent, not merely unclickable).
- [ ] As a player with the private server's permission: right-click the compass, confirm the private entry appears alongside public ones.
- [ ] Confirm each visible entry's lore shows `Players online: N` matching that server's actual current population.
- [ ] Click a visible entry and confirm it connects to the correct server (test with two entries sharing the same `material` in config.yml to confirm the click routes correctly rather than by icon).
- [ ] Stop/block the proxy's plugin messaging response (or point at a proxy with the channel unregistered) and confirm: the GUI still opens, permitted entries still show, and their lore reads `Players online: unavailable` instead of hanging or erroring.
- [ ] Configure `compass.servers` with an entry whose id is not currently registered on the proxy (per a live `GetServers` response) and confirm it does NOT appear, even though the player has permission for it.

- [ ] **Step 4: Commit**

```bash
git add src/main/java/org/modularsoft/zander/hub/gui/HubCompassItem.java
git commit -m "feat: permission-gate Navigation Compass entries and show live player counts"
```
