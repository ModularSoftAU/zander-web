package org.modularsoft.zander.velocity.model.session;

import com.google.gson.Gson;
import lombok.Builder;
import lombok.Getter;

import java.util.UUID;

@Builder
public class SessionVanish {

    @Getter UUID uuid;
    @Getter boolean hidden;

    @Override
    public String toString() {
        return new Gson().toJson(this);
    }

}
