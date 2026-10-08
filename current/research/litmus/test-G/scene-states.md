# Scene states (test G)

**Request:** Car ad, 20 seconds, 4 scenes: the car in the desert; inside the car in the desert, its keychain; the same car drifting in Tokyo at night; inside the car in Tokyo, the same keychain.

**Style:** Photoreal cinematic imagery with warm sand and cool neon palettes, fine film grain, crisp surfaces, and sculpted directional light.

**Assets:**
- @car (prop): Sports coupe, 4.6 meters long and 1.9 meters wide, with graphite metallic bodywork, black alloy wheels, tinted windows, and narrow LED headlights.
- @keychain (prop): Keychain, 9 centimeters long, consisting of a brushed-steel split ring, a black rectangular key fob, and a small red leather tab.
- @desert (location): Desert basin, approximately 5 kilometers across, with ocher dunes, distant rock ridges, and a straight asphalt road.
- @cabin (location): Car cabin inside @car, approximately 2.4 meters long and 1.5 meters wide, with black leather upholstery, brushed-metal dashboard trim, and a dashboard ignition slot.
- @tokyo (location): Tokyo street intersection, approximately 40 meters across, bordered by multistory commercial buildings, Japanese neon signage, asphalt lanes, and painted crosswalks.

## Scene 1 · cut · @desert
- Start (@desert, @car): A low, wide side view places @car in the left third of the frame on the road through @desert, facing right. @desert fills the foreground and horizon. Late-afternoon sunlight falls from frame left beneath a clear sky; @car casts a long shadow toward frame right.
- Action: Over five seconds, @car drives steadily from the left third to the right third of the road through @desert. Static camera.
- Changes: @car position: Left third of the frame on the road → Right third of the frame on the road
- End (@desert, @car): The same low, wide side view places @car in the right third of the frame on the road through @desert, facing right. @desert fills the foreground and horizon. Late-afternoon sunlight falls from frame left beneath a clear sky; @car casts a long shadow toward frame right.
- Same as: @desert ← scene new, @car ← scene new

## Scene 2 · cut · @cabin
- Start (@cabin, @keychain, @desert): A tight dashboard-level view frames @cabin around @keychain, which hangs from the ignition near frame center, angled 20 degrees left of vertical. @desert appears softly out of focus through the windshield along the upper edge. Warm late-afternoon light enters from the left; the visible sky is clear.
- Action: Over five seconds, @keychain swings gently from its leftmost position to its rightmost position inside @cabin. Static camera.
- Changes: @keychain hanging angle: 20 degrees left of vertical → 20 degrees right of vertical
- End (@cabin, @keychain, @desert): The same tight dashboard-level view frames @cabin around @keychain, which hangs from the ignition near frame center, angled 20 degrees right of vertical. @desert appears softly out of focus through the windshield along the upper edge. Warm late-afternoon light enters from the left; the visible sky is clear.
- Same as: @cabin ← scene new, @keychain ← scene new, @desert ← scene 1

## Scene 3 · cut · @tokyo
- Start (@tokyo, @car): A low, wide three-quarter view frames @tokyo with @car at the left edge of the intersection, its nose pointing diagonally toward frame right and its headlights illuminated. It is a dry, clear night. Cyan and magenta light from @tokyo falls across @car and the road.
- Action: Over five seconds, @car drifts across @tokyo, sliding toward frame right while rotating its nose toward the camera. Static camera.
- Changes: @car position: Left edge of the intersection → Right half of the intersection; @car orientation: Nose pointing diagonally toward frame right → Nose pointing diagonally toward the camera
- End (@tokyo, @car): The same low, wide three-quarter view frames @tokyo with @car in the right half of the intersection, its nose pointing diagonally toward the camera and its headlights illuminated. It is a dry, clear night. Cyan and magenta light from @tokyo falls across @car and the road.
- Same as: @tokyo ← scene new, @car ← scene 1

## Scene 4 · cut · @cabin
- Start (@cabin, @keychain, @tokyo): A tight dashboard-level view frames @cabin around @keychain, which hangs from the ignition near frame center, angled 30 degrees left of vertical. @tokyo appears softly out of focus through the windshield along the upper edge. Cyan light enters from the left and magenta light from the right on a dry, clear night.
- Action: Over five seconds, @keychain swings from its leftmost position to its rightmost position inside @cabin. Static camera.
- Changes: @keychain hanging angle: 30 degrees left of vertical → 30 degrees right of vertical
- End (@cabin, @keychain, @tokyo): The same tight dashboard-level view frames @cabin around @keychain, which hangs from the ignition near frame center, angled 30 degrees right of vertical. @tokyo appears softly out of focus through the windshield along the upper edge. Cyan light enters from the left and magenta light from the right on a dry, clear night.
- Same as: @cabin ← scene 2, @keychain ← scene 2, @tokyo ← scene 3