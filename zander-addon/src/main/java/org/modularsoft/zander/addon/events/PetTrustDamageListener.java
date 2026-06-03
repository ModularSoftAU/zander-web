package org.modularsoft.zander.addon.events;

import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Tameable;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.modularsoft.zander.addon.ZanderAddonMain;
import org.modularsoft.zander.addon.model.pettrust.TrustLevel;
import org.modularsoft.zander.addon.service.PetTrustService;

public class PetTrustDamageListener implements Listener {
    private final ZanderAddonMain plugin;
    private final PetTrustService trustService;

    public PetTrustDamageListener(ZanderAddonMain plugin, PetTrustService trustService) {
        this.plugin = plugin;
        this.trustService = trustService;
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onPetDamage(EntityDamageByEntityEvent event) {
        if (!plugin.getConfig().getBoolean("petTrust.enabled", true)) return;
        if (!plugin.getConfig().getBoolean("petTrust.preventDamageWithoutManage", true)) return;

        Entity entity = event.getEntity();
        if (!(entity instanceof Tameable tameable) || !tameable.isTamed() || tameable.getOwner() == null) return;

        Entity damagerEntity = event.getDamager();
        if (!(damagerEntity instanceof Player player)) return;
        if (player.hasPermission("zander.pettrust.bypass")) return;

        if (!trustService.hasPermission(player, entity, TrustLevel.MANAGE)) {
            event.setCancelled(true);
            String raw = plugin.getConfig().getString("petTrust.noPermissionMessage", "&cYou are not trusted to use this pet.");
            player.sendMessage(LegacyComponentSerializer.legacyAmpersand().deserialize(raw));
        }
    }
}
