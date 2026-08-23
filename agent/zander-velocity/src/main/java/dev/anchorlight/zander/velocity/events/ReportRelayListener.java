package dev.anchorlight.zander.velocity.events;

import com.google.common.io.ByteArrayDataInput;
import com.google.common.io.ByteStreams;
import com.velocitypowered.api.event.Subscribe;
import com.velocitypowered.api.event.connection.PluginMessageEvent;
import com.velocitypowered.api.proxy.Player;
import com.velocitypowered.api.proxy.ProxyServer;
import com.velocitypowered.api.proxy.messages.MinecraftChannelIdentifier;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import dev.anchorlight.zander.velocity.ZanderVelocityMain;

/**
 * Receives report notifications relayed from a backend Paper server's {@code /report} dialog
 * (zander-addon's {@code ReportService}) and broadcasts them proxy-wide to every online player
 * with {@code zander.report.notify} - the same broadcast the old velocity-side {@code /report}
 * command used to do directly, now reused here since report *submission* moved to the addon
 * (the Paper Dialog API used for its UI only exists on the backend server, not the proxy).
 */
public class ReportRelayListener {

    public static final MinecraftChannelIdentifier CHANNEL = MinecraftChannelIdentifier.from("zander:report");

    private final ProxyServer proxy;

    public ReportRelayListener(ProxyServer proxy) {
        this.proxy = proxy;
    }

    @Subscribe
    public void onPluginMessage(PluginMessageEvent event) {
        if (!event.getIdentifier().equals(CHANNEL)) {
            return;
        }
        event.setResult(PluginMessageEvent.ForwardResult.handled());

        try {
            ByteArrayDataInput in = ByteStreams.newDataInput(event.getData());
            String reporter = in.readUTF();
            String reported = in.readUTF();
            String reason = in.readUTF();

            for (Player onlinePlayer : proxy.getAllPlayers()) {
                if (onlinePlayer.hasPermission("zander.report.notify")) {
                    onlinePlayer.sendMessage(Component.text(
                                    "Report submitted by " + reporter + " against " + reported + ": " + reason)
                            .color(NamedTextColor.YELLOW));
                }
            }
        } catch (Exception e) {
            ZanderVelocityMain.getLogger().error("Failed to relay report notification", e);
        }
    }
}
