package org.modularsoft.zander.velocity.util.messaging;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import org.modularsoft.zander.velocity.ZanderVelocityMain;
import org.modularsoft.zander.velocity.util.api.FriendService;
import org.slf4j.Logger;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class PrivateMessageService {

    private static final String STORAGE_FILE = "private-messages.json";

    private final Path storagePath;
    private final Gson gson;
    private final Logger logger;
    private final Object lock = new Object();
    private final Map<UUID, UUID> lastConversation = new ConcurrentHashMap<>();
    private MessagingData data;

    public PrivateMessageService(Path dataDirectory, Logger logger) {
        this.storagePath = dataDirectory.resolve(STORAGE_FILE);
        this.gson = new GsonBuilder().setPrettyPrinting().create();
        this.logger = logger;
        load();
    }

    public void updateNameCache(UUID uuid, String name) {
        if (uuid == null || name == null) {
            return;
        }
        synchronized (lock) {
            String key = uuid.toString();
            String existing = data.nameCache.get(key);
            if (!name.equals(existing)) {
                data.nameCache.put(key, name);
                save();
            }
        }
    }

    public Optional<UUID> resolveUuid(String name, ProxyServer proxy) {
        if (name == null) {
            return Optional.empty();
        }
        Optional<Player> online = proxy.getPlayer(name);
        if (online.isPresent()) {
            Player player = online.get();
            updateNameCache(player.getUniqueId(), player.getUsername());
            return Optional.of(player.getUniqueId());
        }
        synchronized (lock) {
            for (Map.Entry<String, String> entry : data.nameCache.entrySet()) {
                if (entry.getValue() != null && entry.getValue().equalsIgnoreCase(name)) {
                    try {
                        return Optional.of(UUID.fromString(entry.getKey()));
                    } catch (IllegalArgumentException ignored) {
                        return Optional.empty();
                    }
                }
            }
        }
        return Optional.empty();
    }

    public Optional<String> getCachedName(UUID uuid) {
        if (uuid == null) {
            return Optional.empty();
        }
        synchronized (lock) {
            return Optional.ofNullable(data.nameCache.get(uuid.toString()));
        }
    }

    // -------------------------------------------------------------------
    // Messaging preferences + ignore list.
    //
    // These used to persist to private-messages.json. They are now a thin
    // facade over the friends API (the single source of truth) — this cache
    // holds only the name cache and last-conversation map. FriendService keeps
    // its own short-TTL cache, so these stay cheap for online players.
    // -------------------------------------------------------------------

    private FriendService friends() {
        return ZanderVelocityMain.getFriendService();
    }

    /** Coarse check with no sender context: true unless the recipient allows everyone. */
    public boolean isMessagesDisabled(UUID uuid) {
        if (uuid == null || friends() == null) {
            return false;
        }
        return friends().getSettings(uuid)
                .map(s -> !"everyone".equalsIgnoreCase(s.allowMessagesFrom()))
                .orElse(true); // fail closed
    }

    /** Sender-aware check — resolves the "friends" case with a friendship lookup. */
    public boolean isMessagesDisabled(UUID recipient, UUID sender) {
        if (recipient == null || friends() == null) {
            return false;
        }
        Optional<FriendService.Settings> maybe = friends().getSettings(recipient);
        if (maybe.isEmpty()) {
            return true; // fail closed
        }
        String mode = maybe.get().allowMessagesFrom();
        if ("everyone".equalsIgnoreCase(mode)) {
            return false;
        }
        if ("none".equalsIgnoreCase(mode)) {
            return true;
        }
        // "friends"
        String senderName = sender != null ? getCachedName(sender).orElse(null) : null;
        return senderName == null || !friends().isFriend(recipient, senderName);
    }

    public void setMessagesDisabled(UUID uuid, boolean disabled) {
        if (uuid == null || friends() == null) {
            return;
        }
        friends().updateSettings(uuid,
                Map.of("allowMessagesFrom", disabled ? "none" : "everyone"));
        friends().invalidate(uuid);
    }

    public boolean isIgnoring(UUID owner, UUID target) {
        if (owner == null || target == null || friends() == null) {
            return false;
        }
        String targetName = getCachedName(target).orElse(null);
        // Fail closed: if we can't resolve the name we cannot prove they are NOT
        // blocked, and FriendService.isBlocked itself fails closed.
        return targetName == null || friends().isBlocked(owner, targetName);
    }

    public boolean addIgnore(UUID owner, UUID target) {
        if (owner == null || target == null || friends() == null) {
            return false;
        }
        String targetName = getCachedName(target).orElse(null);
        if (targetName == null) {
            return false;
        }
        FriendService.ApiResult r = friends().addBlock(owner, targetName);
        if (r.success()) {
            friends().invalidate(owner);
        }
        return r.success();
    }

    public boolean removeIgnore(UUID owner, UUID target) {
        if (owner == null || target == null || friends() == null) {
            return false;
        }
        String targetName = getCachedName(target).orElse(null);
        if (targetName == null) {
            return false;
        }
        FriendService.ApiResult r = friends().removeBlock(owner, targetName);
        if (r.success()) {
            friends().invalidate(owner);
        }
        return r.success();
    }

    public Set<UUID> getIgnoreList(UUID owner) {
        if (owner == null) {
            return Collections.emptySet();
        }
        synchronized (lock) {
            Set<String> ignores = data.ignoreList.get(owner.toString());
            if (ignores == null || ignores.isEmpty()) {
                return Collections.emptySet();
            }
            Set<UUID> results = new HashSet<>();
            for (String entry : ignores) {
                try {
                    results.add(UUID.fromString(entry));
                } catch (IllegalArgumentException ignored) {
                    // ignore invalid entries
                }
            }
            return results;
        }
    }

    public void setLastConversation(UUID sender, UUID target) {
        if (sender == null || target == null) {
            return;
        }
        lastConversation.put(sender, target);
        lastConversation.put(target, sender);
    }

    public Optional<UUID> getLastConversation(UUID sender) {
        if (sender == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(lastConversation.get(sender));
    }

    public void clearLastConversation(UUID sender) {
        if (sender == null) {
            return;
        }
        lastConversation.remove(sender);
    }

    private void load() {
        synchronized (lock) {
            data = new MessagingData();
            if (!Files.exists(storagePath)) {
                return;
            }
            try (Reader reader = Files.newBufferedReader(storagePath)) {
                MessagingData loaded = gson.fromJson(reader, MessagingData.class);
                if (loaded != null) {
                    data = loaded;
                    if (data.messagesDisabled == null) {
                        data.messagesDisabled = new HashMap<>();
                    }
                    if (data.ignoreList == null) {
                        data.ignoreList = new HashMap<>();
                    }
                    if (data.nameCache == null) {
                        data.nameCache = new HashMap<>();
                    }
                }
            } catch (IOException e) {
                logger.error("Failed to load private message storage.", e);
            }
        }
    }

    private void save() {
        synchronized (lock) {
            try {
                Files.createDirectories(storagePath.getParent());
                try (Writer writer = Files.newBufferedWriter(storagePath)) {
                    gson.toJson(data, writer);
                }
            } catch (IOException e) {
                logger.error("Failed to save private message storage.", e);
            }
        }
    }

    private static class MessagingData {
        private Map<String, Boolean> messagesDisabled = new HashMap<>();
        private Map<String, Set<String>> ignoreList = new HashMap<>();
        private Map<String, String> nameCache = new HashMap<>();
    }
}
