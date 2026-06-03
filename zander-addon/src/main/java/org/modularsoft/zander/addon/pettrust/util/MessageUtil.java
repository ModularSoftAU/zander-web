package org.modularsoft.zander.addon.pettrust.util;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.FileConfiguration;

public final class MessageUtil {
    private static final LegacyComponentSerializer LEGACY = LegacyComponentSerializer.legacyAmpersand();

    private MessageUtil() {}

    public static Component parse(String raw) {
        return LEGACY.deserialize(raw);
    }

    public static void send(CommandSender sender, FileConfiguration config, String key, String fallback) {
        String prefix = config.getString("petTrust.messages.prefix", "&6[PetTrust]&r ");
        String body = config.getString("petTrust.messages." + key, fallback);
        sender.sendMessage(LEGACY.deserialize(prefix + body));
    }

    public static void send(CommandSender sender, String raw) {
        sender.sendMessage(LEGACY.deserialize(raw));
    }
}
