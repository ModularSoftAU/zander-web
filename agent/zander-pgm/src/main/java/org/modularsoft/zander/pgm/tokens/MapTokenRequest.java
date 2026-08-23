package org.modularsoft.zander.pgm.tokens;

import com.google.gson.annotations.SerializedName;

/** A pending Map Token request fetched from zander-web. */
public class MapTokenRequest {
    public String id;
    @SerializedName("player_uuid")
    public String uuid;
    public String username;
    @SerializedName("map_key")
    public String mapKey;
    @SerializedName("action_type")
    public String action; // NOMINATE, SET_NEXT, SPONSOR
    @SerializedName("token_cost")
    public int tokenCost;

    public boolean isSetNext() {
        return "SET_NEXT".equalsIgnoreCase(action);
    }

    public boolean isSponsor() {
        return "SPONSOR".equalsIgnoreCase(action);
    }
}
