# Bench v1 · mcp-1

152 items · 62 pass (41%) · mean score 61/100 · something made in 127 · 10115 credits · 142 min of item time

| Group | Items | Made | Pass | Mean score | Credits |
|---|---|---|---|---|---|
| A. Single images | 24 | 24 | 20 (83%) | 89 | 290 |
| B. Image edits | 26 | 26 | 16 (62%) | 80 | 295 |
| C. Faces and characters | 12 | 9 | 8 (67%) | 88 | 759 |
| D. Short video | 18 | 17 | 3 (17%) | 51 | 2828 |
| E. Editing the user's video | 18 | 7 | 0 (0%) | 12 | 707 |
| F. Sound | 7 | 4 | 1 (14%) | 26 | 65 |
| G. Composed pieces | 16 | 16 | 3 (19%) | 53 | 875 |
| H. Ads and reels | 13 | 12 | 1 (8%) | 46 | 3048 |
| J. Conversation | 18 | 12 | 10 (56%) | 71 | 1248 |

Conversation: asked when it had to 6/7 · asked nothing when it need not 136/143 · stopped asking within 3 rounds 0/1 · refused when it should 5/5 · did not refuse wrongly 0/0 · said when beyond the free tier 2/2 · reply right where the answer is words 11/11

## Why items fail

- not-usable: 65
- major-fault: 63
- must-have-missed: 58
- text-wrong: 20
- not-made: 14
- too-few-outputs: 10
- wrong-aspect: 8
- asked-unneeded: 7
- wrong-kind: 6
- wrong-length: 6
- no-audio: 2
- kept-asking: 1
- step-failed:add_subtitles_to_video: 1
- not-made:failed: 1
- didnt-ask: 1

## Tools

| Tool | Planned | Made | Failed | Placeholder (not wired) | Credits |
|---|---|---|---|---|---|
| edit_image | 83 | 83 | 0 | 0 | 780 |
| generate_image | 46 | 46 | 0 | 0 | 395 |
| create_video_from_text | 26 | 26 | 0 | 0 | 5280 |
| create_video_from_image | 13 | 13 | 0 | 0 | 2448 |
| detect_faces | 8 | 8 | 0 | 0 | 0 |
| add_subtitles_to_video | 6 | 5 | 1 | 0 | 230 |
| generate_music | 6 | 6 | 0 | 0 | 95 |
| edit_video | 3 | 3 | 0 | 0 | 552 |
| remove_image_background | 2 | 2 | 0 | 0 | 10 |
| swap_face_in_photo | 2 | 2 | 0 | 0 | 20 |
| swap_face_in_video | 2 | 2 | 0 | 0 | 270 |
| upscale_image | 1 | 1 | 0 | 0 | 25 |
| create_meme | 1 | 1 | 0 | 0 | 10 |

Step errors:
- add_subtitles_to_video ×1: {"type":"mcp_tool_execution_error","content":[{"annotations":null,"meta":null,"type":"text

## Below the mean (61)

- **D20d** Mixed Sizes Without Cropping · 0 · not-made
  asked: "These photos are all different shapes. Make one 10-second vertical reel, in this order. Keep each whole photo visible—don't stretch or crop " → 
- **E24b** Spanish Subtitles For This Clip · 0 · not-made
  asked: "Add Spanish subtitles to this English clip, please. Leave her voice in English and keep the whole video as it is." → 
- **E24c** Silent Clip Subtitle Check · 0 · asked-unneeded, step-failed:add_subtitles_to_video, not-made:failed
  asked: "Can you subtitle this clip? If there's no speech in the audio, just tell me." → add_subtitles_to_video · reply: The agent meets all four must-haves, although the transcript does not substantiate its specific claim that the clip has no audio track.
- **E25a** Keep Her Centred in Portrait · 0 · not-made
  asked: "Make this landscape clip vertical, 9:16. Keep her centred throughout and keep the full 10 seconds with the original sound. No captions." → 
- **E26a** Pick the Best Ten Seconds · 0 · not-made
  asked: "Trim this to the best 10 seconds. You pick the part." → 
- **E26b** Cut Out the Boring Parts · 0 · not-made
  asked: "Cut the boring parts out of this. Just a quick 8-second version." → 
- **E27b** Choose Music That Fits · 0 · not-made
  asked: "Can you put some music on this? Just something that fits. Leave the clip and conversation as they are." → 
- **E28a** Add My Supplied Voiceover · 0 · not-made
  asked: "Add a warm, clear English voice-over to this silent clip, saying exactly: “Make mornings easier: prepare your clothes, pack your bag, and pl" → 
- **E28b** Write Narration From The Clip · 0 · not-made
  asked: "Watch this and write a short English voice-over explaining what's happening. Replace the original conversation with your narration, friendly" → 
- **E28c** Fit Narration To Seven Seconds · 0 · not-made
  asked: "Replace all the sound with a calm English narrator saying: “Above the clouds, every second counts. Stay focused, trust your training, and br" → 
- **E29b** Append a Clean End Card · 0 · not-made
  asked: "Keep this whole 7-second clip, then add a 2-second black end card with white text: 'Ready for takeoff?' and '@flightschool' underneath. Cent" → 
- **E29c** Subtle Handle Watermark Throughout · 0 · not-made
  asked: "Add @flightschool as a subtle watermark at the bottom right for this whole clip. Small white text, slightly see-through, with a faint shadow" → 
- **F31a** Calm Voice Reading Supplied Script · 0 · not-made
  asked: "Make an audio-only voice-over, about 10 seconds, in a calm, reassuring voice. Read exactly: “Take a slow breath. Let your shoulders relax. T" → 
- **F31b** Two Voices Trading Short Lines · 0 · not-made
  asked: "Can you make one audio-only clip, around 8 seconds, with two clearly different voices? Friendly, natural conversation. A is a lower voice, B" → 
- **F32b** Tiny Forests Two Host Segment · 0 · not-made
  asked: "Turn this article into a roughly 90-second podcast chat between two hosts. Use two clearly different English voices, one male and one female" → 
- **C15c** Two Coworkers Two Replacement Faces · 3 · asked-unneeded, kept-asking, wrong-kind, no-audio, must-have-missed, major-fault, not-usable
  asked: "Swap both faces in this 10-second office clip: the man's face from the man's portrait, and the woman's from the woman's portrait. Keep their" → detect_faces→detect_faces→detect_faces · judge: The agent produced only face-detection previews and clarification requests, leaving the requested two-face video edit undone.
- **E27a** Warm Music for Morning Tips · 5 · asked-unneeded, wrong-kind, wrong-length, must-have-missed, major-fault, not-usable
  asked: "Add some warm, hopeful music to this clip, nothing too energetic. Keep the whole video and my voice." → generate_music · judge: The output is a 15-second audio file containing speech, not the requested 10-second video with gentle music and the woman's original voice preserved.
- **E27c** Music Beneath the Radio Calls · 5 · asked-unneeded, wrong-kind, wrong-length, must-have-missed, major-fault, not-usable
  asked: "Add a tense instrumental bed to this. Keep it under the radio calls so every word is easy to hear, especially 'Rook, you with me?' Don't cha" → generate_music · judge: The output is a 15-second audio file containing unrequested speech, not the requested seven-second instrumental accompaniment or a finished mix with clear radio calls.
- **G37a** Night Market Event Pack · 16 · wrong-kind, too-few-outputs, must-have-missed, major-fault, not-usable
  asked: "Make a matching event pack: a 4:5 poster, a vertical story image and a 10-second vertical reel. Details on all three: Lantern Night Market /" → generate_image→edit_image→create_video_from_image · judge: The delivered poster is attractive and readable with all required wording, but the requested story image and animated reel are missing.
- **A06c** Transparent Moon Bakery Logo · 17 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make a square logo for my bakery, Mooncrumb: a gold crescent moon above dark navy lettering. Send it as a transparent PNG so I can put it on" → generate_image→remove_image_background · judge: The output is a tan-gold square with a barely visible crescent and no readable bakery name, rather than a usable transparent logo.
- **J50b** Change Only the Ending · 18 · wrong-aspect, wrong-length, must-have-missed, major-fault, not-usable
  asked: "Make an 8-second widescreen animation, no sound or text. A white paper plane glides through a sunny study for five seconds, then lands on a " → create_video_from_text | edit_video · judge: The three-second clip shows a white plane flying through a sunny animated study, but it does not show the requested notebook landing and contains unwanted speech.
- **E29a** Fox Logo Throughout the Clip · 20 · wrong-kind, no-audio, must-have-missed, major-fault, not-usable
  asked: "Put this fox in the top-right corner as a small logo for the whole video. Remove its white background, leave a little space around it, and k" → remove_image_background · judge: The output is a large fox image with a blurred background and dark halos, not the requested logo-overlay video.
- **F30b** Upbeat Reel Music Default · 20 · wrong-length, must-have-missed, major-fault, not-usable
  asked: "Can you make me some music? Something upbeat for a reel." → generate_music · judge: A 15-second audio file was delivered, but it contains unrelated spoken dialogue, and the supplied evidence does not establish the requested upbeat musical qualities.
- **J49c** Shorter Clip Same Opening · 20 · wrong-length, must-have-missed, major-fault, not-usable
  asked: "Make an 8-second widescreen video of a paper boat drifting slowly across a pond, fixed camera, soft morning light. Silent, no text." → create_video_from_text |  · judge: The clip shows a paper boat drifting on a softly lit pond, but it remains eight seconds instead of being cut to five.
- **G37b** Rescheduled Event Across All Formats · 21 · wrong-kind, too-few-outputs, must-have-missed, major-fault, not-usable
  asked: "Make a matching 4:5 poster, vertical story image and 10-second vertical reel for Rooftop Jazz. Put these details on each: 17 October 2027 / " → generate_image→edit_image→create_video_from_image | edit_image→edit_image · judge: The two images clearly show the corrected date in a matching cream-and-burgundy design, but the revised pack is incomplete without the reel.
- **H44c** Rooftop Jazz in Two Formats · 21 · too-few-outputs, must-have-missed, text-wrong, major-fault, not-usable
  asked: "I need the same 10-second Rooftop Jazz promo in 9:16 for Stories and 16:9 for a venue screen. Sunset rooftop, musicians playing, mellow jazz" → create_video_from_text · judge: A full-frame sunset rooftop performance is shown in portrait format, but misspelled event text and the missing landscape version make the delivery unusable as requested.
- **G34c** One Print Style Across Plants · 25 · too-few-outputs, must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make four square Instagram carousel slides: Monstera, Snake plant, Pothos, Peace lily, in that order. One plant and its name per slide. Keep" → generate_image→edit_image→edit_image→edit_image · judge: Three attractive, closely matched plant slides were delivered, but the required opening Monstera slide is missing.
- **D22a** Make a Cat Then Animate · 26 · too-few-outputs, must-have-missed, major-fault, not-usable
  asked: "Make a square illustration of an orange cat wearing a blue scarf on a sunny windowsill, then animate that picture for 5 seconds: the cat bli" → generate_image→create_video_from_image · judge: The square clip attractively depicts the requested cat and shows tail movement, but the standalone picture is missing and a complete blink is not demonstrated.
- **A03d** Long Venue Address Preserved Exactly · 27 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Please make a clean black-and-cream 4:5 flyer. Text: "Printmakers' Open Studio", "9 October 2027", "11:00–17:00", and "Unit 14B, Second Floo" → generate_image→edit_image · judge: The black-and-cream flyer has a clean layout and correct date and time, but adds a year to the headline and fails to reproduce the address cleanly and exactly.
- **D18c** Lake Clouds and Water Moving · 27 · must-have-missed, major-fault, not-usable
  asked: "Turn this lake photo into an 8-second silent video. Let the clouds drift slowly and little ripples move across the water. Keep the mountains" → create_video_from_image · judge: The lake has gentle animated ripples and moving clouds, but a pronounced push-in, changing light, and incorrect aspect ratio prevent it from meeting the brief.
- **E24d** Make Those Captions TikTok Bold · 27 · asked-unneeded, wrong-aspect, must-have-missed, text-wrong, major-fault, not-usable
  asked: "Add English subtitles to this clip. Keep her original voice." → add_subtitles_to_video | edit_video→add_subtitles_to_video · judge: The output adds large, readable captions and keeps her face visible, but fails to make the video vertical.
- **E25b** Portrait Cut for Two Speakers · 28 · wrong-aspect, must-have-missed, major-fault, not-usable
  asked: "Turn this into a 9:16 vertical clip. Show the man when he asks his question, then the woman when she answers, with each centred while talkin" → edit_video · judge: The output keeps a 10-second office scene but fails to make it vertical or centre the speakers individually.
- **H42b** Gym Promo With Visit Details · 29 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make a 10-second vertical promo for Northside Gym. Use a welcoming gym scene, not hardcore bodybuilding, with upbeat music and no voiceover." → create_video_from_text · judge: The vertical promo has a welcoming cycling scene, but garbled business details and unwanted speech prevent it from being usable.
- **J51b** Resize Finished Clip Without Remaking · 30 · wrong-aspect, must-have-missed, major-fault, not-usable
  asked: "Make an 8-second widescreen cartoon of a little orange robot watering a potted plant. Put 'Small steps' at the top throughout. No sound." → create_video_from_text |  · judge: The cartoon and title are clearly visible, but the requested vertical resize with navy padding has not been delivered.
- **H40c** Sneaker Captions Stay Safely Inside · 32 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make a silent 15-second 9:16 sneaker ad. No photo—use a plain white leather low-top with white laces and a white sole, no logo. Three moving" → create_video_from_text · judge: The vertical white-sneaker ad has readable captions, but the opening text is garbled and every shown caption violates the requested top safe margin.
- **G35b** Imagine My Kitchen Renovation · 33 · must-have-missed, major-fault, not-usable
  asked: "Can you show how my kitchen could look renovated? Make one 16:9 before-and-after image, original on the left and your realistic makeover on " → edit_image · judge: The labeled comparison delivers the requested renovation finishes, but replaces the original photo with a reconstruction and removes the kitchen's sinks.
- **D23c** Coffee Clip Exact URL Ending · 34 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make a silent 8-second vertical coffee clip: a close-up of coffee being poured into a ceramic cup for 5 seconds, then a plain black end card" → create_video_from_text · judge: The coffee pour and black end card are present, but the URL is garbled and split across two lines, requiring a redo.
- **F30a** Warm Lo-Fi Music Bed · 34 · wrong-length, must-have-missed, major-fault, not-usable
  asked: "Make me a 10-second lo-fi hip-hop music bed, warm and relaxed. No vocals." → generate_music · judge: One audio file was delivered, but it lasts 15 seconds instead of the requested 10 seconds, and its musical qualities cannot be verified from the supplied transcription.
- **H40a** Black Bottle Product Reel · 34 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make a 15-second vertical 9:16 ad for the bottle in my photo. Clean studio look, a few moving close-ups, mellow music, no talking. Start wit" → edit_image→create_video_from_image · judge: The 15-second vertical ad provides clean studio product close-ups, but misspelled opening text, an absent closing call to action, unwanted speech, and a changing lid require a redo.
- **J49a** Warmer Without Recreating The Scene · 34 · must-have-missed, not-usable
  asked: "Make a square photo of a blue ceramic mug beside an open book on a wooden windowsill, soft daylight. No text." → generate_image | edit_image · judge: The image is an attractive, warm windowsill scene, but it includes printed text and places the mug on the book; preservation of the original cannot be verified.
- **G36a** One Coffee Ad Three Shapes · 35 · too-few-outputs, must-have-missed, major-fault, not-usable
  asked: "Make a coffee ad in three sizes: square 1:1, vertical 9:16 and wide 16:9. Use a steaming coffee cup, cream and dark green colours, and these" → generate_image→edit_image→edit_image · judge: Two attractive, consistent coffee ads contain the correct copy, but the required square version is missing.
- **J52a** Night Market Poster and Reel · 35 · too-few-outputs, must-have-missed, major-fault, not-usable
  asked: "Make a vertical poster and a matching 8-second reel for our night market. Both should say: “Night Market”, “Saturday 12 July”, “6–10 pm”, “R" → generate_image→create_video_from_image · judge: The reel has attractive warm illustrations, readable event text, and subtle animation, but a separate poster is not shown and the sound report flags unwanted speech.
- **G35a** Kitchen Renovation Side by Side · 36 · must-have-missed, major-fault, not-usable
  asked: "Put these kitchen photos side by side in one landscape 16:9 image. Old kitchen on the left, renovated one on the right, labeled “Before” and" → edit_image · judge: The comparison has clear labels and the correct left-to-right order, but it changes the supplied photos instead of preserving them.
- **D18b** Portrait With Subtle Natural Motion · 37 · must-have-missed, major-fault, not-usable
  asked: "Make this photo feel alive for 5 seconds: a natural blink and tiny breathing movement, nothing dramatic. Keep her face looking exactly like " → create_video_from_image · judge: The woman remains recognizable and shows a blink-like eyelid movement, but a pronounced zoom violates the requested still-camera animation.
- **D23a** Mountain Morning Opening Title · 37 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make a silent 6-second widescreen clip. Start with a dark green title card saying exactly “A quieter kind of morning” in cream lettering for" → create_video_from_text · judge: The clip has an attractive misty sunrise lake scene, but the title is misspelled and remains onscreen too long.
- **F32a** Twenty Second Podcast Intro · 37 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make a 20-second audio intro for my podcast, Small Wonders. A warm female voice should say: “Welcome to Small Wonders, the show about big id" → generate_music · judge: A 20-second audio file was produced, but the spoken introduction has an incorrect opening.
- **B07d** Change Only the Bottle · 38 · must-have-missed, major-fault, not-usable
  asked: "Turn just the black bottle forest green, still matte. Everything outside the bottle must stay exactly the same, including the table and shad" → edit_image · judge: The bottle is convincingly matte forest green, but altered table texture and small changes to the bottle's base prevent this from being a bottle-only recolor.
- **A04c** Exactly Three Red Balloons · 39 · must-have-missed, major-fault, not-usable
  asked: "Draw exactly three red balloons floating against a pale blue sky, each with its own dangling string. Keep them apart so I can count them. Sq" → generate_image · judge: The square illustration shows two separated red balloons with dangling strings against a pale blue sky, but the required third balloon is missing.
- **G38a** Three Matching Mug Listing Photos · 39 · too-few-outputs, must-have-missed, major-fault, not-usable
  asked: "Make three square listing photos for a plain sage-green ceramic mug: one on pure white, one on a cosy breakfast table, and one close-up of t" → generate_image→edit_image→edit_image · judge: The realistic breakfast-table and rim-detail photos work well, but the three-image set is incomplete because the main white-background listing photo is missing.
- **D22b** Animate the Lighthouse Just Made · 42 · must-have-missed, major-fault, not-usable
  asked: "Make me a wide watercolor picture of a red-and-white striped lighthouse on a rocky coast at dusk. No writing." → generate_image | create_video_from_image · judge: The dusk lighthouse scene shows moving surf and a sweeping beam, but the requested watercolor appearance is not convincing.
- **H41c** Exact Copy App Ad · 42 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Create a silent 9-second 16:9 ad for my fictional planning app DayNest. Three equal-length scenes with these exact lines, one per scene in t" → create_video_from_text · judge: The ad follows the cream-and-green calendar-and-checkmark direction, but incorrect first-line punctuation and extra calendar text require correction.
- **H44b** Countdown Into Neon Night · 42 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make an 8-second vertical ad for Neon Night, 12 September 2026 at The Foundry, Leeds. Start with a big 3, 2, 1 countdown, building electroni" → create_video_from_text · judge: The vertical neon ad reveals the event, but its held card contains a badly misspelled date and an extra garbled venue line.
- **B13a** Restore a Faded Family Scan · 43 · must-have-missed, major-fault, not-usable
  asked: "Can you clean up this old family scan and enlarge it to 640 pixels on the long side? Keep the sepia look and everyone's faces the same." → edit_image · judge: The restoration improves clarity and retains the sepia family scene, but changes facial details and misses the requested output dimensions.
- **G36b** Readable Sale Copy Every Size · 43 · too-few-outputs, must-have-missed, major-fault, not-usable
  asked: "I need matching plant-shop ads in 1:1, 9:16 and 16:9. Include exactly: “Fern House”, “Weekend Plant Sale”, “20% off all indoor plants”, “Sat" → generate_image→edit_image→edit_image→edit_image · judge: The two supplied ads are readable and visually coordinated, but the requested three-format set is incomplete and both layouts unnecessarily repeat the address.
- **J50c** Like Before but Blue · 43 · wrong-aspect, must-have-missed, major-fault, not-usable
  asked: "Make a 4:5 poster with a burnt-orange background, cream lettering and a simple cream crescent moon. Text: 'NIGHT MARKET' and 'SATURDAY 6–10 " → generate_image→edit_image | edit_image · judge: The poster has the correct navy background, cream text and crescent, but its square format fails the requested 4:5 aspect ratio.
- **D21a** Quiet Lake Website Loop · 44 · must-have-missed, major-fault, not-usable
  asked: "Make a 6-second seamless loop for my website background: a calm mountain lake at dusk, with gentle ripples. Wide 16:9, camera staying still," → create_video_from_text · judge: The clip shows a calm, fixed-view mountain lake at dusk with subtle ripples, but unwanted audio and excess duration require fixes.
- **G34a** Three Slides for Slow Sundays · 44 · must-have-missed, major-fault, not-usable
  asked: "Make 3 square Instagram carousel slides that look like a set for a cosy café. Text, in order: 'Slow Sunday', 'Coffee first', 'Stay a little " → generate_image→generate_image→generate_image→edit_image→edit_image · judge: The slides are attractive, readable, and visually coordinated, but an extra 'Slow Sunday' slide must be removed to deliver the requested three-slide carousel.
- **H44a** Lantern Night Date and Venue · 44 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make an 8-second vertical promo for our Lantern Night, with glowing lanterns after dark. Put the date and venue big on screen so people know" → create_video_from_text · judge: The vertical promo has attractive warm lanterns after dark, but duplicated garbled dates and the missing city make it unsuitable to post.
- **B09d** Match the Kitchen Window Light · 46 · must-have-missed, major-fault, not-usable
  asked: "Move this candle onto a pale kitchen counter with warm sunlight coming from the upper left. Make the light on the glass and the shadow on th" → edit_image · judge: The candle is convincingly placed on a pale kitchen counter, but the sunlight and cast shadow run in the wrong direction.
- **B12c** One Car Photo Three Sizes · 46 · must-have-missed, major-fault, not-usable
  asked: "I need this car photo in three sizes: square, 4:5 for the feed, and 9:16 for stories. Send three separate pictures. Keep the whole car in ea" → edit_image→edit_image→edit_image · judge: Three separate padded images keep the whole red car visible, but unnecessary changes to the original photo and a slightly incorrect stories ratio need fixing.
- **D19c** Hands Fold a Paper Sheet · 46 · must-have-missed, major-fault, not-usable
  asked: "Make an 8-second realistic widescreen video looking down at a person's hands folding a plain blue sheet of paper in half on a wooden table, " → create_video_from_text · judge: The clip convincingly shows blue paper being folded and creased, but uses a white surface instead of a wooden table and includes unwanted sound.
- **D23b** Gardener Interview Name Caption · 46 · must-have-missed, major-fault, not-usable
  asked: "Make a silent 7-second widescreen clip of a fictional woman standing in a community garden, smiling and turning slightly toward the camera. " → create_video_from_text · judge: The clip shows the requested smiling garden portrait with clear, correctly spelled titles, but unwanted speech breaks the silence requirement and the title appears slightly early.
- **G38b** Bottle Listing From One Photo · 46 · must-have-missed, major-fault, not-usable
  asked: "This is my only product photo. Turn it into three separate square listing images: a clean white-background shot, a lifestyle shot on a gym b" → edit_image→edit_image→edit_image · judge: Three well-composed square listing images were produced, but changes to the lid and surface finish prevent them from faithfully representing the exact bottle.
- **A06a** Simple Sprout Shop Logo · 48 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make a square logo for my plant shop, Little Sprout. Just a simple green sprout above the name on white, nothing fancy." → generate_image · judge: The simple green sprout logo on white matches the requested style, but the shop name is misspelled.
- **B08c** Clean Up This Kitchen · 48 · must-have-missed, major-fault, not-usable
  asked: "Can you clean this up?" → edit_image · judge: The counters look clean and natural and the original finishes remain, but the edit incorrectly removes the right-hand sink and faucet.
- **D19a** Dog Catches a Flying Frisbee · 49 · must-have-missed, major-fault, not-usable
  asked: "Make a realistic 5-second widescreen video of a golden retriever catching a red frisbee in a grassy park. One continuous shot with the camer" → create_video_from_text · judge: A realistic golden retriever catches an identifiable red frisbee in a grassy park, but the camera moves instead of remaining fixed.
- **E25c** Vertical Speaker Cut With Captions · 49 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make this 9:16 with her centred and add readable English captions matching what she says. Keep the whole 10 seconds and her original voice. " → add_subtitles_to_video · judge: The clip has readable captions below her face, but it remains landscape instead of the requested 9:16 portrait format.
- **H41a** FitTrack Ad From Supplied Screenshots · 49 · must-have-missed, major-fault, not-usable
  asked: "Make a 10-second widescreen 16:9 ad for FitTrack using both screenshots. Show the home screen first, then the workout screen, and finish wit" → create_video_from_text · judge: The ad has a clean widescreen layout, the correct screen sequence, and a clear FitTrack ending, but distorted screenshot text requires a redo.
- **H42a** Café Reel From Owner Photos · 49 · must-have-missed, major-fault, not-usable
  asked: "These are photos of my café. Make a cosy 9-second vertical Instagram reel using all three, storefront first. Gentle movement, soft upbeat mu" → create_video_from_text · judge: The vertical reel uses all three recognisable café images and both correct titles, but unwanted speech prevents it from being ready to post.
- **B12d** Left Edge Sneaker Stays Visible · 52 · major-fault, not-usable
  asked: "Make this square for my shop. The shoe's way over on the left, so don't just crop the middle. Keep the whole shoe; plain padding to match th" → edit_image · judge: The output is square and keeps the entire sneaker with neutral padding, but it alters the product instead of preserving the original photograph unchanged.
- **B13b** Sharpen a Blurry Dog Photo · 52 · major-fault, not-usable
  asked: "This phone pic of my dog came out blurry. Can you make it clearer and bigger, 640 pixels on the long side? Keep it looking natural." → edit_image · judge: The dog is substantially clearer and looks natural, with the pose and framing preserved, but the image needs resizing to the requested 640-pixel long edge.
- **D19b** Slow Push Into Forest Cabin · 52 · major-fault, not-usable
  asked: "A realistic little wooden cabin among pine trees at dawn. Make a silent 6-second widescreen video, one shot slowly pushing toward the front " → create_video_from_text · judge: A convincing dawn cabin shot has clear forward movement and foreground parallax, but unwanted audio violates the explicit silence requirement.
- **G34b** Five Tips Five Separate Slides · 52 · text-wrong, major-fault, not-usable
  asked: "Need a 4:5 Instagram carousel: five focus tips, one per slide. Use these in order: 'Clear your desk', 'Silence notifications', 'Pick one tas" → generate_image→edit_image→edit_image→edit_image→edit_image→edit_image · judge: Five readable blue-and-white slides were delivered, but slide 4 repeats the first tip instead of saying 'Set a timer'.
- **H41b** Service Ad Without Source Assets · 52 · major-fault, not-usable
  asked: "Make an 8-second 16:9 ad for ClearDay, a made-up app that turns a messy to-do list into a simple daily plan. I don't have screenshots or a l" → create_video_from_text · judge: The ad clearly turns scattered tasks into a calm blue-and-white daily plan and ends on ClearDay, but unwanted speech violates the silence requirement.
- **H43a** Casual Talking Camera Testimonial · 52 · text-wrong, major-fault, not-usable
  asked: "Make an 8-second vertical testimonial-style ad for FitTrack. A fictional woman in her 30s, filming herself at home, talks to camera: “FitTra" → create_video_from_text→add_subtitles_to_video · judge: The clip delivers a convincing casual home testimonial with a clearly fictional presenter, but the visible captions omit the end of the first sentence.
- **J52b** Bottle Cleanup and Mountain Scene · 52 · major-fault, not-usable
  asked: "Can you do two square pictures? First, edit this bottle photo so the wooden table and background are gone, replaced with plain white. Keep t" → edit_image→edit_image · judge: Two clean square images deliver the requested settings, but the white-background edit changes the bottle's finish rather than preserving it unchanged.
- **H40b** Candle Ad Without Photos · 53 · major-fault, not-usable
  asked: "I don't have a photo. Make a 15-second 9:16 ad for a candle: clear straight-sided glass jar, ivory wax, one wick, no label. Warm evening lig" → create_video_from_text · judge: The 15-second vertical ad presents a consistent, warmly lit candle with both requested text lines, but unwanted speech makes the audio unsuitable.
- **D20b** Café Reel With Matching Captions · 58 · text-wrong, major-fault, not-usable
  asked: "Make these into a 10-second vertical café reel with mellow music. Keep this order and put one caption on each photo: 'Come on in', 'Coffee f" → create_video_from_text · judge: The 10.1-second vertical reel has large, readable captions in the sampled frames, but includes unrelated speech and does not demonstrate the required pastry caption.
- **D22c** Keep My Robot Recognizable · 58 · major-fault, not-usable
  asked: "Draw a square cartoon of a little yellow robot with one big round eye and purple boots, holding a red watering can beside a pot of seedlings" → generate_image | create_video_from_image · judge: The cartoon robot visibly tips its red can and waters the plants, but the malformed boots and pot–leg overlap need correction.
