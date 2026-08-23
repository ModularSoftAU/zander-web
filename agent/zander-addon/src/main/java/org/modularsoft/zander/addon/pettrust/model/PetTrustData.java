package org.modularsoft.zander.addon.pettrust.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.modularsoft.zander.addon.pettrust.TrustLevel;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Data
@NoArgsConstructor
public class PetTrustData {
    private UUID petUuid;
    private UUID ownerUuid;
    private String ownerName;
    private String petType;
    private String displayName;
    private String lastKnownWorld;
    private double lastKnownX, lastKnownY, lastKnownZ;
    private boolean publicEnabled = false;
    private TrustLevel publicLevel = TrustLevel.ACCESS;
    private Map<UUID, PlayerTrustEntry> trustedPlayers = new HashMap<>();
    private AnchorData anchor;

    public PetTrustData(UUID petUuid, UUID ownerUuid, String ownerName, String petType) {
        this.petUuid = petUuid;
        this.ownerUuid = ownerUuid;
        this.ownerName = ownerName;
        this.petType = petType;
    }
}
