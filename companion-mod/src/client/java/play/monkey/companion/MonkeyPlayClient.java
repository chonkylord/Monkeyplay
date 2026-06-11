/*
 * MonkeyPlay Companion boundaries:
 * - Hitboxes must only use Minecraft's own EntityRenderDispatcher#setRenderHitboxes flag.
 * - Hitboxes remain depth-tested and terrain-occluded exactly like vanilla F3+B.
 * - HUD widgets may display only local, vanilla-visible client state.
 * - No aim assist, triggerbot, auto-clicker, kill aura, reach changes, X-ray, ESP,
 *   velocity changes, packet manipulation, or anticheat evasion may be added here.
 */
package play.monkey.companion;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.fabricmc.fabric.api.event.player.AttackEntityCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import org.lwjgl.glfw.GLFW;

import java.util.ArrayDeque;
import java.util.Deque;

public final class MonkeyPlayClient implements ClientModInitializer {
    private static final int WHITE = 0xFFFFFFFF;
    private static final int ACCENT = 0xFF65A894;
    private final Deque<Long> leftClicks = new ArrayDeque<>();
    private final Deque<Long> rightClicks = new ArrayDeque<>();
    private KeyBinding hitboxToggle;
    private KeyBinding hudToggle;
    private KeyBinding toggleSprint;
    private KeyBinding toggleSneak;
    private boolean hitboxesEnabled;
    private boolean hudEnabled = true;
    private boolean sprintHeld;
    private boolean sneakHeld;
    private int successfulHits;
    private boolean wasLeftDown;
    private boolean wasRightDown;

    @Override
    public void onInitializeClient() {
        hitboxToggle = KeyBindingHelper.registerKeyBinding(new KeyBinding(
            "key.monkeyplay.hitboxes",
            InputUtil.Type.KEYSYM,
            GLFW.GLFW_KEY_UNKNOWN,
            "category.monkeyplay"
        ));
        hudToggle = KeyBindingHelper.registerKeyBinding(new KeyBinding(
            "key.monkeyplay.hud",
            InputUtil.Type.KEYSYM,
            GLFW.GLFW_KEY_UNKNOWN,
            "category.monkeyplay"
        ));
        toggleSprint = KeyBindingHelper.registerKeyBinding(new KeyBinding(
            "key.monkeyplay.toggle_sprint",
            InputUtil.Type.KEYSYM,
            GLFW.GLFW_KEY_UNKNOWN,
            "category.monkeyplay"
        ));
        toggleSneak = KeyBindingHelper.registerKeyBinding(new KeyBinding(
            "key.monkeyplay.toggle_sneak",
            InputUtil.Type.KEYSYM,
            GLFW.GLFW_KEY_UNKNOWN,
            "category.monkeyplay"
        ));

        ClientTickEvents.END_CLIENT_TICK.register(this::onClientTick);
        HudRenderCallback.EVENT.register((drawContext, tickCounter) -> renderHud(drawContext));
        AttackEntityCallback.EVENT.register((player, world, hand, entity, hitResult) -> {
            if (world.isClient()) {
                successfulHits++;
            }
            return ActionResult.PASS;
        });
    }

    private void onClientTick(MinecraftClient client) {
        while (hitboxToggle.wasPressed()) {
            hitboxesEnabled = !hitboxesEnabled;
            client.getEntityRenderDispatcher().setRenderHitboxes(hitboxesEnabled);
            if (client.player != null) {
                client.player.sendMessage(Text.literal("MonkeyPlay hitboxes " + (hitboxesEnabled ? "on" : "off")), true);
            }
        }
        while (hudToggle.wasPressed()) {
            hudEnabled = !hudEnabled;
        }
        while (toggleSprint.wasPressed()) {
            sprintHeld = !sprintHeld;
        }
        while (toggleSneak.wasPressed()) {
            sneakHeld = !sneakHeld;
        }

        if (client.player != null) {
            client.options.sprintKey.setPressed(sprintHeld || client.options.sprintKey.isPressed());
            client.options.sneakKey.setPressed(sneakHeld || client.options.sneakKey.isPressed());
        }

        sampleMouseClicks(client);
    }

    private void sampleMouseClicks(MinecraftClient client) {
        if (client.getWindow() == null) {
            return;
        }
        long handle = client.getWindow().getHandle();
        boolean leftDown = GLFW.glfwGetMouseButton(handle, GLFW.GLFW_MOUSE_BUTTON_LEFT) == GLFW.GLFW_PRESS;
        boolean rightDown = GLFW.glfwGetMouseButton(handle, GLFW.GLFW_MOUSE_BUTTON_RIGHT) == GLFW.GLFW_PRESS;
        long now = System.currentTimeMillis();
        if (leftDown && !wasLeftDown) {
            leftClicks.addLast(now);
        }
        if (rightDown && !wasRightDown) {
            rightClicks.addLast(now);
        }
        wasLeftDown = leftDown;
        wasRightDown = rightDown;
        trimClicks(leftClicks, now);
        trimClicks(rightClicks, now);
    }

    private void trimClicks(Deque<Long> clicks, long now) {
        while (!clicks.isEmpty() && now - clicks.peekFirst() > 1000L) {
            clicks.removeFirst();
        }
    }

    private void renderHud(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (!hudEnabled || client.player == null || client.textRenderer == null) {
            return;
        }
        int x = 8;
        int y = 8;
        draw(context, client, "FPS " + client.getCurrentFps(), x, y, ACCENT);
        draw(context, client, "CPS " + leftClicks.size() + " | " + rightClicks.size(), x, y + 12, WHITE);
        draw(context, client, "Ping " + latency(client) + " ms", x, y + 24, WHITE);
        draw(context, client, "XYZ " + format(client.player.getX()) + " " + format(client.player.getY()) + " " + format(client.player.getZ()), x, y + 36, WHITE);
        draw(context, client, "Facing " + client.player.getHorizontalFacing().asString(), x, y + 48, WHITE);
        draw(context, client, "Hits " + successfulHits, x, y + 60, WHITE);
        draw(context, client, keystrokes(client), x, y + 72, WHITE);
    }

    private void draw(DrawContext context, MinecraftClient client, String text, int x, int y, int color) {
        context.drawText(client.textRenderer, text, x, y, color, true);
    }

    private int latency(MinecraftClient client) {
        if (client.getNetworkHandler() == null || client.player == null) {
            return 0;
        }
        var entry = client.getNetworkHandler().getPlayerListEntry(client.player.getUuid());
        return entry == null ? 0 : entry.getLatency();
    }

    private String format(double value) {
        return String.format("%.1f", value);
    }

    private String keystrokes(MinecraftClient client) {
        return (client.options.forwardKey.isPressed() ? "W" : "-")
            + (client.options.leftKey.isPressed() ? " A" : " -")
            + (client.options.backKey.isPressed() ? " S" : " -")
            + (client.options.rightKey.isPressed() ? " D" : " -")
            + (client.options.jumpKey.isPressed() ? " SPACE" : "");
    }
}
