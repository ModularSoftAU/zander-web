package org.modularsoft.zander.addon.pettrust.storage;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import org.modularsoft.zander.addon.pettrust.TrustLevel;
import org.modularsoft.zander.addon.pettrust.model.AnchorData;
import org.modularsoft.zander.addon.pettrust.model.PetTrustData;
import org.modularsoft.zander.addon.pettrust.model.PlayerTrustEntry;

import java.io.File;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Level;

public class PetTrustRepository {
    private static final int CURRENT_VERSION = 1;
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final JavaPlugin plugin;
    private final File file;
    private FileConfiguration config;
    private boolean loadFailed = false;

    public PetTrustRepository(JavaPlugin plugin) {
        this.plugin = plugin;
        this.file = new File(plugin.getDataFolder(), "pettrust.yml");
        load();
    }

    private void load() {
        plugin.getDataFolder().mkdirs();
        if (!file.exists()) {
            try {
                file.createNewFile();
            } catch (IOException e) {
                plugin.getLogger().log(Level.SEVERE, "Could not create pettrust.yml", e);
                loadFailed = true;
                return;
            }
        }
        config = YamlConfiguration.loadConfiguration(file);
        if (!config.contains("version")) {
            config.set("version", CURRENT_VERSION);
        }
    }

    public Map<UUID, PetTrustData> loadAll() {
        Map<UUID, PetTrustData> pets = new HashMap<>();
        if (loadFailed) return pets;

        ConfigurationSection petsSection = config.getConfigurationSection("pets");
        if (petsSection == null) return pets;

        for (String key : petsSection.getKeys(false)) {
            try {
                UUID petUuid = UUID.fromString(key);
                ConfigurationSection s = petsSection.getConfigurationSection(key);
                if (s == null) continue;

                PetTrustData data = new PetTrustData();
                data.setPetUuid(petUuid);

                String ownerStr = s.getString("owner", "");
                if (ownerStr.isEmpty()) {
                    plugin.getLogger().warning("Pet entry '" + key + "' has no owner UUID — skipping.");
                    continue;
                }
                data.setOwnerUuid(UUID.fromString(ownerStr));
                data.setOwnerName(s.getString("ownerName", "Unknown"));
                data.setPetType(s.getString("petType", "UNKNOWN"));
                data.setDisplayName(s.getString("displayName", null));
                data.setLastKnownWorld(s.getString("lastKnownWorld", null));
                data.setLastKnownX(s.getDouble("lastKnownLocation.x", 0));
                data.setLastKnownY(s.getDouble("lastKnownLocation.y", 0));
                data.setLastKnownZ(s.getDouble("lastKnownLocation.z", 0));

                ConfigurationSection pub = s.getConfigurationSection("public");
                if (pub != null) {
                    data.setPublicEnabled(pub.getBoolean("enabled", false));
                    TrustLevel pubLevel = TrustLevel.parse(pub.getString("level", "ACCESS"));
                    data.setPublicLevel(pubLevel != null ? pubLevel : TrustLevel.ACCESS);
                }

                ConfigurationSection trusted = s.getConfigurationSection("trusted");
                if (trusted != null) {
                    for (String playerKey : trusted.getKeys(false)) {
                        try {
                            UUID playerUuid = UUID.fromString(playerKey);
                            ConfigurationSection ps = trusted.getConfigurationSection(playerKey);
                            if (ps == null) continue;

                            TrustLevel level = TrustLevel.parse(ps.getString("level", "ACCESS"));
                            if (level == null) level = TrustLevel.ACCESS;

                            PlayerTrustEntry entry = new PlayerTrustEntry(
                                playerUuid,
                                ps.getString("name", "Unknown"),
                                level,
                                parseDateTime(ps.getString("addedAt")),
                                parseDateTime(ps.getString("updatedAt"))
                            );
                            data.getTrustedPlayers().put(playerUuid, entry);
                        } catch (Exception e) {
                            plugin.getLogger().warning("Skipping invalid trusted entry '" + playerKey
                                + "' for pet " + key + ": " + e.getMessage());
                        }
                    }
                }

                ConfigurationSection anchor = s.getConfigurationSection("anchor");
                if (anchor != null) {
                    AnchorData a = new AnchorData(
                        anchor.getBoolean("enabled", false),
                        anchor.getString("world", "world"),
                        anchor.getDouble("x", 0), anchor.getDouble("y", 64), anchor.getDouble("z", 0),
                        (float) anchor.getDouble("yaw", 0), (float) anchor.getDouble("pitch", 0),
                        anchor.getDouble("radius", 3.0)
                    );
                    data.setAnchor(a);
                }

                pets.put(petUuid, data);
            } catch (Exception e) {
                plugin.getLogger().log(Level.WARNING, "Failed to load pet trust entry '" + key + "' — skipping.", e);
            }
        }
        return pets;
    }

    public void savePet(PetTrustData data) {
        if (loadFailed) return;
        String path = "pets." + data.getPetUuid();

        config.set(path + ".owner", data.getOwnerUuid().toString());
        config.set(path + ".ownerName", data.getOwnerName());
        config.set(path + ".petType", data.getPetType());
        config.set(path + ".displayName", data.getDisplayName());
        if (data.getLastKnownWorld() != null) {
            config.set(path + ".lastKnownWorld", data.getLastKnownWorld());
            config.set(path + ".lastKnownLocation.x", data.getLastKnownX());
            config.set(path + ".lastKnownLocation.y", data.getLastKnownY());
            config.set(path + ".lastKnownLocation.z", data.getLastKnownZ());
        }

        config.set(path + ".public.enabled", data.isPublicEnabled());
        config.set(path + ".public.level", data.getPublicLevel().name());

        config.set(path + ".trusted", null);
        for (PlayerTrustEntry entry : data.getTrustedPlayers().values()) {
            String ep = path + ".trusted." + entry.getUuid();
            config.set(ep + ".name", entry.getName());
            config.set(ep + ".level", entry.getLevel().name());
            config.set(ep + ".addedAt", formatDateTime(entry.getAddedAt()));
            config.set(ep + ".updatedAt", formatDateTime(entry.getUpdatedAt()));
        }

        if (data.getAnchor() != null) {
            AnchorData a = data.getAnchor();
            config.set(path + ".anchor.enabled", a.isEnabled());
            config.set(path + ".anchor.world", a.getWorld());
            config.set(path + ".anchor.x", a.getX());
            config.set(path + ".anchor.y", a.getY());
            config.set(path + ".anchor.z", a.getZ());
            config.set(path + ".anchor.yaw", (double) a.getYaw());
            config.set(path + ".anchor.pitch", (double) a.getPitch());
            config.set(path + ".anchor.radius", a.getRadius());
        } else {
            config.set(path + ".anchor", null);
        }
    }

    public void deletePet(UUID petUuid) {
        if (loadFailed) return;
        config.set("pets." + petUuid, null);
    }

    public void save() {
        if (loadFailed) {
            plugin.getLogger().warning("Refusing to save pettrust.yml — file failed to load originally.");
            return;
        }
        try {
            config.save(file);
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Could not save pettrust.yml", e);
        }
    }

    private OffsetDateTime parseDateTime(String s) {
        if (s == null || s.isEmpty()) return OffsetDateTime.now();
        try {
            return OffsetDateTime.parse(s, FORMATTER);
        } catch (Exception e) {
            return OffsetDateTime.now();
        }
    }

    private String formatDateTime(OffsetDateTime dt) {
        return (dt != null ? dt : OffsetDateTime.now()).format(FORMATTER);
    }
}
