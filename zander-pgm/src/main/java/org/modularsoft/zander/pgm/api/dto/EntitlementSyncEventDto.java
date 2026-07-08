package org.modularsoft.zander.pgm.api.dto;

import java.util.List;

public class EntitlementSyncEventDto extends BridgeEvent {
    public String uuid;
    public String username;
    public List<String> entitlements;

    public EntitlementSyncEventDto() {
        super("ENTITLEMENT_SYNC");
    }
}
