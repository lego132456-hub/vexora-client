package pl.vexora.client;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.item.ItemStack;

public class Hud {
    static final int ACCENT = 0xFF3DDC63, BG = 0x99101810, ON = 0xCC2F9E44;

    public static void render(DrawContext ctx, RenderTickCounter tick) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player == null || mc.options.hudHidden) return;
        TextRenderer tr = mc.textRenderer;
        int y = 6;
        if (Config.on("fps")) y = pill(ctx, tr, mc.getCurrentFps() + " FPS", 6, y);
        if (Config.on("cps")) y = pill(ctx, tr, Cps.left() + " | " + Cps.right() + " CPS", 6, y);
        if (Config.on("ping")) {
            int ms = 0;
            if (mc.getNetworkHandler() != null) {
                PlayerListEntry e = mc.getNetworkHandler().getPlayerListEntry(mc.player.getUuid());
                if (e != null) ms = e.getLatency();
            }
            y = pill(ctx, tr, ms + " ms", 6, y);
        }
        if (Config.on("coords")) {
            y = pill(ctx, tr, "XYZ " + mc.player.getBlockX() + " " + mc.player.getBlockY() + " " + mc.player.getBlockZ(), 6, y);
        }
        if (Config.on("keys")) keys(ctx, tr, mc, 6, y + 4);
        int w = mc.getWindow().getScaledWidth(), h = mc.getWindow().getScaledHeight();
        if (Config.on("armor")) armor(ctx, tr, mc, w - 24, h / 2 - 36);
        if (Config.on("effects")) effects(ctx, tr, mc, w, 6);
    }

    static int pill(DrawContext ctx, TextRenderer tr, String text, int x, int y) {
        int w = tr.getWidth(text) + 9;
        ctx.fill(x, y, x + w, y + 14, BG);
        ctx.fill(x, y, x + 2, y + 14, ACCENT);
        ctx.drawText(tr, text, x + 5, y + 3, 0xFFFFFFFF, true);
        return y + 16;
    }

    static void key(DrawContext ctx, TextRenderer tr, String label, boolean down, int x, int y, int w, int h) {
        ctx.fill(x, y, x + w, y + h, down ? ON : BG);
        ctx.drawCenteredTextWithShadow(tr, label, x + w / 2, y + (h - 8) / 2 + 1, 0xFFFFFFFF);
    }

    static void keys(DrawContext ctx, TextRenderer tr, MinecraftClient mc, int x, int y) {
        var o = mc.options;
        key(ctx, tr, "W", o.forwardKey.isPressed(), x + 22, y, 20, 20);
        key(ctx, tr, "A", o.leftKey.isPressed(), x, y + 22, 20, 20);
        key(ctx, tr, "S", o.backKey.isPressed(), x + 22, y + 22, 20, 20);
        key(ctx, tr, "D", o.rightKey.isPressed(), x + 44, y + 22, 20, 20);
        key(ctx, tr, "—", o.jumpKey.isPressed(), x, y + 44, 64, 12);
    }

    static void armor(DrawContext ctx, TextRenderer tr, MinecraftClient mc, int x, int y) {
        EquipmentSlot[] slots = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET};
        for (EquipmentSlot s : slots) {
            ItemStack st = mc.player.getEquippedStack(s);
            if (!st.isEmpty()) {
                ctx.drawItem(st, x, y);
                if (st.isDamageable()) {
                    int pct = (st.getMaxDamage() - st.getDamage()) * 100 / st.getMaxDamage();
                    String t = pct + "%";
                    ctx.drawText(tr, t, x - tr.getWidth(t) - 4, y + 4, pct > 30 ? 0xFF7BD88F : 0xFFFF6B6B, true);
                }
            }
            y += 18;
        }
    }

    static void effects(DrawContext ctx, TextRenderer tr, MinecraftClient mc, int w, int y) {
        for (StatusEffectInstance e : mc.player.getStatusEffects()) {
            int sec = e.getDuration() / 20;
            String t = e.getEffectType().value().getName().getString() + " " + (e.getAmplifier() + 1)
                + "  " + (sec / 60) + ":" + String.format("%02d", sec % 60);
            int tw = tr.getWidth(t) + 9;
            ctx.fill(w - 6 - tw, y, w - 6, y + 14, BG);
            ctx.fill(w - 8, y, w - 6, y + 14, ACCENT);
            ctx.drawText(tr, t, w - 6 - tw + 4, y + 3, 0xFFFFFFFF, true);
            y += 16;
        }
    }
}
