# Custom Portal & Server-Navigation System — Design

Date: 2026-07-25
Modules: `zander-hub` (Paper, Java 21), `zander-velocity` (Velocity, Java 17)

## Goals

Replace the legacy `BungeeCord`-channel navigation compass and the unconditional
`PlayerPortalEvent` cancellation with:

1. Targeted Nether/End dimension protection.
2. A configurable custom cuboid portal system (server-transfer and local-teleport
   destinations).
3. A dedicated, versioned `zander:hub` binary messaging protocol between hub and
   velocity, replacing the `BungeeCord` channel usage for these features.
4. A repaired navigation compass driven by Velocity-authoritative access data.
5. In-game portal administration commands.
6. `serverpermissions.server.<id>` remains the sole final authority for backend
   access, enforced only on Velocity.

Out of scope / unchanged: chat, moderation, auth, reporting, API heartbeat, all
other existing hub/velocity features.

## 1. Dimension protection

New package `dev.anchorlight.zander.hub.protection.dimension`.

- `DimensionsConfig` (new, follows `MiscConfig` pattern): reads `dimensions.nether.*`
  and `dimensions.end.*` from `config.yml` into typed fields (`blocked`, `message`
  as MiniMessage string, `allowBypass`). Wired into `ConfigurationManager` as
  `setupDimensionsConfig()` / `getDimensions()`.
- `DimensionProtectionListener` (new), replaces the `noPortal(PlayerPortalEvent)`
  handler removed from `HubProtection.java`:
  - `PlayerPortalEvent`: cancel if `event.getTo()` (or the vanilla-computed
    destination) resolves to a NETHER/END world and blocking is enabled and the
    player lacks the relevant bypass permission (only when `allow-bypass: true`).
  - `PlayerTeleportEvent` (all causes, priority HIGH): same check against
    `event.getTo().getWorld()`, catching command/plugin-driven teleports.
  - `PlayerChangedWorldEvent` (fallback): if the player's new world is NETHER/END,
    blocked, and no bypass, schedule a same-plugin task on the next tick
    (`Bukkit.getScheduler().runTask`) to teleport them to `HubLocationsConfig`
    spawn. Guard against loops with a per-player `Set<UUID>` "currently
    correcting" flag cleared after the corrective teleport completes. Log at
    `WARNING` via a debounced logger (max once per player per N seconds) — never
    per-movement.
  - Send the configured Adventure/MiniMessage denial message on cancellation.
- Permissions (`plugin.yml`): `zanderhub.nether.bypass` (default: op),
  `zanderhub.end.bypass` (default: op). Effective bypass = permission present AND
  `allow-bypass: true` in config.
- `HubProtection.java`: remove the `noPortal` handler only; all other unrelated
  handlers stay untouched.
- Documentation note (README/deployment doc): Hub Paper server should also set
  `misc.enable-nether: false` in `paper-global.yml`; this is external to the repo
  and only documented, not asserted at runtime. Plugin-level protection remains
  regardless, as defence in depth.

### Config additions (`config.yml`)

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

## 2. Portal domain model

New package `dev.anchorlight.zander.hub.portal`.

Immutable records:

```java
record PortalRegion(String world, int minX, int minY, int minZ,
                     int maxX, int maxY, int maxZ) {
  // canonical constructor normalises min/max on construction
  boolean contains(int x, int y, int z);
  boolean intersectsChunk(int chunkX, int chunkZ);
}

sealed interface PortalDestination permits ServerPortalDestination, LocationPortalDestination {}
record ServerPortalDestination(String serverId) implements PortalDestination {}
record LocationPortalDestination(String world, double x, double y, double z,
                                  float yaw, float pitch) implements PortalDestination {}

record Portal(String id, String displayName, boolean enabled, PortalRegion region,
              PortalDestination destination, String permission /* nullable */,
              long cooldownMs, String sound /* nullable */,
              String successMessage, String deniedMessage) {}
```

Portal IDs: case-insensitive, validated against `^[A-Za-z0-9_-]+$`.

## 3. Persistence

`PortalRepository` (new):

- Backed by plain Bukkit `YamlConfiguration` against
  `plugins/zander-hub/portals.yml` (matches the rest of zander-hub, which does
  not use BoostedYaml — that library is velocity-only in this codebase).
- `load()`: iterates `portals.*` keys, parses each into a `Portal`, catching and
  logging per-entry errors (unknown world, bad destination type, invalid ID,
  negative cooldown, unknown material/sound) without aborting the whole load.
  Returns a case-insensitive `Map<String, Portal>` (keys stored lower-cased).
- `save(Collection<Portal>)`: writes to `portals.yml.tmp` then atomically moves
  it over `portals.yml` (`Files.move` with `ATOMIC_MOVE` where supported,
  falling back to replace-existing).
- Duplicate IDs differing only by case are rejected at the point of
  registration (in `PortalService`), not silently merged.

`PortalService` (new): create/update/delete/enable/disable operations, each of
which validates input, persists via `PortalRepository`, updates the in-memory
`PortalRepository`-held map, and triggers `PortalSpatialIndex` rebuild/update.

## 4. Spatial index

`PortalSpatialIndex` (new): `Map<String, Map<Long, List<Portal>>>` keyed by
normalised world name, then a packed `(chunkX,chunkZ)` long key. Built by
iterating each portal's region's chunk span (`minX>>4 .. maxX>>4`,
`minZ>>4 .. maxZ>>4`) and adding the portal to every intersected chunk bucket.
Rebuilt wholesale on `PortalRepository.load()`; incrementally
updated/removed-and-reinserted on single-portal create/update/delete/enable/
disable via `PortalService`.

## 5. Movement detection & session state

`PortalSessionManager` (new): per-player (`UUID`-keyed) runtime state:
- `activePortalId` — currently-inside portal, for enter/exit edge detection.
- `cooldownUntil` per portal id.
- `suppressUntilTick`/timestamp for post-teleport loop suppression.
- `pendingConnectServer` — set while a `CONNECT_REQUEST` is in flight, to block
  duplicate sends.
All cleared on `PlayerQuitEvent`.

`PortalMovementListener` (new), replaces no existing class (additive):
- `PlayerMoveEvent`, priority MONITOR-adjacent but must be able to cancel local
  teleports' side effects only via scheduling, not the move event itself.
  Returns immediately unless `from` and `to` differ in block X/Y/Z.
- Looks up `PortalSpatialIndex.candidatesFor(world, blockX>>4, blockZ>>4)`.
- For each candidate, checks `region.contains(toBlockX,Y,Z)`.
- Compares against `PortalSessionManager.activePortalId`: if entering a new
  portal (was null/different, now inside), fire `PortalActivationHandler`; if
  leaving (was set, now outside all portals at this position), clear it.
- Ignores players who are dead, offline, or (if configured) spectators.

`PortalActivationHandler` (new): given player + portal:
1. Confirm enabled.
2. Confirm cooldown elapsed (`PortalSessionManager`).
3. Confirm custom `permission` (if set) — this is a portal-usage gate only, never
   a server-access decision.
4. Dispatch to server-transfer flow (§8) or local-teleport flow (§9).
5. Set/refresh cooldown timestamp on successful trigger.

## 6. Loop protection

- Local teleports: `PortalActivationHandler`/local-teleport code sets
  `PortalSessionManager.suppressUntilTick` (current tick + configurable delay,
  default 2 ticks) before teleporting; `PortalMovementListener` ignores
  activation while suppressed, but still updates `activePortalId` so exit
  detection keeps working.
- Server transfers: `pendingConnectServer` blocks re-send while a
  `CONNECT_REQUEST` is outstanding; cleared on `CONNECT_STARTED`,
  `CONNECT_DENIED`, `CONNECT_FAILED`, or `PlayerQuitEvent`. Additionally
  rate-limited client-side via the portal's own cooldown.

## 7. Portal access rules

- No `permission` configured ⇒ portal usage is public (still subject to §8/§9
  destination-specific checks).
- `permission` configured ⇒ gate portal *activation* only.
- Server portals always additionally require Velocity-side
  `serverpermissions.server.<server-id>` — Paper never makes this decision, and
  a configured portal permission can never substitute for it.

## 8. Zander proxy bridge (`zander:hub`)

New package `dev.anchorlight.zander.hub.bridge` (hub) and
`dev.anchorlight.zander.velocity.bridge` (velocity). No shared module (hub is
Java 21, velocity Java 17, and no existing shared module exists in this repo) —
the wire codec is hand-duplicated identically on both sides, unit-tested on
each.

### Wire format

Raw bytes over channel `zander:hub`, built with `ByteArrayDataOutput` /
`DataInputStream` (no Java object serialization):

```
byte    protocolVersion   (current: 1)
byte    messageType       (enum ordinal)
UTF     requestId         (client-generated, echoed in responses)
...     type-specific fields (UTF strings length-capped, see below)
```

Message types (byte enum): `SERVER_LIST_REQUEST`, `SERVER_LIST_RESPONSE`,
`CONNECT_REQUEST`, `CONNECT_STARTED`, `CONNECT_DENIED`, `CONNECT_FAILED`,
`PLAYER_CURRENT_SERVER_REQUEST`, `PLAYER_CURRENT_SERVER_RESPONSE`.

`SERVER_LIST_RESPONSE` includes, per server: id, player count (int),
registered (bool), hasAccess (bool, computed via
`serverpermissions.server.<id>` for the requesting player), alreadyConnected
(bool).

Max string length enforced on decode (e.g. 64 chars for IDs, 256 for any
freeform field) — oversized strings cause the message to be rejected, not
truncated.

### Hub side

- `BridgeCodec` (encode/decode, mirrors velocity's).
- `BridgeClient` (new), replaces `ProxyMessaging`/`PluginMessageChannel`
  (deleted): sends requests, correlates responses by `requestId` via
  `CompletableFuture` map with a configurable timeout
  (`compass.request-timeout-ms`), used by both the compass and portal
  activation flow.
- Registers `zander:hub` as both incoming and outgoing channel in
  `ZanderHubMain.onEnable`.

### Velocity side

- `HubBridgeListener` (new): registers `zander:hub` via `ChannelRegistrar`,
  subscribes to Velocity's plugin-message event, marks recognised messages
  handled, and — critically — only processes messages whose
  `event.getSource()` is a `ServerConnection` (never forwards to a client) AND
  whose backend server name is in `hub-bridge.allowed-source-servers`.
  Unauthorized sources are logged (rate-limited) and dropped.
- The player is derived from the `ServerConnection`'s associated `Player`
  (`serverConnection.getPlayer()`), never from a UUID/username in the payload.
- `CONNECT_REQUEST` handling: validate target server is registered
  (`proxy.getServer(id)`), not already connected, check
  `player.hasPermission("serverpermissions.server." + id)`, then
  `player.createConnectionRequest(target).connect()`, replying
  `CONNECT_STARTED`/`CONNECT_DENIED`/`CONNECT_FAILED` accordingly.
- Per-player rate limiting via `hub-bridge.rate-limit.connection-request-cooldown-ms`.
- Config (velocity `config.yml`, BoostedYaml, matching existing pattern):

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

- No compile-time dependency on ServerPermissions; only the documented
  `serverpermissions.server.<id>` permission node via the standard Velocity
  permission API.

## 9. Local teleport safety

On `LocationPortalDestination` activation:
- Confirm the destination world exists (else send failure message, do not
  silently no-op).
- `world.getChunkAtAsync(...)` (or sync load if already loaded) before
  teleporting.
- Teleport via `player.teleportAsync(...)` on the main thread, preserving
  configured yaw/pitch exactly as configured (no silent modification).
- Set loop-suppression (§6) immediately before teleport.
- Play configured sound only after a successful teleport; send success message.

## 10. Server transfer flow

Paper side (`PortalActivationHandler` → server branch):
1. Confirm enabled/cooldown/portal-permission (§5 steps 1–3).
2. Set `pendingConnectServer`.
3. Send `CONNECT_REQUEST` (includes portal id for correlation/logging) via
   `BridgeClient`.
4. Send configured transfer message; play sound only once request is accepted
   to send (not per movement tick — guarded by §6 pending-state check).
5. On `CONNECT_STARTED`: clear pending state (transfer is proceeding).
   On `CONNECT_DENIED`/`CONNECT_FAILED`: clear pending state, show the
   respective configured message, player remains on Hub.

Velocity side: as in §8.

## 11. Navigation compass rework

- `NavigationCompassItem`: tags produced items with a boolean PDC entry under
  `zanderhub:navigation_compass` in addition to existing material/name/lore.
- `HubCompassItem` (rewritten):
  - `PlayerInteractEvent` handler checks the PDC tag on the main-hand item
    (not `Material.COMPASS`), handles configured `open-on.right-click`/
    `left-click`, ignores off-hand duplicate events, cancels the event, and
    guards against double-open for one physical click (Paper fires separate
    events for main/off hand and sometimes twice for block+air — dedupe via a
    short per-player "already opening" flag cleared same-tick).
  - Uses `BridgeClient.requestServerList()` — a single request — instead of
    per-server `PlayerCount`. Removes all `bungeecord.server.*` permission
    checks; visibility is entirely driven by the response's `hasAccess`,
    `registered`, `alreadyConnected` fields.
  - Renders `hide-inaccessible`, per-entry configured/explicit or centred
    slots (reusing/extending the existing `computeEvenlySpacedSlots` logic to
    support explicit slots with validation of duplicates/out-of-range), and
    the six states (`ONLINE`, `NO_ACCESS`, `UNAVAILABLE`, `ALREADY_CONNECTED`,
    `LOADING`, `CONNECTING`).
  - On timeout: show all configured servers as `UNAVAILABLE` rather than an
    empty inventory.
  - `InventoryClickEvent`: cancels all movement (already done), verifies the
    inventory instance still matches the player's currently-open selector
    (avoids stale-click races), disables repeat clicks while a request is
    pending, sends `CONNECT_REQUEST`, and handles the three connect responses
    per §10 client behaviour.

## 12. Portal administration commands

New package `dev.anchorlight.zander.hub.commands.portal`.

- `PortalCommand` (root `/zportal`, alias `/portaladmin`) dispatching to
  per-subcommand handler classes (one class per subcommand or a small handful
  grouped by concern — not one giant switch with inline logic) for: `wand`,
  `create`, `delete`, `list`, `info`, `enable`, `disable`, `setserver`,
  `setlocation`, `setpermission`, `setdisplay`, `setcooldown`, `setsound`,
  `reload`, `tp`.
- `PortalWandListener`: PDC-tagged (`zanderhub:portal_wand`) `BLAZE_ROD` (item
  material/name configurable); left-click block = pos1, right-click block =
  pos2, per-admin-UUID storage in `PortalSelectionManager`; cancels the
  interact event so no block break/place occurs; validates same-world;
  displays selected coordinates via chat.
- `create <id>` requires a valid, same-world two-point selection; creates the
  portal disabled (no destination yet); persists; updates repository + index;
  prints next-step instructions (`setserver`/`setlocation`).
- `setlocation <id>` is player-only, uses the executor's current location
  (block-agnostic, full double coords + yaw/pitch).
- `tp <id>` teleports to a safe location at/near the region (checks for a
  non-solid block at the region's centre column, falling back to the block
  above ground level; simple safety heuristic, not a full pathfinder).
- Tab completion: subcommands, live portal IDs, cached Velocity server IDs
  (refreshed periodically by `BridgeClient`, not fetched per keystroke),
  permission-value hints, `Sound` enum name prefix matches.

### Permissions (`plugin.yml`)

```
zanderhub.portal.admin       (op)
zanderhub.portal.wand        (op)
zanderhub.portal.create      (op)
zanderhub.portal.delete      (op)
zanderhub.portal.edit        (op)
zanderhub.portal.list        (op)
zanderhub.portal.reload      (op)
zanderhub.portal.teleport    (op)
zanderhub.portal.use.<portal-id>   (not declared statically; per-portal, default true when unset by portal config)
zanderhub.nether.bypass      (op)
zanderhub.end.bypass         (op)
```

## 13. Messages & config

All new user-facing text added as MiniMessage strings in `MessagesConfig`
(extended) or a new `PortalMessagesConfig`, covering every message listed in
spec Part 12. No `ChatColor` in any new code — Adventure/MiniMessage only.

## 14. Plugin lifecycle

`ZanderHubMain.onEnable`: add, in order — dimensions config setup, portal
config/repository load + validate + spatial index build, bridge channel
registration, portal/dimension/compass/wand listeners, `/zportal` command
registration, session managers init.

`ZanderHubMain.onDisable` (currently empty): cancel any scheduled tasks
(dimension-correction, pending bridge timeouts), clear `PortalSessionManager`
state, unregister the `zander:hub` channel, null out static bridge/session
references.

`/zportal reload`: re-runs portal load + validation + index rebuild only
(not a full plugin `/reload`); reports success/failure counts.

## 15. Testing

New `zander-hub/src/test/java` and `zander-velocity/src/test/java` (neither
exists today — both added). Plain JUnit 5, no mocking framework beyond what's
already a dependency, targeting pure-Java logic:

- `PortalRegion` normalisation, containment, negative coordinates, chunk
  intersection, multi-chunk indexing.
- `PortalSpatialIndex` build/update/remove.
- Case-insensitive duplicate ID detection; ID validation regex.
- `PortalRepository` parsing: valid config, one-bad-entry-doesn't-block-others.
- Permission-node generation (`zanderhub.portal.use.<id>`,
  `serverpermissions.server.<id>`).
- `BridgeCodec` encode/decode round-trip, unsupported version rejection,
  malformed/truncated payload rejection, oversized string rejection.
- Cooldown calculation.
- `PortalSessionManager` enter/exit transition and loop-suppression state.
- Compass slot calculation: explicit, centred, duplicate, out-of-range.
- `BridgeClient` request/response correlation and timeout handling (fake
  transport, no real Bukkit scheduler).

## 16. Logging

Info/warn-level only for: portal count loaded, invalid portal entries (with
identifying detail), unknown worlds, invalid destination servers, bridge
registration status, rejected unapproved-source messages (rate-limited),
unsupported protocol versions (rate-limited), connection failures, reload
results. No per-movement or per-successful-detection logging. Debug logging
gated behind a config flag. Never log full payload contents, secrets, or IPs.

## Deliverables (produced alongside implementation, not part of this doc)

File-by-file change summary, example `portals.yml`, example compass config,
example permission grants, Hub/Velocity deployment steps (including the
external `paper-global.yml` `misc.enable-nether: false` note), manual
integration test checklist, `mvn clean verify` results, known limitations.

## Explicitly out of scope

- Any change to chat, moderation, auth/verify, reporting, heartbeat, or other
  existing hub/velocity systems.
- A shared hub/velocity Maven module for the codec (duplicated instead, given
  the differing Java targets and absence of an existing shared module).
- Enforcing `misc.enable-nether: false` programmatically — documented only.
