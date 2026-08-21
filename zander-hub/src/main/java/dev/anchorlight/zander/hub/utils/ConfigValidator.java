package dev.anchorlight.zander.hub.utils;

import java.util.function.Consumer;
import net.kyori.adventure.text.TextComponent;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;
import dev.dejvokep.boostedyaml.YamlDocument;
import dev.dejvokep.boostedyaml.route.Route;
import dev.anchorlight.zander.hub.ZanderHubMain;

/**
 * Utility class providing validators for YAML fields in BoostedYAML config objects.
 */
public final class ConfigValidator {
    private static final JavaPlugin plugin = ZanderHubMain.plugin;

    private ConfigValidator() {
        throw new IllegalStateException("Utility class shouldn't be instantiated");
    }

    public static class ValidationResult {
        private final boolean valid;
        private final String logMsg;

        private ValidationResult(boolean valid, String logMsg) {
            this.valid = valid;
            this.logMsg = logMsg;
        }

        public static ValidationResult success() {
            return new ValidationResult(true, "");
        }

        public static ValidationResult failure(String logMsg) {
            return new ValidationResult(false, logMsg);
        }

        public boolean isValid() {
            return valid;
        }

        public String getLog() {
            return logMsg;
        }
    }

    @FunctionalInterface
    public static interface Validator {
        ValidationResult validate(YamlDocument config, Route field);
    }

    @FunctionalInterface
    public static interface ValidatorWithSetter<T> {
        ValidationResult validate(YamlDocument config, Route field, Consumer<T> setter);
    }

    /// Validate `field` in `config` with custom `validator` function.
    /// When validator fails, `fallback` is used and instated in `config`
    public static ValidationResult validateConfig(YamlDocument config, Route field,
            Validator validator, Object fallback) {
        ValidationResult result = validator.validate(config, field);
        if (!result.isValid()) {
            config.set(field, fallback);
            plugin.getLogger().warning(
                    String.format("Invalid '%s' in config.yml, replaced by fallback '%s'", field, fallback));
            plugin.getLogger().warning(result.getLog());
        }
        return result;
    }

    /// Overload for `validator` that want integration with setting values.
    public static <T> ValidationResult validateConfig(YamlDocument config, Route field,
            ValidatorWithSetter<T> validator, Object fallback, Consumer<T> setter) {
        ValidationResult result = validator.validate(config, field, setter);
        if (!result.isValid()) {
            config.set(field, fallback);
            plugin.getLogger().warning(
                    String.format("Invalid '%s' in config.yml, replaced by fallback '%s'", field, fallback));
            plugin.getLogger().warning(result.getLog());
        }
        return result;
    }

    /// Validate `field` value is a boolean.
    /// Yaml true: [y, Y, yes, Yes, YES, true, True, TRUE, on, On, ON]
    /// Yaml fale: [n, N, no, No, NO, false, False, FALSE, off, Off, OFF]
    public static final Validator isValidBoolean = (config, field) -> {
        if (!config.isBoolean(field))
            return ValidationResult.failure(String.format("Reason '%s' wasn't a boolean value", field));
        return ValidationResult.success();
    };

    /// Validate `field` value is a double decimal.
    public static final Validator isValidDouble = (config, field) -> {
        if (!config.isDouble(field))
            return ValidationResult.failure(String.format("Reason '%s' wasn't a decimal number", field));
        return ValidationResult.success();
    };

    /// Validate `field` value is an integer decimal.
    public static final Validator isValidInt = (config, field) -> {
        if (!config.isInt(field))
            return ValidationResult.failure(String.format("Reason '%s' wasn't an integer number", field));
        return ValidationResult.success();
    };

    /// Validate `field` value is proper pitch rotation.
    public static final Validator isValidPitch = (config, field) -> {
        if (!config.isDouble(field))
            return ValidationResult.failure(String.format("Reason '%s' wasn't a decimal number", field));
        double value = config.getDouble(field);
        if (value < -90.0 || value > 90.0) {
            return ValidationResult
                    .failure(String.format("Reason '%s' wasn't between -90.0 and 90.0", field));
        }
        return ValidationResult.success();
    };

    /// Validate `field` value is proper yaw rotation.
    public static final Validator isValidYaw = (config, field) -> {
        if (!config.isDouble(field))
            return ValidationResult.failure(String.format("Reason '%s' wasn't a decimal number", field));
        double value = config.getDouble(field);
        if (value < -180.0 || value > 180.0)
            return ValidationResult.failure(String.format("Reason '%s' wasn't between -180.0 and 180.0", field));
        return ValidationResult.success();
    };

    /// Validate `field` value is proper hotbar index.
    public static final Validator isValidHotbarSlot = (config, field) -> {
        if (!config.isInt(field))
            return ValidationResult.failure(String.format("Reason '%s' wasn't an integer number", field));
        int value = config.getInt(field);
        if (value < 0 || value > 8)
            return ValidationResult.failure(String.format("Reason '%s' wasn't between 0 and 8", field));
        return ValidationResult.success();
    };

    /// Validate `field` value is the name of a valid world.
    public static final Validator isValidWorld = (config, field) -> {
        if (!config.isString(field))
            return ValidationResult.failure(String.format("Reason '%s' wasn't a text string", field));
        String worldName = config.getString(field);
        if (Bukkit.getWorld(worldName) == null) {
            return ValidationResult
                    .failure(String.format("Reason '%s' refers to non-existent world '%s'", field, worldName));
        }
        return ValidationResult.success();
    };

    /// Validate `field` value is legacy string properly formatted with single %p%
    public static final ValidatorWithSetter<TextComponent> isValidJoinLeave = (config, field, setter) -> {
        // 1. verify field value value is string
        // 2. verify field value has single %p% placeholder
        // 3. verify field value can be converted to adventure text component
        // 4. use setter on parsed value (efficient no parse again in parent)
        if (!config.isString(field))
            return ValidationResult.failure(String.format("Reason '%s' wasn't a text string", field));

        String textLegacy = config.getString(field);
        try {
            int placeholderIndex = textLegacy.indexOf("%p%");
            if (placeholderIndex == -1 || placeholderIndex != textLegacy.lastIndexOf("%p%")) {
                return ValidationResult
                        .failure(String.format("Reason '%s' must contain exactly one '%p%' placeholder", field));
            }
            LegacyComponentSerializer serializer = LegacyComponentSerializer.legacyAmpersand();
            TextComponent template = serializer.deserialize(textLegacy);
            setter.accept(template);
            return ValidationResult.success();

        } catch (Exception e) {
            return ValidationResult
                    .failure(String.format("Reason '%s' has invalid format; %s", field, e.getMessage()));
        }
    };
}
