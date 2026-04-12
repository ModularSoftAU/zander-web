package org.modularsoft.zander.hub.hall.gui;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.modularsoft.zander.hub.ZanderHubMain;
import org.modularsoft.zander.hub.hall.models.HallCustomization;

import java.util.Arrays;
import java.util.List;

public class CustomizationGui implements Listener {
    private final ZanderHubMain plugin;
    private final String title = "Statue Customization";

    private final List<Material> chestplates = Arrays.asList(
            Material.LEATHER_CHESTPLATE, Material.CHAINMAIL_CHESTPLATE, Material.IRON_CHESTPLATE,
            Material.GOLDEN_CHESTPLATE, Material.DIAMOND_CHESTPLATE, Material.NETHERITE_CHESTPLATE, Material.AIR
    );

    private final List<Material> leggings = Arrays.asList(
            Material.LEATHER_LEGGINGS, Material.CHAINMAIL_LEGGINGS, Material.IRON_LEGGINGS,
            Material.GOLDEN_LEGGINGS, Material.DIAMOND_LEGGINGS, Material.NETHERITE_LEGGINGS, Material.AIR
    );

    private final List<Material> boots = Arrays.asList(
            Material.LEATHER_BOOTS, Material.CHAINMAIL_BOOTS, Material.IRON_BOOTS,
            Material.GOLDEN_BOOTS, Material.DIAMOND_BOOTS, Material.NETHERITE_BOOTS, Material.AIR
    );

    private final List<Material> weapons = Arrays.asList(
            Material.IRON_SWORD, Material.GOLDEN_SWORD, Material.DIAMOND_SWORD, Material.NETHERITE_SWORD,
            Material.IRON_AXE, Material.GOLDEN_AXE, Material.DIAMOND_AXE, Material.NETHERITE_AXE,
            Material.BOW, Material.CROSSBOW, Material.TRIDENT, Material.AIR
    );

    private final List<Material> offhandItems = Arrays.asList(
            Material.SHIELD, Material.TOTEM_OF_UNDYING, Material.FIREWORK_ROCKET, Material.TORCH, Material.AIR
    );

    private final List<String> posePresets = Arrays.asList("DEFAULT", "ZOMBIE", "RUNNING", "DANCING");

    private final List<String> particlePresets = Arrays.asList("NONE", "HEART", "HAPPY_VILLAGER", "FLAME", "SOUL_FIRE_FLAME", "WITCH", "TOTEM_OF_UNDYING");

    public CustomizationGui(ZanderHubMain plugin) {
        this.plugin = plugin;
    }

    public void open(Player player) {
        if (plugin.getHallManager().getAssignmentForPlayer(player.getUniqueId()) == null) {
            player.sendMessage(Component.text("You don't have an assigned statue to customize!", NamedTextColor.RED));
            return;
        }

        Inventory inv = Bukkit.createInventory(null, 27, Component.text(title));

        // Armor Slots
        inv.setItem(10, createItem(Material.DIAMOND_CHESTPLATE, "Chestplate"));
        inv.setItem(11, createItem(Material.DIAMOND_LEGGINGS, "Leggings"));
        inv.setItem(12, createItem(Material.DIAMOND_BOOTS, "Boots"));

        // Items
        inv.setItem(14, createItem(Material.IRON_SWORD, "Main Hand"));
        inv.setItem(15, createItem(Material.SHIELD, "Off Hand"));

        // Effects
        inv.setItem(16, createItem(Material.ARMOR_STAND, "Cycle Pose"));
        inv.setItem(17, createItem(Material.BLAZE_POWDER, "Cycle Particles"));

        // Reset
        inv.setItem(22, createItem(Material.BARRIER, "Reset Statue"));

        player.openInventory(inv);
    }

    private ItemStack createItem(Material m, String name) {
        ItemStack item = new ItemStack(m == Material.AIR ? Material.BARRIER : m);
        ItemMeta meta = item.getItemMeta();
        meta.displayName(Component.text(name, NamedTextColor.YELLOW));
        item.setItemMeta(meta);
        return item;
    }

    @EventHandler
    public void onClick(InventoryClickEvent event) {
        if (!event.getView().title().equals(Component.text(title))) return;
        event.setCancelled(true);

        Player player = (Player) event.getWhoClicked();
        ItemStack clicked = event.getCurrentItem();
        if (clicked == null) return;

        HallCustomization custom = plugin.getHallManager().getCustomizationService().getCustomization(player.getUniqueId());
        if (custom == null) {
            custom = new HallCustomization(player.getUniqueId());
        }

        switch (event.getSlot()) {
            case 10: cycleArmor(player, custom, "chest"); break;
            case 11: cycleArmor(player, custom, "legs"); break;
            case 12: cycleArmor(player, custom, "boots"); break;
            case 14: cycleItem(player, custom, true); break;
            case 15:
                if (player.hasPermission("hall.customize.offhand")) {
                    cycleItem(player, custom, false);
                } else {
                    player.sendMessage(Component.text("No permission for offhand customization.", NamedTextColor.RED));
                }
                break;
            case 16: cyclePose(player, custom); break;
            case 17: cycleParticles(player, custom); break;
            case 22:
                plugin.getHallManager().getCustomizationService().saveCustomization(new HallCustomization(player.getUniqueId()));
                player.sendMessage(Component.text("Statue reset!", NamedTextColor.GREEN));
                player.closeInventory();
                return;
            default: return;
        }

        plugin.getHallManager().getCustomizationService().saveCustomization(custom);
    }

    private void cycleArmor(Player player, HallCustomization custom, String type) {
        List<Material> pool = switch (type) {
            case "chest" -> chestplates;
            case "legs" -> leggings;
            case "boots" -> boots;
            default -> Arrays.asList(Material.AIR);
        };

        Material current = switch (type) {
            case "chest" -> custom.getChestplate();
            case "legs" -> custom.getLeggings();
            case "boots" -> custom.getBoots();
            default -> null;
        };

        int index = (current == null) ? pool.indexOf(Material.AIR) : pool.indexOf(current);
        index = (index + 1) % pool.size();
        Material next = pool.get(index);
        if (next == Material.AIR) next = null;

        switch (type) {
            case "chest" -> custom.setChestplate(next);
            case "legs" -> custom.setLeggings(next);
            case "boots" -> custom.setBoots(next);
        }
        player.sendMessage(Component.text("Updated " + type + "!", NamedTextColor.GREEN));
    }

    private void cycleItem(Player player, HallCustomization custom, boolean mainHand) {
        List<Material> pool = mainHand ? weapons : offhandItems;
        Material current = mainHand ? custom.getMainHand() : custom.getOffHand();

        int index = (current == null) ? pool.indexOf(Material.AIR) : pool.indexOf(current);
        index = (index + 1) % pool.size();
        Material next = pool.get(index);
        if (next == Material.AIR) next = null;

        if (mainHand) custom.setMainHand(next);
        else custom.setOffHand(next);

        player.sendMessage(Component.text("Updated " + (mainHand ? "main hand" : "off hand") + "!", NamedTextColor.GREEN));
    }

    private void cyclePose(Player player, HallCustomization custom) {
        String current = custom.getPosePreset();
        int index = (current == null) ? 0 : posePresets.indexOf(current);
        index = (index + 1) % posePresets.size();
        String next = posePresets.get(index);

        custom.setPosePreset(next);
        custom.setBodyPose(null);
        custom.setHeadPose(null);
        custom.setLeftArmPose(null);
        custom.setRightArmPose(null);
        custom.setLeftLegPose(null);
        custom.setRightLegPose(null);

        player.sendMessage(Component.text("Updated pose to " + next + "!", NamedTextColor.GREEN));
    }

    private void cycleParticles(Player player, HallCustomization custom) {
        String current = custom.getParticleEffect();
        if (current == null) current = "NONE";

        int index = particlePresets.indexOf(current);
        index = (index + 1) % particlePresets.size();
        String next = particlePresets.get(index);

        custom.setParticleEffect(next.equals("NONE") ? null : next);
        player.sendMessage(Component.text("Updated particles to " + next + "!", NamedTextColor.GREEN));
    }
}
