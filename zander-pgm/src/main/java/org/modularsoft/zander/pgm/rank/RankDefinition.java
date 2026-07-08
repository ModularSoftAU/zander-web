package org.modularsoft.zander.pgm.rank;

import java.util.ArrayList;
import java.util.List;

/** Rank/permission data for a player as returned by zander-web. */
public class RankDefinition {
    public String uuid;
    public String primaryGroup;
    public List<String> permissions = new ArrayList<>();
    public Long expiresAt;
}
