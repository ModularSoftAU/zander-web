package org.modularsoft.zander.hub.hall.models;

import org.bukkit.Location;

public class HallSlot {
    private String id;
    private String sectionId;
    private Location location;
    private Location signLocation;
    private boolean locked;
    private int displayOrder;

    public HallSlot(String id, String sectionId, Location location, Location signLocation, boolean locked, int displayOrder) {
        this.id = id;
        this.sectionId = sectionId;
        this.location = location;
        this.signLocation = signLocation;
        this.locked = locked;
        this.displayOrder = displayOrder;
    }

    public String getId() { return id; }
    public String getSectionId() { return sectionId; }
    public void setSectionId(String sectionId) { this.sectionId = sectionId; }
    public Location getLocation() { return location; }
    public void setLocation(Location location) { this.location = location; }
    public Location getSignLocation() { return signLocation; }
    public void setSignLocation(Location signLocation) { this.signLocation = signLocation; }
    public boolean isLocked() { return locked; }
    public void setLocked(boolean locked) { this.locked = locked; }
    public int getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(int displayOrder) { this.displayOrder = displayOrder; }
}
