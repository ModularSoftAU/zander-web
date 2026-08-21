package dev.anchorlight.zander.pgm.config;

import dev.dejvokep.boostedyaml.YamlDocument;
import dev.dejvokep.boostedyaml.settings.dumper.DumperSettings;
import dev.dejvokep.boostedyaml.settings.general.GeneralSettings;
import dev.dejvokep.boostedyaml.settings.loader.LoaderSettings;
import dev.dejvokep.boostedyaml.settings.updater.UpdaterSettings;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ConfigLoaderTest {

    private YamlDocument yamlFrom(String yaml) throws IOException {
        byte[] bytes = yaml.getBytes(StandardCharsets.UTF_8);
        return YamlDocument.create(new ByteArrayInputStream(bytes), new ByteArrayInputStream(bytes),
                GeneralSettings.DEFAULT, LoaderSettings.DEFAULT, DumperSettings.DEFAULT,
                UpdaterSettings.DEFAULT);
    }

    @Test
    void loadsApiToken() throws IOException {
        YamlDocument yaml = yamlFrom("api:\n  token: mixed-token\n");

        ZanderPGMConfig config = ConfigLoader.load(yaml);

        assertEquals("mixed-token", config.token);
    }
}
