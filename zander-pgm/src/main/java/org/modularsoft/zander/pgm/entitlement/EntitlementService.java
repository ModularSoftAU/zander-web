package org.modularsoft.zander.pgm.entitlement;

import org.modularsoft.zander.pgm.api.ZanderApiClient;
import org.modularsoft.zander.pgm.config.ZanderPGMConfig;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks generic entitlements per player and exposes them to gameplay features
 * (e.g. supporter vote weight). Chat tags / chat formatting are excluded by design.
 */
public class EntitlementService {

    private final ZanderPGMConfig config;
    private final ZanderApiClient api;
    private final ConcurrentHashMap<UUID, List<String>> playerEntitlements = new ConcurrentHashMap<>();

    public EntitlementService(ZanderPGMConfig config, ZanderApiClient api) {
        this.config = config;
        this.api = api;
    }

    public void setEntitlements(UUID uuid, List<String> entitlements) {
        playerEntitlements.put(uuid, entitlements);
    }

    public boolean has(UUID uuid, String key) {
        List<String> list = playerEntitlements.get(uuid);
        return list != null && list.contains(key);
    }

    public boolean isSupporter(UUID uuid) {
        return has(uuid, "supporter");
    }

    /** Report the current entitlement view for a player to zander-web. */
    public void sync(UUID uuid, String username, List<String> entitlements) {
        if (!config.feature("entitlements")) {
            return;
        }
        setEntitlements(uuid, entitlements);
        Map<String, Object> dto = new java.util.HashMap<>();
        dto.put("uuid", uuid.toString());
        dto.put("username", username);
        dto.put("entitlements", entitlements);
        api.entitlementsSync(dto);
    }

    public void clear(UUID uuid) {
        playerEntitlements.remove(uuid);
    }
}
