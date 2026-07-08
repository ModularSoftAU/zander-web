package org.modularsoft.zander.pgm.rank;

import org.bukkit.Bukkit;
import org.modularsoft.zander.pgm.util.SafeLogger;

import java.util.UUID;

/**
 * Applies permission groups through LuckPerms when present, using reflection so
 * LuckPerms remains an optional dependency. This class deliberately manages ONLY
 * the player's primary group and permission nodes — never chat prefixes,
 * suffixes, tags or chat formatting.
 */
public class PermissionGroupSync {

    private final SafeLogger logger;
    private final boolean luckPermsPresent;
    private Object luckPerms;

    public PermissionGroupSync(SafeLogger logger) {
        this.logger = logger;
        this.luckPermsPresent = Bukkit.getPluginManager().getPlugin("LuckPerms") != null;
        if (luckPermsPresent) {
            try {
                Class<?> provider = Class.forName("net.luckperms.api.LuckPermsProvider");
                this.luckPerms = provider.getMethod("get").invoke(null);
            } catch (Throwable t) {
                logger.warn("LuckPerms detected but API unavailable: " + t.getMessage());
            }
        } else {
            logger.info("LuckPerms not present; rank syncing to permissions is disabled.");
        }
    }

    public boolean isAvailable() {
        return luckPerms != null;
    }

    /**
     * Set the player's primary group. Best-effort and reflective; no chat
     * prefix/suffix or metadata is ever touched.
     */
    public void applyPrimaryGroup(UUID uuid, String group) {
        if (!isAvailable() || group == null || group.isBlank()) {
            return;
        }
        try {
            Object userManager = luckPerms.getClass().getMethod("getUserManager").invoke(luckPerms);
            Object future = userManager.getClass().getMethod("modifyUser", UUID.class, java.util.function.Consumer.class)
                    .invoke(userManager, uuid, (java.util.function.Consumer<Object>) user -> {
                        try {
                            // user.data().clear(NodeType.INHERITANCE...) then add primary group node.
                            Object data = user.getClass().getMethod("data").invoke(user);
                            Class<?> nodeBuilders = Class.forName("net.luckperms.api.node.types.InheritanceNode");
                            Object node = nodeBuilders.getMethod("builder", String.class).invoke(null, group);
                            Object built = node.getClass().getMethod("build").invoke(node);
                            data.getClass().getMethod("add", Class.forName("net.luckperms.api.node.Node"))
                                    .invoke(data, built);
                        } catch (Throwable inner) {
                            logger.debug("LuckPerms group apply failed: " + inner.getMessage());
                        }
                    });
            logger.debug("Applied primary group '" + group + "' to " + uuid + " (future=" + (future != null) + ")");
        } catch (Throwable t) {
            logger.debug("LuckPerms modifyUser failed: " + t.getMessage());
        }
    }
}
