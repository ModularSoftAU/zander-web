# Navigation Compass: Private Servers + Player Counts

## Goal

The hub's Navigation Compass GUI (`HubCompassItem`) currently shows a hardcoded,
static list of servers (Survival, Mixed) to every player unconditionally, and
has no visibility into how many players are on each server. This spec adds:

1. Permission-gated visibility, so servers requiring a permission the player
   doesn't hold are hidden from the GUI entirely (not shown-then-denied).
2. Config-driven server entries, with the canonical set of live server IDs
   fetched from the Velocity proxy rather than hardcoded in Java.
3. Live player counts per server, fetched from the proxy when the GUI opens.

## Non-goals

- Background/periodic refresh of counts while the GUI is open (counts are
  fetched once, at open time).
- A distinct "private" flag/config field — visibility is uniformly
  permission-gated for every entry (see Permissions below), so there is no
  separate private/public distinction to model.
- Automated tests beyond what already exists — this is a Bukkit/Velocity
  plugin-messaging integration verified manually in-game.

## Components

### 1. `CompassConfig` (new, in `configs/`, alongside `MiscConfig`)

Reads a new `compass.servers` section of `config.yml`:

```yaml
compass:
  servers:
    survival:
      material: IRON_PICKAXE
      display: "Survival"
      lore: "Click me to join our Survival server."
    mixed:
      material: IRON_SWORD
      display: "Mixed"
      lore: "Play and Destroy your friends in Minigames."
```

- Each top-level key under `compass.servers` is the server id (matches the
  BungeeCord/Velocity backend server id used by `PluginMessageChannel.connect`).
- `material`, `display`, `lore` are required per entry; validated with the
  same `ConfigValidator` pattern used by `MiscConfig` (invalid/missing entries
  are skipped with a logged warning, not a startup failure).
- Exposes `List<CompassServerEntry>` (record: id, material, display, lore).

### 2. `ProxyMessaging` (new, in `events/` alongside `PluginMessageChannel`)

Owns the incoming BungeeCord/Velocity plugin-messaging channel (the currently
commented-out `registerIncomingPluginChannel` in `ZanderHubMain.onEnable`) and
issues outbound requests:

- `CompletableFuture<List<String>> requestServerList(Player requester)` — sends
  `GetServers`, resolves with the parsed comma-separated server id list.
- `CompletableFuture<Integer> requestPlayerCount(Player requester, String serverId)`
  — sends `PlayerCount` with `serverId` as target, resolves with the count.

Since Bungee/Velocity plugin-message responses aren't correlated by a request
ID, pending requests are tracked in a `Map<UUID, CompletableFuture<...>>` keyed
by the requesting player, one map per subchannel. Each request has a 3-second
timeout; a timed-out future completes exceptionally rather than hanging.
Responses are matched to the single outstanding future for that player on that
subchannel (only one in-flight request per player per subchannel at a time,
which holds because the GUI issues its batch of requests from a single click).

### 3. `HubCompassItem` (rewritten)

- No more static shared `Inventory` — a new `Inventory` is built per GUI open.
- On interact:
  1. Filter `CompassConfig` entries to ones where
     `player.hasPermission("bungeecord.server." + id)` is true.
  2. Off the main thread, call `requestServerList` and one
     `requestPlayerCount` per permitted entry, in parallel.
  3. If `requestServerList` resolved successfully, drop any permitted entry
     whose id isn't in the returned list (server no longer registered on the
     proxy). If it timed out, skip this filtering step entirely — config +
     permission alone govern visibility for that open.
  4. Back on the main thread (`Bukkit.getScheduler().runTask`), build the
     inventory: one item per surviving entry, lore = configured lore + a
     player-count line (`Players online: N`, or `Players online: unavailable`
     if that entry's count request timed out).
  5. Each `ItemStack` stores its server id in the item's
     `PersistentDataContainer` (replacing the current `Material`-based
     switch in the click handler, which breaks if two entries share an icon).
- On click: read the server id from `PersistentDataContainer`, re-check
  permission (defense in depth), call `PluginMessageChannel.connect`.

## Error handling

- Proxy channel unregistered or send fails: log once, treat as "request timed
  out" for that call (fail open per the filtering rule above).
- Invalid `compass.servers` config entries: validated and skipped
  individually; plugin still starts.
- Individual `PlayerCount` failure: that one item shows "unavailable" rather
  than blocking the rest of the GUI.

## Testing

Manual in-game verification against a real Velocity + backend setup:
- Permission-gated entries are hidden/shown correctly.
- Live counts appear and match server population.
- Click still connects to the correct server (including when two entries
  share an icon material).
- Behavior when the proxy channel is down/unresponsive (entries still show,
  counts show "unavailable", GUI doesn't hang).
