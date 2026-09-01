package org.modularsoft.zander.velocity.util.messaging;

import com.velocitypowered.api.proxy.Player;

import java.lang.reflect.Method;
import java.util.UUID;

/**
 * Resolves PremiumVanish state through reflection so the proxy carries no hard
 * dependency on the vanish plugin.
 *
 * <p>Presence-leaking features must call {@link #isPresenceSafe()} first: it is
 * only {@code true} when the PremiumVanish API is actually loaded and callable.
 * When it returns {@code false} the caller must publish nothing rather than
 * guess, because a wrong guess turns "offline" and "vanished" into
 * distinguishable states.</p>
 *
 * <p>{@link #isVanished(Player)} fails <em>closed</em> (returns {@code true})
 * whenever the API is present but a lookup throws, so a transient error never
 * reveals a vanished player. It returns {@code false} only when PremiumVanish is
 * not installed at all — i.e. the whole feature is absent.</p>
 */
public class VanishStatusResolver {

    private static final Object LOCK = new Object();

    /** null = not yet probed, TRUE/FALSE = API present or absent. */
    private static volatile Boolean apiAvailable = null;
    private static volatile Method isInvisibleMethod = null;

    private VanishStatusResolver() {
    }

    private static void ensureProbed() {
        if (apiAvailable != null) {
            return;
        }
        synchronized (LOCK) {
            if (apiAvailable != null) {
                return;
            }
            try {
                // Use VelocityVanishAPI with UUID to avoid Player type mismatch between
                // com.velocitypowered.api.proxy.Player and org.bukkit.entity.Player
                Class<?> apiClass = Class.forName("de.myzelyam.api.vanish.VelocityVanishAPI");
                isInvisibleMethod = apiClass.getMethod("isInvisible", UUID.class);
                apiAvailable = Boolean.TRUE;
            } catch (ReflectiveOperationException | LinkageError ignored) {
                isInvisibleMethod = null;
                apiAvailable = Boolean.FALSE;
            }
        }
    }

    /**
     * @return {@code true} only when vanish state can be reliably determined.
     *         Presence reads must be skipped entirely when this is {@code false}.
     */
    public static boolean isPresenceSafe() {
        ensureProbed();
        return Boolean.TRUE.equals(apiAvailable) && isInvisibleMethod != null;
    }

    public static boolean isVanished(Player player) {
        if (player == null) {
            return false;
        }
        return isVanished(player.getUniqueId());
    }

    public static boolean isVanished(UUID uuid) {
        if (uuid == null) {
            return false;
        }
        ensureProbed();

        // PremiumVanish not installed -> the feature is off, nobody is vanished.
        if (!Boolean.TRUE.equals(apiAvailable) || isInvisibleMethod == null) {
            return false;
        }

        try {
            Object result = isInvisibleMethod.invoke(null, uuid);
            if (result instanceof Boolean) {
                return (Boolean) result;
            }
            // Unexpected return type from a present API: fail closed.
            return true;
        } catch (ReflectiveOperationException | LinkageError e) {
            // API is installed but the lookup failed: fail closed so we never
            // leak a vanished player through a transient error.
            return true;
        }
    }
}
