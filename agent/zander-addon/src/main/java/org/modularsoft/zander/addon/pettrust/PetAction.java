package org.modularsoft.zander.addon.pettrust;

public enum PetAction {
    USE(TrustLevel.ACCESS),
    MOUNT(TrustLevel.ACCESS),
    INVENTORY(TrustLevel.MANAGE),
    LEASH(TrustLevel.MANAGE),
    UNLEASH(TrustLevel.MANAGE),
    DAMAGE(TrustLevel.MANAGE);

    private final TrustLevel requiredLevel;

    PetAction(TrustLevel requiredLevel) {
        this.requiredLevel = requiredLevel;
    }

    public TrustLevel getRequiredLevel() {
        return requiredLevel;
    }
}
