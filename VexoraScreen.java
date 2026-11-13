package pl.vexora.client;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;

public class VexoraScreen extends Screen {
    private static final int COLS = 3, CW = 116, CH = 54, GAP = 8;
    private int px, py;

    public VexoraScreen() { super(Text.literal("Vexora")); }

    private int rows() { return (Config.MODS.size() + COLS - 1) / COLS; }
    private int cardX(int i) { return px + GAP + (i % COLS) * (CW + GAP); }
    private int cardY(int i) { return py + 22 + GAP + (i / COLS) * (CH + GAP); }

    private void layout() {
        int pw = COLS * CW + (COLS + 1) * GAP, ph = 22 + rows() * (CH + GAP) + GAP;
        px = (width - pw) / 2; py = (height - ph) / 2;
    }

    @Override
    public void render(DrawContext c, int mx, int my, float delta) {
        layout();
        int pw = COLS * CW + (COLS + 1) * GAP, ph = 22 + rows() * (CH + GAP) + GAP;
        c.fill(0, 0, width, height, 0x99000000);
        c.fill(px - 1, py - 1, px + pw + 1, py + ph + 1, 0xFF3DDC63);
        c.fill(px, py, px + pw, py + ph, 0xF0141C16);
        c.fill(px, py, px + pw, py + 22, 0xFF2F9E44);
        c.drawText(textRenderer, "VEXORA", px + 8, py + 7, 0xFFFFFFFF, true);
        String hint = "Prawy Shift: zamknij";
        c.drawText(textRenderer, hint, px + pw - textRenderer.getWidth(hint) - 8, py + 7, 0xFFD9F5DF, true);
        for (int i = 0; i < Config.MODS.size(); i++) {
            String[] m = Config.MODS.get(i);
            int x = cardX(i), y = cardY(i);
            c.fill(x, y, x + CW, y + CH, 0xFF1F2A22);
            c.drawCenteredTextWithShadow(textRenderer, m[1], x + CW / 2, y + 10, 0xFFFFFFFF);
            boolean on = Config.on(m[0]);
            boolean hover = mx >= x && mx < x + CW && my >= y + CH - 20 && my < y + CH;
            int col = on ? (hover ? 0xFF3DDC63 : 0xFF2F9E44) : (hover ? 0xFFE0485B : 0xFFC93A4D);
            c.fill(x, y + CH - 20, x + CW, y + CH, col);
            c.drawCenteredTextWithShadow(textRenderer, on ? "WŁĄCZONY" : "WYŁĄCZONY", x + CW / 2, y + CH - 14, 0xFFFFFFFF);
        }
    }

    @Override
    public boolean mouseClicked(double mx, double my, int button) {
        layout();
        for (int i = 0; i < Config.MODS.size(); i++) {
            int x = cardX(i), y = cardY(i);
            if (mx >= x && mx < x + CW && my >= y + CH - 20 && my < y + CH) {
                Config.toggle(Config.MODS.get(i)[0]);
                return true;
            }
        }
        return super.mouseClicked(mx, my, button);
    }

    @Override
    public boolean keyPressed(int key, int scan, int mods) {
        if (key == GLFW.GLFW_KEY_RIGHT_SHIFT) { close(); return true; }
        return super.keyPressed(key, scan, mods);
    }

    @Override
    public boolean shouldPause() { return false; }
}
