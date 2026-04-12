package org.modularsoft.zander.addon.model.pettrust;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PlayerTrust {
    private UUID uuid;
    private String name;
    private TrustLevel level;
    private LocalDateTime addedAt;
}
