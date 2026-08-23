package dev.anchorlight.zander.hub.gui;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;
import dev.anchorlight.zander.hub.ConfigurationManager;
import dev.anchorlight.zander.hub.ZanderHubMain;
import dev.anchorlight.zander.hub.configs.CompassConfig.CompassServerEntry;
import dev.anchorlight.zander.hub.events.PluginMessageChannel;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

public class HubCompassItem implements Listener {
    private static final NamespacedKey SERVER_ID_KEY = new NamespacedKey(ZanderHubMain.plugin, "compass_server_id");
    private static final String COMPASS_TITLE = "Server Selector";

    /// Marker so the click handler can recognise a Navigation Compass inventory
    /// without relying on title text or a shared static instance.
    private static class CompassInventoryHolder implements InventoryHolder {
        private Inventory inventory;

        @Override
        public Inventory getInventory() {
            return inventory;
        }
    }

    @EventHandler
    public void onPlayerInteract(PlayerInteractEvent event) {
        Player player = event.getPlayer();

        if (player.getInventory().getItemInMainHand().getType() == Material.COMPASS) {
            if (event.getAction() == Action.LEFT_CLICK_AIR || event.getAction() == Action.RIGHT_CLICK_AIR || event.getAction() == Action.RIGHT_CLICK_BLOCK) {
                openCompassGui(player);
            }
        }
    }

    public void openCompassGui(Player player) {
        if (player == null) {
            return;
        }

        List<CompassServerEntry> permitted = new ArrayList<>();
        for (CompassServerEntry entry : ConfigurationManager.getCompass().getServers()) {
            if (player.hasPermission("bungeecord.server." + entry.id())) {
                permitted.add(entry);
            }
        }

        CompletableFuture<List<String>> serverListFuture = ZanderHubMain.proxyMessaging.requestServerList(player);
        List<CompletableFuture<Integer>> countFutures = new ArrayList<>();
        for (CompassServerEntry entry : permitted) {
            countFutures.add(ZanderHubMain.proxyMessaging.requestPlayerCount(player, entry.id()));
        }

        List<CompletableFuture<?>> allFutures = new ArrayList<>();
        allFutures.add(serverListFuture);
        allFutures.addAll(countFutures);

        CompletableFuture.allOf(allFutures.toArray(new CompletableFuture[0]))
                .handle((ignoredResult, ignoredError) -> null)
                .thenRun(() -> Bukkit.getScheduler().runTask(ZanderHubMain.plugin,
                        () -> buildAndShowGui(player, permitted, serverListFuture, countFutures)));
    }

    private void buildAndShowGui(Player player, List<CompassServerEntry> permitted,
            CompletableFuture<List<String>> serverListFuture, List<CompletableFuture<Integer>> countFutures) {
        List<String> liveServers = getIfCompletedSuccessfully(serverListFuture); // null => GetServers timed out, don't filter

        List<CompassServerEntry> visible = new ArrayList<>();
        List<Integer> counts = new ArrayList<>();
        for (int i = 0; i < permitted.size(); i++) {
            CompassServerEntry entry = permitted.get(i);
            if (liveServers != null && !liveServers.contains(entry.id())) {
                continue;
            }
            visible.add(entry);
            counts.add(getIfCompletedSuccessfully(countFutures.get(i)));
        }

        CompassInventoryHolder holder = new CompassInventoryHolder();
        Inventory inventory = Bukkit.createInventory(holder, 9, Component.text(COMPASS_TITLE));
        holder.inventory = inventory;

        int[] slots = computeEvenlySpacedSlots(visible.size(), 9);
        for (int i = 0; i < visible.size(); i++) {
            int slot = slots[i];
            CompassServerEntry entry = visible.get(i);
            Integer count = counts.get(i);
            String countLine = count != null ? "Players online: " + count : "Players online: unavailable";

            ItemStack item = new ItemStack(entry.material());
            ItemMeta meta = item.getItemMeta();
            meta.displayName(Component.text(entry.display(), NamedTextColor.WHITE));
            meta.lore(List.of(
                    Component.text(entry.lore(), NamedTextColor.WHITE),
                    Component.text(countLine, NamedTextColor.GRAY)));
            meta.getPersistentDataContainer().set(SERVER_ID_KEY, PersistentDataType.STRING, entry.id());
            item.setItemMeta(meta);
            inventory.setItem(slot, item);
        }

        player.openInventory(inventory);
    }

    /// Distributes {@code count} icons across a row of {@code rowSize} slots, centred and
    /// evenly spaced (e.g. 3 icons in a 9-wide row land on slots 1, 4, 7).
    private static int[] computeEvenlySpacedSlots(int count, int rowSize) {
        if (count > rowSize) {
            count = rowSize;
        }
        int[] slots = new int[count];
        if (count == 0) {
            return slots;
        }
        if (count == 1) {
            slots[0] = rowSize / 2;
            return slots;
        }

        double gap = (double) rowSize / count;
        double margin = (rowSize - gap * (count - 1)) / 2.0;
        for (int i = 0; i < count; i++) {
            slots[i] = (int) Math.round(margin + gap * i);
        }
        return slots;
    }

    private static <T> T getIfCompletedSuccessfully(CompletableFuture<T> future) {
        if (future.isCompletedExceptionally()) {
            return null;
        }
        return future.getNow(null);
    }

    @EventHandler
    public void onClick(InventoryClickEvent event) {
        if (!(event.getInventory().getHolder() instanceof CompassInventoryHolder)) {
            return;
        }

        Player player = (Player) event.getWhoClicked();
        event.setCancelled(true);

        ItemStack clicked = event.getCurrentItem();
        if (clicked == null || !clicked.hasItemMeta()) {
            player.closeInventory();
            return;
        }

        ItemMeta meta = clicked.getItemMeta();
        String serverId = meta.getPersistentDataContainer().get(SERVER_ID_KEY, PersistentDataType.STRING);
        if (serverId == null) {
            player.closeInventory();
            return;
        }

        player.closeInventory();

        String permission = "bungeecord.server." + serverId;
        if (!player.hasPermission(permission)) {
            player.sendMessage(Component.text("You do not have access to this server.", NamedTextColor.RED));
            return;
        }

        player.sendMessage(Component.text("Sending you to " + serverId + "...", NamedTextColor.YELLOW));
        PluginMessageChannel.connect(player, serverId);
    }
}
