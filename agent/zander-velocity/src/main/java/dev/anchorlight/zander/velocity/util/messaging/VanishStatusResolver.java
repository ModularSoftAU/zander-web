package dev.anchorlight.zander.velocity.util.messaging;

import com.velocitypowered.api.proxy.Player;

import java.lang.reflect.Method;
import java.util.UUID;

public class VanishStatusResolver {

    private VanishStatusResolver() {
    }

    public static boolean isVanished(Player player) {
        if (player == null) {
            return false;
        }
        try {
            // Use VelocityVanishAPI with UUID to avoid Player type mismatch between
            // com.velocitypowered.api.proxy.Player and org.bukkit.entity.Player
            Class<?> apiClass = Class.forName("de.myzelyam.api.vanish.VelocityVanishAPI");
            Method method = apiClass.getMethod("isInvisible", UUID.class);
            Object result = method.invoke(null, player.getUniqueId());
            if (result instanceof Boolean) {
                return (Boolean) result;
            }
        } catch (ReflectiveOperationException | LinkageError ignored) {
            return false;
        }
        return false;
    }
}
