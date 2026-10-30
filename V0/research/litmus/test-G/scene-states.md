# Scene states (test G)

**Request:** Car ad, 20 seconds, 4 scenes: the car in the desert; inside the car in the desert, its keychain; the same car drifting in Tokyo at night; inside the car in Tokyo, the same keychain.

**Style:** Photorealistic cinematic imagery with warm amber and cool neon palettes, crisp metallic textures, and sculpted high-contrast light.

**Assets:**
- @car (prop): Sports coupe, 4.5 meters long, with a metallic silver body, black wheels, tinted glass, and an unbadged silhouette.
- @cabin (location): Car cabin, 2.4 meters long and 1.5 meters wide, with black leather upholstery, brushed aluminum trim, and a central keychain attachment point.
- @keychain (prop): Keychain, 8 centimeters long, consisting of a polished steel ring, a short steel chain, and a circular red enamel charm.
- @desert (location): Desert basin, approximately 5 kilometers across, with a flat sandy track, low dunes, and distant rocky ridges.
- @tokyo (location): Tokyo street intersection, approximately 30 meters wide, bordered by dense commercial buildings with Japanese illuminated signage.

## Scene 1 · cut · @desert
- Start (@desert, @car): A wide, low three-quarter view places @car in the left third of @desert, pointing toward frame right. @car is traveling forward. Late-afternoon sunlight comes from the upper left; the weather is clear and still.
- Action: For five seconds, @car travels across @desert toward frame right. Static camera.
- Changes: @car position: Left third of frame, pointing right. → Right third of frame, pointing right.
- End (@desert, @car): The same wide, low three-quarter view places @car in the right third of @desert, still pointing toward frame right and traveling forward. Late-afternoon sunlight remains upper left; the weather is clear and still.
- Same as: @desert ← scene new, @car ← scene new

## Scene 2 · cut · @cabin
- Start (@cabin, @keychain): A tight interior close-up centers @keychain against softly defocused @cabin, excluding all exterior views. @keychain hangs tilted left. Late-afternoon amber light enters from frame left, continuing the clear-weather desert setting.
- Action: Over five seconds, @keychain swings gently from left to right inside @cabin. Static camera.
- Changes: @keychain pose_action: Hanging tilted left. → Hanging tilted right.
- End (@cabin, @keychain): The same tight interior close-up centers @keychain against softly defocused @cabin, with all exterior views excluded. @keychain hangs tilted right. Late-afternoon amber light continues entering from frame left.
- Same as: @cabin ← scene new, @keychain ← scene new

## Scene 3 · cut · @tokyo
- Start (@tokyo, @car): A wide, low street-level view places @car left of center in @tokyo. @car is angled diagonally toward the camera while sliding toward frame right. It is night after rain, with no rain falling; blue and magenta illumination reflects across the wet ground.
- Action: For five seconds, @car drifts sideways across @tokyo toward frame right. Static camera.
- Changes: @car position: Left of center, angled diagonally toward camera. → Right of center, angled diagonally toward camera.
- End (@tokyo, @car): The same wide, low street-level view places @car right of center in @tokyo, angled diagonally toward the camera and still sliding toward frame right. Nighttime blue and magenta illumination continues reflecting across the wet ground; no rain is falling.
- Same as: @tokyo ← scene new, @car ← scene 1

## Scene 4 · cut · @cabin
- Start (@cabin, @keychain): A tight interior close-up centers @keychain against softly defocused @cabin, excluding all exterior views. @keychain hangs tilted right. Blue and magenta nighttime light enters from frame left, continuing the Tokyo setting after rain.
- Action: Over five seconds, @keychain swings from right to left inside @cabin. Static camera.
- Changes: @keychain pose_action: Hanging tilted right. → Hanging tilted left.
- End (@cabin, @keychain): The same tight interior close-up centers @keychain against softly defocused @cabin, with all exterior views excluded. @keychain hangs tilted left. Blue and magenta nighttime light continues entering from frame left.
- Same as: @cabin ← scene 2, @keychain ← scene 2