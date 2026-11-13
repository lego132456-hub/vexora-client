package pl.vexora.client;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

public class VexoraClient implements ClientModInitializer {
    public static KeyBinding menuKey;

    @Override
    public void onInitializeClient() {
        Config.load();
        menuKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
            "key.vexora.menu", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_RIGHT_SHIFT, "category.vexora"));
        ClientTickEvents.END_CLIENT_TICK.register(c -> {
            Cps.tick(c);
            while (menuKey.wasPressed()) {
                if (c.currentScreen == null) c.setScreen(new VexoraScreen());
            }
            if (Config.on("sprint") && c.player != null && c.currentScreen == null
                && c.options.forwardKey.isPressed() && !c.player.isSneaking()) {
                c.options.sprintKey.setPressed(true);
            }
        });
        HudRenderCallback.EVENT.register(Hud::render);
    }
}
