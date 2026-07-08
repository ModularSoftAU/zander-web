package org.modularsoft.zander.pgm.entitlement;

/**
 * A generic, non-chat entitlement flag. Examples: cosmetic access, supporter
 * perks, map voting weight, reserved slot, profile badge (web only). Chat tags
 * and chat formatting are intentionally NOT modelled here.
 */
public class EntitlementDefinition {
    public String key;
    public String displayName;
    public boolean webOnly;

    public EntitlementDefinition() {
    }

    public EntitlementDefinition(String key, String displayName, boolean webOnly) {
        this.key = key;
        this.displayName = displayName;
        this.webOnly = webOnly;
    }
}
