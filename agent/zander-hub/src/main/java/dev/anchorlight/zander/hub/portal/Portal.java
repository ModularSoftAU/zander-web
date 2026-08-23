package dev.anchorlight.zander.hub.portal;

import java.util.Objects;

/**
 * An immutable, fully-validated custom portal: a cuboid region that, when entered,
 * sends the player to a server or a local location.
 */
public record Portal(String id, String displayName, boolean enabled, PortalRegion region,
        PortalDestination destination, String permission, long cooldownMs, String sound,
        String successMessage, String deniedMessage) {
    public Portal {
        if (!PortalIdValidator.isValid(id)) {
            throw new IllegalArgumentException("Invalid portal id: " + id);
        }
        Objects.requireNonNull(displayName, "displayName");
        Objects.requireNonNull(region, "region");
        Objects.requireNonNull(destination, "destination");
        Objects.requireNonNull(successMessage, "successMessage");
        Objects.requireNonNull(deniedMessage, "deniedMessage");
        if (cooldownMs < 0) {
            throw new IllegalArgumentException("cooldownMs must not be negative: " + cooldownMs);
        }
    }
}
