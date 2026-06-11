package play.chunky.companion;

import net.fabricmc.api.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class ChunkyPlayCompanion implements ModInitializer {
    public static final String MOD_ID = "chunkyplay-companion";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize() {
        LOGGER.info("ChunkyPlay Companion loaded under its real mod id.");
    }
}

