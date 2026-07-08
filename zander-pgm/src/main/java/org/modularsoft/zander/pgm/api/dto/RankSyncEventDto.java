package org.modularsoft.zander.pgm.api.dto;

import java.util.List;

public class RankSyncEventDto extends BridgeEvent {
    public String uuid;
    public String username;
    public String primaryGroup;
    public List<String> permissions;
    public Long expiresAt;

    public RankSyncEventDto() {
        super("RANK_SYNC");
    }
}
