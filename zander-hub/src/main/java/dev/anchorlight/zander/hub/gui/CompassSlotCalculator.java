package dev.anchorlight.zander.hub.gui;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Assigns inventory slots to compass entries: explicit slots win, others are centred among what's left. */
public final class CompassSlotCalculator {
    public record SlotAssignment(String entryId, int slot) {
    }

    private CompassSlotCalculator() {
        throw new IllegalStateException("Utility class shouldn't be instantiated");
    }

    public static List<SlotAssignment> assign(List<String> entryIdsInOrder, Map<String, Integer> explicitSlots,
            int inventorySize) {
        Set<Integer> usedSlots = new LinkedHashSet<>();
        for (Map.Entry<String, Integer> entry : explicitSlots.entrySet()) {
            int slot = entry.getValue();
            if (slot < 0 || slot >= inventorySize) {
                throw new IllegalArgumentException("Slot " + slot + " for '" + entry.getKey()
                        + "' is outside the inventory (size " + inventorySize + ")");
            }
            if (!usedSlots.add(slot)) {
                throw new IllegalArgumentException("Duplicate slot " + slot + " requested by '" + entry.getKey() + "'");
            }
        }

        List<String> unassigned = new ArrayList<>();
        for (String id : entryIdsInOrder) {
            if (!explicitSlots.containsKey(id)) {
                unassigned.add(id);
            }
        }

        List<Integer> freeSlots = new ArrayList<>();
        for (int i = 0; i < inventorySize; i++) {
            if (!usedSlots.contains(i)) {
                freeSlots.add(i);
            }
        }
        int[] centredOffsets = computeEvenlySpacedSlots(unassigned.size(), freeSlots.size());

        List<SlotAssignment> result = new ArrayList<>();
        for (String id : entryIdsInOrder) {
            if (explicitSlots.containsKey(id)) {
                result.add(new SlotAssignment(id, explicitSlots.get(id)));
            }
        }
        for (int i = 0; i < unassigned.size(); i++) {
            result.add(new SlotAssignment(unassigned.get(i), freeSlots.get(centredOffsets[i])));
        }
        return result;
    }

    /// Distributes `count` icons across `rowSize` free slots, centred and evenly spaced.
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
}
