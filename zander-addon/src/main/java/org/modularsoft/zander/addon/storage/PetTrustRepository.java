package org.modularsoft.zander.addon.storage;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import org.modularsoft.zander.addon.model.pettrust.PetTrust;
import org.modularsoft.zander.addon.model.pettrust.PlayerTrust;
import org.modularsoft.zander.addon.model.pettrust.TrustLevel;

import java.io.File;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Level;

public class PetTrustRepository {
    private final JavaPlugin plugin;
    private final File file;
    private FileConfiguration config;
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    public PetTrustRepository(JavaPlugin plugin) {
        this.plugin = plugin;
        this.file = new File(plugin.getDataFolder(), "pettrust.yml");
        load();
    }

    public void load() {
        if (!file.exists()) {
            try {
                file.createNewFile();
            } catch (IOException e) {
                plugin.getLogger().log(Level.SEVERE, "Could not create pettrust.yml", e);
            }
        }
        config = YamlConfiguration.loadConfiguration(file);
    }

    public void save() {
        try {
            config.save(file);
        } catch (IOException e) {
            plugin.getLogger().log(Level.SEVERE, "Could not save pettrust.yml", e);
        }
    }

    public Map<UUID, PetTrust> loadAll() {
        Map<UUID, PetTrust> pets = new HashMap<>();
        ConfigurationSection petsSection = config.getConfigurationSection("pets");
        if (petsSection == null) return pets;

        for (String key : petsSection.getKeys(false)) {
            try {
                UUID petUuid = UUID.fromString(key);
                ConfigurationSection section = petsSection.getConfigurationSection(key);
                if (section == null) continue;

                PetTrust petTrust = new PetTrust();
                petTrust.setPetUuid(petUuid);
                petTrust.setOwnerUuid(UUID.fromString(section.getString("owner")));
                petTrust.setOwnerName(section.getString("ownerName"));
                petTrust.setPetType(section.getString("petType"));
                petTrust.setPublicEnabled(section.getBoolean("public.enabled", false));
                petTrust.setPublicLevel(TrustLevel.valueOf(section.getString("public.level", "ACCESS")));

                ConfigurationSection trustedSection = section.getConfigurationSection("trusted");
                if (trustedSection != null) {
                    for (String playerKey : trustedSection.getKeys(false)) {
                        UUID playerUuid = UUID.fromString(playerKey);
                        ConfigurationSection playerSection = trustedSection.getConfigurationSection(playerKey);

                        PlayerTrust playerTrust = new PlayerTrust();
                        playerTrust.setUuid(playerUuid);
                        playerTrust.setName(playerSection.getString("name"));
                        playerTrust.setLevel(TrustLevel.valueOf(playerSection.getString("level", "ACCESS")));
                        playerTrust.setAddedAt(LocalDateTime.parse(playerSection.getString("addedAt"), FORMATTER));

                        petTrust.getTrustedPlayers().put(playerUuid, playerTrust);
                    }
                }
                pets.put(petUuid, petTrust);
            } catch (Exception e) {
                plugin.getLogger().log(Level.WARNING, "Failed to load pet trust for UUID: " + key, e);
            }
        }
        return pets;
    }

    public void savePet(PetTrust petTrust) {
        String path = "pets." + petTrust.getPetUuid().toString();
        config.set(path + ".owner", petTrust.getOwnerUuid().toString());
        config.set(path + ".ownerName", petTrust.getOwnerName());
        config.set(path + ".petType", petTrust.getPetType());
        config.set(path + ".public.enabled", petTrust.isPublicEnabled());
        config.set(path + ".public.level", petTrust.getPublicLevel().name());

        config.set(path + ".trusted", null); // Clear existing trusted
        for (PlayerTrust pt : petTrust.getTrustedPlayers().values()) {
            String playerPath = path + ".trusted." + pt.getUuid().toString();
            config.set(playerPath + ".name", pt.getName());
            config.set(playerPath + ".level", pt.getLevel().name());
            config.set(playerPath + ".addedAt", pt.getAddedAt().format(FORMATTER));
        }
        save();
    }

    public void deletePet(UUID petUuid) {
        config.set("pets." + petUuid.toString(), null);
        save();
    }
}
