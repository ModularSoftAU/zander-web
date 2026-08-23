package org.modularsoft.zander.addon.pettrust;

import org.jetbrains.annotations.Nullable;

public enum TrustLevel {
    ACCESS,
    MANAGE;

    public boolean isAtLeast(TrustLevel other) {
        return this.ordinal() >= other.ordinal();
    }

    public static @Nullable TrustLevel parse(String s) {
        if (s == null) return null;
        for (TrustLevel level : values()) {
            if (level.name().equalsIgnoreCase(s)) return level;
        }
        return null;
    }

    public static String validValues() {
        return "ACCESS, MANAGE";
    }
}
