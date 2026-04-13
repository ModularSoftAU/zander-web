package org.modularsoft.zander.hub.hall.services;

import net.luckperms.api.LuckPerms;
import net.luckperms.api.LuckPermsProvider;
import net.luckperms.api.model.group.Group;
import net.luckperms.api.model.user.User;
import net.luckperms.api.node.Node;
import net.luckperms.api.node.matcher.NodeMatcher;
import net.luckperms.api.node.types.InheritanceNode;
import org.bukkit.Bukkit;
import org.modularsoft.zander.hub.ZanderHubMain;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

public class LuckPermsService {
    private final ZanderHubMain plugin;
    private LuckPerms luckPerms;

    public LuckPermsService(ZanderHubMain plugin) {
        this.plugin = plugin;
        try {
            this.luckPerms = LuckPermsProvider.get();
        } catch (IllegalStateException | NoClassDefFoundError e) {
            plugin.getLogger().warning("LuckPerms not found! Hall auto-population will not work.");
        }
    }

    public boolean isAvailable() {
        return luckPerms != null;
    }

    public CompletableFuture<Void> preloadUsers(Collection<UUID> uuids) {
        if (!isAvailable()) return CompletableFuture.completedFuture(null);

        List<CompletableFuture<User>> futures = new ArrayList<>();
        for (UUID uuid : uuids) {
            if (luckPerms.getUserManager().getUser(uuid) == null) {
                futures.add(luckPerms.getUserManager().loadUser(uuid));
            }
        }
        return CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]));
    }

    public boolean isInAnyGroup(UUID uuid, List<String> groups) {
        if (!isAvailable()) return false;
        User user = luckPerms.getUserManager().getUser(uuid);
        if (user == null) return false;

        Collection<Group> inheritedGroups = user.getInheritedGroups(user.getQueryOptions());
        for (Group group : inheritedGroups) {
            if (groups.contains(group.getName())) return true;
        }
        return false;
    }

    public int getWeight(UUID uuid) {
        if (!isAvailable()) return 0;
        User user = luckPerms.getUserManager().getUser(uuid);
        if (user == null) return 0;

        return user.getNodes().stream()
                .filter(node -> node instanceof InheritanceNode)
                .map(node -> (InheritanceNode) node)
                .map(node -> luckPerms.getGroupManager().getGroup(node.getGroupName()))
                .filter(Objects::nonNull)
                .map(group -> group.getWeight().orElse(0))
                .max(Integer::compare)
                .orElse(0);
    }

    public CompletableFuture<Set<UUID>> getUuidsInGroups(List<String> groups) {
        if (!isAvailable()) return CompletableFuture.completedFuture(Collections.emptySet());

        List<CompletableFuture<Map<UUID, Collection<InheritanceNode>>>> futures = new ArrayList<>();
        for (String group : groups) {
            futures.add(luckPerms.getUserManager().searchAll(NodeMatcher.key(InheritanceNode.builder(group).build())));
        }

        return CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).thenApply(v -> {
            Set<UUID> uuids = new HashSet<>();
            for (CompletableFuture<Map<UUID, Collection<InheritanceNode>>> future : futures) {
                uuids.addAll(future.join().keySet());
            }
            return uuids;
        });
    }
}
