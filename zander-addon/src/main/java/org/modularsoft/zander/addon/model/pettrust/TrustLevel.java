package org.modularsoft.zander.addon.model.pettrust;

public enum TrustLevel {
    ACCESS,
    MANAGE;

    public boolean isAtLeast(TrustLevel other) {
        return this.ordinal() >= other.ordinal();
    }
}
