# Scene states (test CAR)

**Request:** Car ad, 10 seconds, 2 scenes: a car in the desert, then the same car in a Tokyo drift scene at night.

**Style:** Photorealistic automotive cinematography with warm sand and cool neon palettes, crisp metallic textures, and sculpted natural or reflected light.

**Assets:**
- @car (prop): Sports coupe, 4.6 meters long, with metallic silver bodywork, a low aerodynamic silhouette, black alloy wheels, tinted windows, and narrow LED headlights.
- @desert (location): Desert basin, approximately 2 kilometers across, with a flat sandy driving track, ochre dunes, distant rocky ridges, and no vegetation.
- @tokyo (location): Tokyo street intersection, approximately 60 meters across, with asphalt lanes, white crossing markings, dense commercial facades, and Japanese neon signage.

## Scene 1 · cut · @desert
- Start (@car, @desert): A wide, low roadside frame places @car in the left third of @desert, traveling toward frame right with a low dust trail behind it. Late-afternoon sunlight falls from the upper left under a clear sky; the weather is dry and still.
- Action: For five seconds, @car speeds across @desert from the left third to the right third, trailing dust. Static camera.
- Changes: @car position: Left third of frame, on the driving track → Right third of frame, on the driving track
- End (@car, @desert): The same wide, low roadside frame places @car in the right third of @desert, still traveling toward frame right with a low dust trail stretching behind it. Late-afternoon sunlight continues from the upper left under the clear sky; the weather remains dry and still.
- Same as: @car ← scene new, @desert ← scene new

## Scene 2 · cut · @tokyo
- Start (@car, @tokyo): A wide, low curbside frame places @car in the right third of @tokyo, entering a leftward drift with its nose angled slightly toward the camera. It is night after rain, with no precipitation falling. Cyan and magenta light reflects across the damp ground and @car; the intersection is otherwise empty.
- Action: For five seconds, @car drifts leftward across @tokyo, rotating toward the camera and throwing a widening fan of water. Static camera.
- Changes: @car pose_action: Entering a leftward drift, nose angled 20 degrees toward camera → Holding a leftward drift, nose angled 60 degrees toward camera; @car position: Right third of frame, inside the intersection → Left third of frame, inside the intersection; @car condition: Rain-speckled, headlights on, light spray behind tires → Rain-speckled, headlights on, broad water spray behind tires
- End (@car, @tokyo): The same wide, low curbside frame places @car in the left third of @tokyo, sliding leftward with its nose turned farther toward the camera. A broad fan of water trails behind it. The night remains rain-free, with cyan and magenta reflections across the damp ground and @car; the intersection is otherwise empty.
- Same as: @car ← scene 1, @tokyo ← scene new