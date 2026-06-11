package play.chunky.companion;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

final class BoundaryTest {
    @Test
    void hitboxesUseOnlyVanillaRendererFlag() throws IOException {
        String source = Files.readString(Path.of("src/client/java/play/chunky/companion/ChunkyPlayClient.java"));

        assertTrue(source.contains("setRenderHitboxes(hitboxesEnabled)"));
        assertFalse(source.contains("disableDepthTest"));
        assertFalse(source.contains("depthFunc"));
        assertFalse(source.contains("RenderSystem"));
        assertFalse(source.contains("sendPacket"));
        assertFalse(source.contains("setVelocity"));
    }
}

