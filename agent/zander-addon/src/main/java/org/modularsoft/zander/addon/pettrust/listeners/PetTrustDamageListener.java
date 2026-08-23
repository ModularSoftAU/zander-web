package org.modularsoft.zander.addon.pettrust.listeners;

import org.bukkit.entity.Entity;
import org.bukkit.entity.Monster;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.modularsoft.zander.addon.ZanderAddonMain;
import org.modularsoft.zander.addon.pettrust.PetAction;
import org.modularsoft.zander.addon.pettrust.service.PetTrustService;
import org.modularsoft.zander.addon.pettrust.util.MessageUtil;

public class PetTrustDamageListener implements Listener {
    private final ZanderAddonMain plugin;
    private final PetTrustService service;

    public PetTrustDamageListener(ZanderAddonMain plugin, PetTrustService service) {
        this.plugin = plugin;
        this.service = service;
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onDamage(EntityDamageByEntityEvent event) {
        if (!plugin.getConfig().getBoolean("petTrust.enabled", true)) return;
        if (!plugin.getConfig().getBoolean("petTrust.preventDamageWithoutManage", true)) return;

        Entity victim = event.getEntity();
        if (!service.isSupportedPet(victim)) return;

        // If a hostile mob is riding this pet (e.g. zombie on a tamed wolf from a mob farm),
        // skip protection so players can kill the combo without needing trust.
        if (hasHostileRider(victim)) return;

        Player attacker = resolvePlayer(event.getDamager());
        if (attacker == null) return;

        if (service.isOwner(attacker, victim)) return;

        boolean allowManagersToDamage = plugin.getConfig().getBoolean("petTrust.allowManagersToDamage", false);

        if (allowManagersToDamage && service.canPerform(attacker, victim, PetAction.DAMAGE)) return;

        if (!allowManagersToDamage && attacker.hasPermission("zanderaddon.pettrust.bypass")) return;

        event.setCancelled(true);
        MessageUtil.send(attacker, plugin.getConfig(), "noPermission",
            "&cYou are not trusted to do that with this pet.");
    }

    private Player resolvePlayer(Entity damager) {
        if (damager instanceof Player p) return p;
        if (damager instanceof Projectile proj && proj.getShooter() instanceof Player p) return p;
        return null;
    }

    private boolean hasHostileRider(Entity entity) {
        return entity.getPassengers().stream().anyMatch(p -> p instanceof Monster);
    }
}
