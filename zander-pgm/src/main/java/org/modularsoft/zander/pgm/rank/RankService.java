package org.modularsoft.zander.pgm.rank;

import org.bukkit.plugin.Plugin;
import org.modularsoft.zander.pgm.api.ZanderApiClient;
import org.modularsoft.zander.pgm.config.ZanderPGMConfig;
import org.modularsoft.zander.pgm.util.AsyncUtil;
import org.modularsoft.zander.pgm.util.JsonUtil;
import org.modularsoft.zander.pgm.util.SafeLogger;

import java.util.UUID;

/**
 * Fetches rank/group data from zander-web and applies it through
 * {@link PermissionGroupSync}. Never manages chat tags, prefixes or formatting.
 */
public class RankService {

    private final Plugin plugin;
    private final ZanderPGMConfig config;
    private final ZanderApiClient api;
    private final PermissionGroupSync groupSync;
    private final SafeLogger logger;

    public RankService(Plugin plugin, ZanderPGMConfig config, ZanderApiClient api,
                       PermissionGroupSync groupSync, SafeLogger logger) {
        this.plugin = plugin;
        this.config = config;
        this.api = api;
        this.groupSync = groupSync;
        this.logger = logger;
    }

    /** Fetch and apply a player's rank asynchronously. */
    public void syncPlayer(UUID uuid) {
        if (!config.feature("ranks")) {
            return;
        }
        api.fetchRank(uuid.toString()).thenAccept(body -> {
            if (body == null || body.isBlank()) {
                return;
            }
            try {
                RankDefinition def = JsonUtil.fromJson(body, RankDefinition.class);
                if (def == null) {
                    return;
                }
                // Apply permissions on the main thread.
                AsyncUtil.sync(plugin, () -> groupSync.applyPrimaryGroup(uuid, def.primaryGroup));
            } catch (Exception e) {
                logger.debug("Failed to parse rank for " + uuid + ": " + e.getMessage());
            }
        });
    }
}
