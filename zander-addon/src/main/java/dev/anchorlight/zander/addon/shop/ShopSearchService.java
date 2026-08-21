package dev.anchorlight.zander.addon.shop;

import org.bukkit.Location;

import java.util.Comparator;
import java.util.List;

public final class ShopSearchService {

    private ShopSearchService() {
    }

    public static String normalize(String raw) {
        return raw.trim().toLowerCase().replace('_', ' ').replaceAll("\\s+", " ");
    }

    public static boolean matches(String normalizedQuery, ShopDirectoryEntry entry) {
        if (normalizedQuery.isBlank()) {
            return true;
        }
        String displayName = normalize(entry.itemDisplayName());
        String materialName = normalize(entry.item().name());
        return displayName.contains(normalizedQuery) || materialName.contains(normalizedQuery);
    }

    public static List<ShopDirectoryEntry> search(List<ShopDirectoryEntry> index, String query,
                                                    ShopDirectoryConfig config, Location playerLocation,
                                                    String playerWorld) {
        String normalizedQuery = normalize(query);

        return index.stream()
                .filter(e -> config.worlds().isEmpty() || config.worlds().contains(e.world()))
                .filter(e -> !config.sellingOnly() || e.kind() == ShopDirectoryEntry.ShopKind.SELLING)
                .filter(e -> !config.inStockOnly() || e.stock() > 0)
                .filter(e -> matches(normalizedQuery, e))
                .sorted(Comparator.comparingDouble(ShopDirectoryEntry::price)
                        .thenComparingDouble(e -> distanceOrInfinite(e, playerLocation, playerWorld)))
                .toList();
    }

    private static double distanceOrInfinite(ShopDirectoryEntry entry, Location playerLocation, String playerWorld) {
        if (!entry.world().equals(playerWorld)) {
            return Double.MAX_VALUE;
        }
        return playerLocation.distance(entry.location());
    }
}
