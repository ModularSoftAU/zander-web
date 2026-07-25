package dev.anchorlight.zander.hub.commands.portal;

import dev.anchorlight.zander.hub.ZanderHubMain;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;

public class PortalWandListener implements Listener {
    public static final NamespacedKey WAND_KEY = new NamespacedKey(ZanderHubMain.plugin, "portal_wand");
    private static final MiniMessage MM = MiniMessage.miniMessage();

    private final PortalSelectionManager selections;

    public PortalWandListener(PortalSelectionManager selections) {
        this.selections = selections;
    }

    public static ItemStack createWand() {
        String materialName = ZanderHubMain.plugin.getConfig().getString("portal-wand.material", "BLAZE_ROD");
        Material material = Material.matchMaterial(materialName);
        if (material == null) {
            material = Material.BLAZE_ROD;
        }
        String display = ZanderHubMain.plugin.getConfig().getString("portal-wand.display", "<gold>Portal Wand</gold>");

        ItemStack item = new ItemStack(material);
        ItemMeta meta = item.getItemMeta();
        meta.displayName(MM.deserialize(display));
        meta.getPersistentDataContainer().set(WAND_KEY, PersistentDataType.BOOLEAN, true);
        item.setItemMeta(meta);
        return item;
    }

    private static boolean isWand(ItemStack item) {
        if (item == null || !item.hasItemMeta()) {
            return false;
        }
        return Boolean.TRUE.equals(item.getItemMeta().getPersistentDataContainer()
                .get(WAND_KEY, PersistentDataType.BOOLEAN));
    }

    @EventHandler
    public void onInteract(PlayerInteractEvent event) {
        Player player = event.getPlayer();
        if (!isWand(player.getInventory().getItemInMainHand())) {
            return;
        }
        Block block = event.getClickedBlock();
        if (block == null || (event.getAction() != Action.LEFT_CLICK_BLOCK && event.getAction() != Action.RIGHT_CLICK_BLOCK)) {
            return;
        }
        event.setCancelled(true); // never let the wand break/place blocks

        String world = block.getWorld().getName();
        if (event.getAction() == Action.LEFT_CLICK_BLOCK) {
            selections.setPos1(player.getUniqueId(), world, block.getX(), block.getY(), block.getZ());
            player.sendMessage(MM.deserialize("<yellow>Position 1 set: <white>" + world + " "
                    + block.getX() + ", " + block.getY() + ", " + block.getZ() + "</white></yellow>"));
        } else {
            selections.setPos2(player.getUniqueId(), world, block.getX(), block.getY(), block.getZ());
            player.sendMessage(MM.deserialize("<yellow>Position 2 set: <white>" + world + " "
                    + block.getX() + ", " + block.getY() + ", " + block.getZ() + "</white></yellow>"));
        }
    }
}
