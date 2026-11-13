package pl.vexora.client;

import net.fabricmc.loader.api.FabricLoader;
import java.io.*;
import java.nio.file.Path;
import java.util.List;
import java.util.Properties;

public class Config {
    // id, nazwa
    public static final List<String[]> MODS = List.of(
        new String[]{"fps", "FPS"}, new String[]{"cps", "CPS"}, new String[]{"keys", "Klawisze"},
        new String[]{"armor", "Zbroja"}, new String[]{"coords", "Koordynaty"}, new String[]{"ping", "Ping"},
        new String[]{"effects", "Efekty"}, new String[]{"sprint", "Auto sprint"});
    private static final Properties P = new Properties();
    private static final Path FILE = FabricLoader.getInstance().getConfigDir().resolve("vexora.properties");

    public static void load() {
        try (InputStream in = new FileInputStream(FILE.toFile())) { P.load(in); } catch (IOException ignored) {}
    }
    public static boolean on(String id) {
        boolean def = !id.equals("sprint");
        return Boolean.parseBoolean(P.getProperty(id, String.valueOf(def)));
    }
    public static void toggle(String id) {
        P.setProperty(id, String.valueOf(!on(id)));
        try (OutputStream out = new FileOutputStream(FILE.toFile())) { P.store(out, "Vexora Client"); } catch (IOException ignored) {}
    }
}
