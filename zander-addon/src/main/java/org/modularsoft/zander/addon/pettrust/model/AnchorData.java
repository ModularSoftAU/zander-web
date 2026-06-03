package org.modularsoft.zander.addon.pettrust.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class AnchorData {
    private boolean enabled;
    private String world;
    private double x, y, z;
    private float yaw, pitch;
    private double radius;
}
