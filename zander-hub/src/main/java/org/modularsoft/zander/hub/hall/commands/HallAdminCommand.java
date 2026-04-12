package org.modularsoft.zander.hub.hall.commands;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.TextComponent;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.modularsoft.zander.hub.ZanderHubMain;
import org.modularsoft.zander.hub.hall.manager.HallManager;
import org.modularsoft.zander.hub.hall.models.HallAssignment;
import org.modularsoft.zander.hub.hall.models.HallSection;
import org.modularsoft.zander.hub.hall.models.HallSlot;
import org.jetbrains.annotations.NotNull;

import java.util.ArrayList;
import java.util.UUID;
import java.util.stream.Collectors;

public class HallAdminCommand implements CommandExecutor {
    private final ZanderHubMain plugin;
    private final HallManager hallManager;

    public HallAdminCommand(ZanderHubMain plugin) {
        this.plugin = plugin;
        this.hallManager = plugin.getHallManager();
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, @NotNull String[] args) {
        if (args.length == 0) {
            sendHelp(sender);
            return true;
        }

        switch (args[0].toLowerCase()) {
            case "reload":
                if (!sender.hasPermission("hall.admin")) return noPerm(sender);
                hallManager.getHallConfig().load();
                sender.sendMessage(Component.text("Hall config reloaded.", NamedTextColor.GREEN));
                break;
            case "refresh":
                if (!sender.hasPermission("hall.refresh")) return noPerm(sender);
                hallManager.forceRefresh();
                sender.sendMessage(Component.text("Hall refresh triggered.", NamedTextColor.GREEN));
                break;
            case "section":
                if (!sender.hasPermission("hall.section.manage")) return noPerm(sender);
                handleSection(sender, args);
                break;
            case "slot":
                if (!sender.hasPermission("hall.slot.manage")) return noPerm(sender);
                handleSlot(sender, args);
                break;
            case "assign":
                if (!sender.hasPermission("hall.assign.manage")) return noPerm(sender);
                handleAssign(sender, args);
                break;
            case "unassign":
                if (!sender.hasPermission("hall.assign.manage")) return noPerm(sender);
                handleUnassign(sender, args);
                break;
            case "lock":
                if (!sender.hasPermission("hall.slot.manage")) return noPerm(sender);
                handleLock(sender, args, true);
                break;
            case "unlock":
                if (!sender.hasPermission("hall.slot.manage")) return noPerm(sender);
                handleLock(sender, args, false);
                break;
            case "preview":
                if (!sender.hasPermission("hall.preview")) return noPerm(sender);
                handlePreview(sender, args);
                break;
            default:
                sendHelp(sender);
                break;
        }

        return true;
    }

    private boolean noPerm(CommandSender sender) {
        sender.sendMessage(Component.text("No permission.", NamedTextColor.RED));
        return true;
    }

    private void handleSection(CommandSender sender, String[] args) {
        if (args.length < 2) {
            sender.sendMessage(Component.text("Usage: /hall section <list|create|setlabel|setpriority|addgroup> [id]", NamedTextColor.RED));
            return;
        }

        String sub = args[1].toLowerCase();

        if (sub.equals("list")) {
            sender.sendMessage(Component.text("Sections:", NamedTextColor.GOLD));
            for (HallSection sec : hallManager.getSectionManager().getSections().values()) {
                sender.sendMessage(Component.text("- " + sec.getId() + " (" + sec.getDisplayName() + ") P:" + sec.getPriority(), NamedTextColor.YELLOW));
            }
            return;
        }

        if (args.length < 3) {
            sender.sendMessage(Component.text("Provide section id.", NamedTextColor.RED));
            return;
        }

        String id = args[2];
        HallSection sec = hallManager.getSectionManager().getSections().get(id);

        if (sub.equals("create")) {
            if (sec != null) {
                sender.sendMessage(Component.text("Section already exists.", NamedTextColor.RED));
                return;
            }
            sec = new HallSection(id, id, id, new ArrayList<>(), 0, "weight_desc", true, true);
            hallManager.getSectionManager().addSection(sec);
            sender.sendMessage(Component.text("Section created: " + id, NamedTextColor.GREEN));
            return;
        }

        if (sec == null) {
            sender.sendMessage(Component.text("Section not found: " + id, NamedTextColor.RED));
            return;
        }

        switch (sub) {
            case "setlabel":
                if (args.length < 4) { sender.sendMessage("Provide label."); return; }
                StringBuilder labelBuilder = new StringBuilder();
                for (int i = 3; i < args.length; i++) {
                    labelBuilder.append(args[i]).append(i == args.length - 1 ? "" : " ");
                }
                sec.setSignLabel(labelBuilder.toString());
                hallManager.getSectionManager().save();
                sender.sendMessage(Component.text("Label set for " + id + " to: " + sec.getSignLabel(), NamedTextColor.GREEN));
                break;
            case "setpriority":
                if (args.length < 4) { sender.sendMessage("Provide priority."); return; }
                sec.setPriority(Integer.parseInt(args[3]));
                hallManager.getSectionManager().save();
                sender.sendMessage(Component.text("Priority set for " + id, NamedTextColor.GREEN));
                break;
            case "addgroup":
                if (args.length < 4) { sender.sendMessage("Provide group."); return; }
                sec.getGroups().add(args[3]);
                hallManager.getSectionManager().save();
                sender.sendMessage(Component.text("Group added to " + id, NamedTextColor.GREEN));
                break;
            case "info":
                sender.sendMessage(Component.text("Section Info: " + id, NamedTextColor.GOLD));
                sender.sendMessage(Component.text("Label: " + sec.getSignLabel(), NamedTextColor.YELLOW));
                sender.sendMessage(Component.text("Priority: " + sec.getPriority(), NamedTextColor.YELLOW));
                sender.sendMessage(Component.text("Groups: " + String.join(", ", sec.getGroups()), NamedTextColor.YELLOW));
                sender.sendMessage(Component.text("Mode: " + sec.getSortMode(), NamedTextColor.YELLOW));
                break;
        }
    }

    private void handleSlot(CommandSender sender, String[] args) {
        if (args.length < 2) {
            sender.sendMessage(Component.text("Usage: /hall slot <list|create|remove|info> [args]", NamedTextColor.RED));
            return;
        }

        String sub = args[1].toLowerCase();

        if (sub.equals("list")) {
            sender.sendMessage(Component.text("Slots:", NamedTextColor.GOLD));
            for (HallSlot slot : hallManager.getSlotManager().getSlots().values()) {
                HallAssignment a = hallManager.getAssignmentForSlot(slot.getId());
                String pName = "Empty";
                if (a != null) {
                    OfflinePlayer op = Bukkit.getOfflinePlayer(a.getPlayerUuid());
                    pName = op.getName() != null ? op.getName() : "Unknown";
                }
                sender.sendMessage(Component.text("- " + slot.getId() + " [" + slot.getSectionId() + "] -> " + pName + (slot.isLocked() ? " (LOCKED)" : ""), NamedTextColor.YELLOW));
            }
            return;
        }

        if (sub.equals("create")) {
            if (!(sender instanceof Player player)) { sender.sendMessage("Players only."); return; }
            if (args.length < 3) { sender.sendMessage("Provide section id."); return; }
            String sectionId = args[2];
            String id = (args.length > 3) ? args[3] : UUID.randomUUID().toString().substring(0, 8);

            if (hallManager.getSlotManager().getSlots().containsKey(id)) {
                sender.sendMessage(Component.text("Slot ID already exists.", NamedTextColor.RED));
                return;
            }

            Location loc = player.getLocation();
            Location signLoc = loc.clone().add(0, -1, 0);
            HallSlot slot = new HallSlot(id, sectionId, loc, signLoc, false, 0);
            hallManager.getSlotManager().addSlot(slot);
            sender.sendMessage(Component.text("Slot created: " + id + " for section " + sectionId, NamedTextColor.GREEN));
        } else if (sub.equals("remove")) {
            if (args.length < 3) { sender.sendMessage("Provide slot id."); return; }
            hallManager.getSlotManager().removeSlot(args[2]);
            sender.sendMessage(Component.text("Slot removed: " + args[2], NamedTextColor.GREEN));
        } else if (sub.equals("info")) {
            if (args.length < 3) { sender.sendMessage("Provide slot id."); return; }
            HallSlot slot = hallManager.getSlotManager().getSlots().get(args[2]);
            if (slot == null) { sender.sendMessage("Slot not found."); return; }
            sender.sendMessage(Component.text("Slot Info: " + slot.getId(), NamedTextColor.GOLD));
            sender.sendMessage(Component.text("Section: " + slot.getSectionId(), NamedTextColor.YELLOW));
            sender.sendMessage(Component.text("Location: " + slot.getLocation().getWorld().getName() + " " + slot.getLocation().getBlockX() + "," + slot.getLocation().getBlockY() + "," + slot.getLocation().getBlockZ(), NamedTextColor.YELLOW));
            sender.sendMessage(Component.text("Locked: " + slot.isLocked(), NamedTextColor.YELLOW));
            HallAssignment a = hallManager.getAssignmentForSlot(slot.getId());
            if (a != null) {
                OfflinePlayer op = Bukkit.getOfflinePlayer(a.getPlayerUuid());
                sender.sendMessage(Component.text("Assigned: " + (op.getName() != null ? op.getName() : "Unknown") + " (" + a.getType() + ")", NamedTextColor.YELLOW));
            }
        }
    }

    private void handleAssign(CommandSender sender, String[] args) {
        if (args.length < 3) {
            sender.sendMessage(Component.text("Usage: /hall assign <player> <slotId>", NamedTextColor.RED));
            return;
        }

        String playerName = args[1];
        String slotId = args[2];
        OfflinePlayer op = Bukkit.getOfflinePlayer(playerName);

        HallSlot slot = hallManager.getSlotManager().getSlots().get(slotId);
        if (slot == null) {
            sender.sendMessage(Component.text("Slot not found.", NamedTextColor.RED));
            return;
        }

        HallAssignment assignment = new HallAssignment(slotId, op.getUniqueId(), slot.getSectionId(), HallAssignment.AssignmentType.MANUAL, System.currentTimeMillis());
        hallManager.getAssignments().removeIf(a -> a.getSlotId().equals(slotId));
        hallManager.getAssignments().add(assignment);
        hallManager.saveAssignments();
        hallManager.getRenderService().renderSlot(slot);
        sender.sendMessage(Component.text("Assigned " + playerName + " to slot " + slotId, NamedTextColor.GREEN));
    }

    private void handleUnassign(CommandSender sender, String[] args) {
        if (args.length < 2) {
            sender.sendMessage(Component.text("Usage: /hall unassign <slotId>", NamedTextColor.RED));
            return;
        }
        String slotId = args[1];
        hallManager.getAssignments().removeIf(a -> a.getSlotId().equals(slotId));
        hallManager.saveAssignments();

        HallSlot slot = hallManager.getSlotManager().getSlots().get(slotId);
        if (slot != null) hallManager.getRenderService().renderSlot(slot);
        sender.sendMessage(Component.text("Unassigned slot " + slotId, NamedTextColor.GREEN));
    }

    private void handleLock(CommandSender sender, String[] args, boolean lock) {
        if (args.length < 2) {
            sender.sendMessage(Component.text("Usage: /hall " + (lock ? "lock" : "unlock") + " <slotId>", NamedTextColor.RED));
            return;
        }
        String slotId = args[1];
        HallSlot slot = hallManager.getSlotManager().getSlots().get(slotId);
        if (slot == null) {
            sender.sendMessage(Component.text("Slot not found.", NamedTextColor.RED));
            return;
        }
        slot.setLocked(lock);
        hallManager.getSlotManager().save();
        sender.sendMessage(Component.text("Slot " + slotId + (lock ? " locked." : " unlocked."), NamedTextColor.GREEN));
    }

    private void handlePreview(CommandSender sender, String[] args) {
        if (!(sender instanceof Player player)) return;
        if (args.length < 2) { sender.sendMessage("Provide player."); return; }
        OfflinePlayer op = Bukkit.getOfflinePlayer(args[1]);

        sender.sendMessage(Component.text("Previewing " + op.getName() + " (not fully implemented, re-render triggered for their slots)", NamedTextColor.YELLOW));
        HallAssignment assignment = hallManager.getAssignmentForPlayer(op.getUniqueId());
        if (assignment != null) {
            HallSlot slot = hallManager.getSlotManager().getSlots().get(assignment.getSlotId());
            if (slot != null) hallManager.getRenderService().renderSlot(slot);
        }
    }

    private void sendHelp(CommandSender sender) {
        sender.sendMessage(Component.text("Hall Admin Commands:", NamedTextColor.GOLD));
        sender.sendMessage(Component.text("/hall reload", NamedTextColor.YELLOW));
        sender.sendMessage(Component.text("/hall refresh", NamedTextColor.YELLOW));
        sender.sendMessage(Component.text("/hall section <list|info|create|setlabel|setpriority|addgroup> <args>", NamedTextColor.YELLOW));
        sender.sendMessage(Component.text("/hall slot <list|info|create|remove> <args>", NamedTextColor.YELLOW));
        sender.sendMessage(Component.text("/hall assign <player> <slotId>", NamedTextColor.YELLOW));
        sender.sendMessage(Component.text("/hall unassign <slotId>", NamedTextColor.YELLOW));
        sender.sendMessage(Component.text("/hall lock|unlock <slotId>", NamedTextColor.YELLOW));
        sender.sendMessage(Component.text("/hall preview <player>", NamedTextColor.YELLOW));
    }
}
