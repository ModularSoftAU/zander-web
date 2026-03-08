package org.modularsoft.zander.hub.items;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Material;
import org.bukkit.event.Listener;
import org.bukkit.inventory.ItemStack;
import org.modularsoft.zander.hub.utils.ItemBuilder;

public class NavigationCompassItem implements Listener {
    public static ItemStack createCompass() {
        return ItemBuilder.of(Material.COMPASS)
                .name(Component.text("Navigation Compass", NamedTextColor.AQUA, TextDecoration.BOLD))
                .lore(Component.text("Right Click me to access Servers", NamedTextColor.YELLOW))
                .build();
    }
}
