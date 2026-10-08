# Scene states (test CAR)

**Request:** Car ad, 10 seconds, 2 scenes: a car in the desert, then the same car in a Tokyo drift scene at night.

**Style:** Photorealistic automotive cinematography, warm sand and cool neon palette, crisp polished textures, sculpted directional light.

**Assets:**
- @car (prop): Sports coupe, 4.5 meters long and 1.9 meters wide, with metallic silver bodywork, black alloy wheels, dark tinted windows and a low aerodynamic silhouette.
- @desert (location): Desert basin, approximately 2 kilometers across, with a flat hard-packed central expanse, surrounding sand dunes and a distant rocky ridgeline.
- @tokyo (location): Closed Tokyo street course, approximately 120 meters long and 12 meters wide, with asphalt paving, dense Japanese commercial architecture and integrated neon facade accents.

## Scene 1 · cut · @desert
- Start (@desert, @car): A low, wide side view frames @desert beneath a clear late-afternoon sky. @car occupies the left third of the frame, oriented directly toward screen right. The horizon sits in the upper third; warm sunlight illuminates @car from camera-left, with its shadow extending toward the lower right. The weather is dry and still.
- Action: @car travels straight across @desert from the left third to the right third. Static camera.
- Changes: @car screen position: Left third of the frame → Right third of the frame
- End (@desert, @car): A low, wide side view frames @desert beneath a clear late-afternoon sky. @car occupies the right third of the frame, oriented directly toward screen right. The horizon sits in the upper third; warm sunlight illuminates @car from camera-left, with its shadow extending toward the lower right. The weather is dry and still.
- Same as: @desert ← scene new, @car ← scene new

## Scene 2 · cut · @tokyo
- Start (@tokyo, @car): A low, wide three-quarter view frames @tokyo at night, with the course spanning the foreground and architecture filling the background. @car occupies the left third, its nose pointing screen right and angled 15 degrees toward the camera. Cyan and magenta illumination falls across @car and the dry course. The weather is clear and still; no other traffic is visible.
- Action: @car drifts sideways through @tokyo toward the right third, rotating its nose farther toward the camera. Static camera.
- Changes: @car screen position: Left third of the frame → Right third of the frame; @car orientation: Nose pointing screen right, angled 15 degrees toward the camera → Nose pointing screen right, angled 45 degrees toward the camera
- End (@tokyo, @car): A low, wide three-quarter view frames @tokyo at night, with the course spanning the foreground and architecture filling the background. @car occupies the right third, its nose pointing screen right and angled 45 degrees toward the camera. Cyan and magenta illumination falls across @car and the dry course. The weather is clear and still; no other traffic is visible.
- Same as: @tokyo ← scene new, @car ← scene 1