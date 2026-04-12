package org.modularsoft.zander.addon.model.pettrust;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PetTrust {
    private UUID petUuid;
    private UUID ownerUuid;
    private String ownerName;
    private String petType;
    private boolean publicEnabled;
    private TrustLevel publicLevel;
    private Map<UUID, PlayerTrust> trustedPlayers = new HashMap<>();

    public PetTrust(UUID petUuid, UUID ownerUuid, String ownerName, String petType) {
        this.petUuid = petUuid;
        this.ownerUuid = ownerUuid;
        this.ownerName = ownerName;
        this.petType = petType;
        this.publicEnabled = false;
        this.publicLevel = TrustLevel.ACCESS;
    }
}
