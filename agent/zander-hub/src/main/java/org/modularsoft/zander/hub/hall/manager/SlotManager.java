package org.modularsoft.zander.hub.hall.manager;

import org.modularsoft.zander.hub.hall.models.HallSlot;
import org.modularsoft.zander.hub.hall.persistence.HallPersistence;

import java.util.Map;

public class SlotManager {
    private final HallPersistence persistence;
    private Map<String, HallSlot> slots;

    public SlotManager(HallPersistence persistence) {
        this.persistence = persistence;
        this.slots = persistence.loadSlots();
    }

    public Map<String, HallSlot> getSlots() {
        return slots;
    }

    public void addSlot(HallSlot slot) {
        slots.put(slot.getId(), slot);
        persistence.saveSlots(slots);
    }

    public void removeSlot(String id) {
        slots.remove(id);
        persistence.saveSlots(slots);
    }

    public void save() {
        persistence.saveSlots(slots);
    }
}
