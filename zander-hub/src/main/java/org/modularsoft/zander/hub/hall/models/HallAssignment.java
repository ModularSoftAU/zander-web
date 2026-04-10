package org.modularsoft.zander.hub.hall.models;

import java.util.UUID;

public class HallAssignment {
    private String slotId;
    private UUID playerUuid;
    private String sectionId;
    private AssignmentType type;
    private long updatedAt;

    public enum AssignmentType {
        AUTO, MANUAL
    }

    public HallAssignment(String slotId, UUID playerUuid, String sectionId, AssignmentType type, long updatedAt) {
        this.slotId = slotId;
        this.playerUuid = playerUuid;
        this.sectionId = sectionId;
        this.type = type;
        this.updatedAt = updatedAt;
    }

    public String getSlotId() { return slotId; }
    public UUID getPlayerUuid() { return playerUuid; }
    public String getSectionId() { return sectionId; }
    public AssignmentType getType() { return type; }
    public long getUpdatedAt() { return updatedAt; }
}
