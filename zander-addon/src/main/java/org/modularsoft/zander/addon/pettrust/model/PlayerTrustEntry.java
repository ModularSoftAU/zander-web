package org.modularsoft.zander.addon.pettrust.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.modularsoft.zander.addon.pettrust.TrustLevel;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PlayerTrustEntry {
    private UUID uuid;
    private String name;
    private TrustLevel level;
    private OffsetDateTime addedAt;
    private OffsetDateTime updatedAt;
}
