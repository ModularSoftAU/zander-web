package dev.anchorlight.zander.pgm.config;

import dev.dejvokep.boostedyaml.YamlDocument;
import dev.dejvokep.boostedyaml.block.implementation.Section;
import dev.dejvokep.boostedyaml.route.Route;

/** Reads a {@link YamlDocument} into a {@link ZanderPGMConfig}. */
public final class ConfigLoader {

    private ConfigLoader() {
    }

    public static ZanderPGMConfig load(YamlDocument c) {
        ZanderPGMConfig cfg = new ZanderPGMConfig();

        cfg.serverId = c.getString(Route.from("server", "id"), cfg.serverId);
        cfg.serverDisplayName = c.getString(Route.from("server", "displayName"), cfg.serverDisplayName);
        cfg.environment = c.getString(Route.from("server", "environment"), cfg.environment);

        cfg.baseUrl = c.getString(Route.from("api", "baseUrl"), cfg.baseUrl);
        cfg.websocketUrl = c.getString(Route.from("api", "websocketUrl"), cfg.websocketUrl);
        cfg.token = c.getString(Route.from("api", "token"), cfg.token);
        cfg.connectTimeoutSeconds = c.getInt(Route.from("api", "connectTimeoutSeconds"), cfg.connectTimeoutSeconds);
        cfg.requestTimeoutSeconds = c.getInt(Route.from("api", "requestTimeoutSeconds"), cfg.requestTimeoutSeconds);

        cfg.debugLogging = c.getBoolean(Route.from("logging", "debug"), cfg.debugLogging);

        cfg.heartbeatSeconds = c.getInt(Route.from("sync", "heartbeatSeconds"), cfg.heartbeatSeconds);
        cfg.retryFailedEvents = c.getBoolean(Route.from("sync", "retryFailedEvents"), cfg.retryFailedEvents);
        cfg.retrySeconds = c.getInt(Route.from("sync", "retrySeconds"), cfg.retrySeconds);
        cfg.maxQueueSize = c.getInt(Route.from("sync", "maxQueueSize"), cfg.maxQueueSize);
        cfg.batchEvents = c.getBoolean(Route.from("sync", "batchEvents"), cfg.batchEvents);
        cfg.maxBatchSize = c.getInt(Route.from("sync", "maxBatchSize"), cfg.maxBatchSize);

        Section features = c.getSection(Route.from("features"));
        if (features != null) {
            for (String key : features.getRoutesAsStrings(false)) {
                cfg.features.put(key, features.getBoolean(Route.from(key), false));
            }
        }

        cfg.saveIntervalSeconds = c.getInt(Route.from("stats", "saveIntervalSeconds"), cfg.saveIntervalSeconds);
        cfg.includeDamageStats = c.getBoolean(Route.from("stats", "includeDamageStats"), cfg.includeDamageStats);
        cfg.includeBlockStats = c.getBoolean(Route.from("stats", "includeBlockStats"), cfg.includeBlockStats);
        cfg.includeBowStats = c.getBoolean(Route.from("stats", "includeBowStats"), cfg.includeBowStats);
        cfg.includeObjectiveStats = c.getBoolean(Route.from("stats", "includeObjectiveStats"), cfg.includeObjectiveStats);
        cfg.includeSessionStats = c.getBoolean(Route.from("stats", "includeSessionStats"), cfg.includeSessionStats);

        cfg.xpWin = c.getInt(Route.from("xp", "win"), cfg.xpWin);
        cfg.xpLoss = c.getInt(Route.from("xp", "loss"), cfg.xpLoss);
        cfg.xpKill = c.getInt(Route.from("xp", "kill"), cfg.xpKill);
        cfg.xpAssist = c.getInt(Route.from("xp", "assist"), cfg.xpAssist);
        cfg.xpObjectiveCapture = c.getInt(Route.from("xp", "objectiveCapture"), cfg.xpObjectiveCapture);
        cfg.xpObjectiveDefend = c.getInt(Route.from("xp", "objectiveDefend"), cfg.xpObjectiveDefend);
        cfg.xpFirstBlood = c.getInt(Route.from("xp", "firstBlood"), cfg.xpFirstBlood);
        cfg.xpKillstreakBonus = c.getInt(Route.from("xp", "killstreakBonus"), cfg.xpKillstreakBonus);

        cfg.mapTokensEnabled = c.getBoolean(Route.from("mapTokens", "enabled"), cfg.mapTokensEnabled);
        cfg.mapTokenApplyMode = c.getString(Route.from("mapTokens", "applyMode"), cfg.mapTokenApplyMode);
        cfg.mapTokenAllowMidMatchChange = c.getBoolean(Route.from("mapTokens", "allowMidMatchChange"), cfg.mapTokenAllowMidMatchChange);
        cfg.mapTokenPlayerCooldownMinutes = c.getInt(Route.from("mapTokens", "playerCooldownMinutes"), cfg.mapTokenPlayerCooldownMinutes);
        cfg.mapTokenMapCooldownMatches = c.getInt(Route.from("mapTokens", "mapCooldownMatches"), cfg.mapTokenMapCooldownMatches);
        cfg.mapTokenMinimumPlayersOnline = c.getInt(Route.from("mapTokens", "minimumPlayersOnline"), cfg.mapTokenMinimumPlayersOnline);
        cfg.mapTokenRefundIfFailed = c.getBoolean(Route.from("mapTokens", "refundIfFailed"), cfg.mapTokenRefundIfFailed);
        cfg.mapTokenRequireMapEnabled = c.getBoolean(Route.from("mapTokens", "requireMapEnabled"), cfg.mapTokenRequireMapEnabled);

        cfg.mapVotingEnabled = c.getBoolean(Route.from("mapVoting", "enabled"), cfg.mapVotingEnabled);
        cfg.voteDurationSeconds = c.getInt(Route.from("mapVoting", "voteDurationSeconds"), cfg.voteDurationSeconds);
        cfg.optionsPerVote = c.getInt(Route.from("mapVoting", "optionsPerVote"), cfg.optionsPerVote);
        cfg.allowTokenNominations = c.getBoolean(Route.from("mapVoting", "allowTokenNominations"), cfg.allowTokenNominations);
        cfg.allowTokenBoosts = c.getBoolean(Route.from("mapVoting", "allowTokenBoosts"), cfg.allowTokenBoosts);
        cfg.tokenBoostWeight = c.getInt(Route.from("mapVoting", "tokenBoostWeight"), cfg.tokenBoostWeight);
        cfg.mapVoteCooldownMatches = c.getInt(Route.from("mapVoting", "mapCooldownMatches"), cfg.mapVoteCooldownMatches);
        cfg.showLiveResults = c.getBoolean(Route.from("mapVoting", "showLiveResults"), cfg.showLiveResults);
        cfg.applyWinnerToNextMatch = c.getBoolean(Route.from("mapVoting", "applyWinnerToNextMatch"), cfg.applyWinnerToNextMatch);

        cfg.mapRatingsEnabled = c.getBoolean(Route.from("mapRatings", "enabled"), cfg.mapRatingsEnabled);
        cfg.promptAfterMatch = c.getBoolean(Route.from("mapRatings", "promptAfterMatch"), cfg.promptAfterMatch);
        cfg.ratingWindowSeconds = c.getInt(Route.from("mapRatings", "ratingWindowSeconds"), cfg.ratingWindowSeconds);
        cfg.requirePlayedMatch = c.getBoolean(Route.from("mapRatings", "requirePlayedMatch"), cfg.requirePlayedMatch);
        cfg.allowFeedback = c.getBoolean(Route.from("mapRatings", "allowFeedback"), cfg.allowFeedback);
        cfg.feedbackMaxLength = c.getInt(Route.from("mapRatings", "feedbackMaxLength"), cfg.feedbackMaxLength);
        cfg.allowRatingUpdatesDuringWindow = c.getBoolean(Route.from("mapRatings", "allowRatingUpdatesDuringWindow"), cfg.allowRatingUpdatesDuringWindow);

        return cfg;
    }
}
