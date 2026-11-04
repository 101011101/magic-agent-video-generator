# Bench v1 · real-1

152 items · 47 pass (31%) · mean score 58/100 · something made in 139 · 9314 credits · 86 min of item time

| Group | Items | Made | Pass | Mean score | Credits |
|---|---|---|---|---|---|
| A. Single images | 24 | 24 | 13 (54%) | 72 | 130 |
| B. Image edits | 26 | 26 | 13 (50%) | 71 | 120 |
| C. Faces and characters | 12 | 9 | 6 (50%) | 70 | 1234 |
| D. Short video | 18 | 18 | 1 (6%) | 45 | 2091 |
| E. Editing the user's video | 18 | 16 | 4 (22%) | 44 | 370 |
| F. Sound | 7 | 6 | 0 (0%) | 43 | 80 |
| G. Composed pieces | 16 | 16 | 0 (0%) | 39 | 620 |
| H. Ads and reels | 13 | 12 | 2 (15%) | 51 | 3548 |
| J. Conversation | 18 | 12 | 8 (44%) | 64 | 1121 |

Conversation: asked when it had to 7/7 · asked nothing when it need not 140/143 · stopped asking within 3 rounds 0/0 · refused when it should 5/5 · did not refuse wrongly 0/0 · said when beyond the free tier 2/2 · reply right where the answer is words 11/11

## Why items fail

- not-usable: 99
- major-fault: 96
- must-have-missed: 81
- text-wrong: 18
- wrong-aspect: 12
- wrong-length: 8
- too-few-outputs: 3
- asked-unneeded: 3
- not-made:failed: 2
- not-wired:video-edit: 2
- step-failed:captions: 1
- not-made:not-wired: 1
- step-failed:assemble: 1

## Tools

| Tool | Planned | Made | Failed | Placeholder (not wired) | Credits |
|---|---|---|---|---|---|
| text-overlay | 89 | 89 | 0 | 0 | 0 |
| image | 74 | 74 | 0 | 0 | 370 |
| image-edit | 46 | 46 | 0 | 0 | 230 |
| crop | 42 | 42 | 0 | 0 | 0 |
| image-to-video | 39 | 39 | 0 | 0 | 5016 |
| assemble | 27 | 26 | 1 | 0 | 0 |
| music | 18 | 18 | 0 | 0 | 320 |
| write | 10 | 10 | 0 | 0 | 0 |
| voice | 10 | 10 | 0 | 0 | 0 |
| text-to-video | 9 | 9 | 0 | 0 | 1488 |
| captions | 7 | 6 | 1 | 0 | 325 |
| check | 6 | 6 | 0 | 0 | 0 |
| place | 6 | 6 | 0 | 0 | 0 |
| trim | 4 | 4 | 0 | 0 | 0 |
| frame | 4 | 4 | 0 | 0 | 0 |
| background-remove | 3 | 3 | 0 | 0 | 15 |
| face-swap-video | 3 | 3 | 0 | 0 | 735 |
| talking-photo | 3 | 3 | 0 | 0 | 770 |
| face-swap-photo | 2 | 2 | 0 | 0 | 20 |
| video-edit | 2 | 0 | 0 | 2 | 0 |
| upscale-image | 1 | 1 | 0 | 0 | 25 |

Step errors:
- assemble ×1: assemble needs at least one picture or clip
- captions ×1: Magic Hour POST /v1/auto-subtitle-generator → HTTP 422: {"code":"unprocessable_entity","me

## Below the mean (58)

- **E24c** Silent Clip Subtitle Check · 0 · asked-unneeded, step-failed:captions, not-made:failed
  asked: "Can you subtitle this clip? If there's no speech in the audio, just tell me." → captions · reply: The agent avoided fabricating speech or presenting an output but failed to clearly state that the clip has no audible speech.
- **E26b** Cut Out the Boring Parts · 0 · not-wired:video-edit, not-made:not-wired
  asked: "Cut the boring parts out of this. Just a quick 8-second version." → video-edit
- **F32a** Twenty Second Podcast Intro · 0 · step-failed:assemble, not-made:failed
  asked: "Make a 20-second audio intro for my podcast, Small Wonders. A warm female voice should say: “Welcome to Small Wonders, the show about big id" → write→voice→music→assemble
- **J50c** Like Before but Blue · 14 · wrong-aspect, must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make a 4:5 poster with a burnt-orange background, cream lettering and a simple cream crescent moon. Text: 'NIGHT MARKET' and 'SATURDAY 6–10 " → image→text-overlay→crop | image-edit · judge: The navy poster has severely cropped oversized text, a gray crescent, and the wrong aspect ratio, making it unusable.
- **G35a** Kitchen Renovation Side by Side · 17 · must-have-missed, major-fault, not-usable
  asked: "Put these kitchen photos side by side in one landscape 16:9 image. Old kitchen on the left, renovated one on the right, labeled “Before” and" → place→text-overlay→text-overlay · judge: The result is an old-kitchen background with a tiny renovated-kitchen inset and overlapping labels, rather than the requested clean 16:9 side-by-side comparison.
- **E28c** Fit Narration To Seven Seconds · 18 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Replace all the sound with a calm English narrator saying: “Above the clouds, every second counts. Stay focused, trust your training, and br" → write→voice→assemble · judge: The seven-second output replaces the requested narration with unrelated dialogue, changes the framing to portrait, and includes forbidden captions.
- **G37b** Rescheduled Event Across All Formats · 18 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make a matching 4:5 poster, vertical story image and 10-second vertical reel for Rooftop Jazz. Put these details on each: 17 October 2027 / " → image→text-overlay→crop→image-to-video→image-to-video→assemble→text-overlay | text-overlay→crop→text-overlay · judge: The pack retains a cream-and-burgundy jazz aesthetic but prints editing instructions instead of event details, leaves the old date visible and delivers a wrongly cropped poster.
- **D22b** Animate the Lighthouse Just Made · 20 · wrong-aspect, must-have-missed, major-fault, not-usable
  asked: "Make me a wide watercolor picture of a red-and-white striped lighthouse on a rocky coast at dusk. No writing." → image | image-to-video · judge: The clip shows a stable striped lighthouse at dusk with moving waves, but lacks the watercolor appearance and visible sweeping beam and includes unwanted speech.
- **A05d** Choose The Right Headshot Subject · 23 · must-have-missed, major-fault, not-usable
  asked: "Can you make me a square professional headshot from this?" → crop · judge: The output is a square crop of both friends at the beach, not the requested professional portrait of the woman alone.
- **E27b** Choose Music That Fits · 23 · must-have-missed, major-fault, not-usable
  asked: "Can you put some music on this? Just something that fits. Leave the clip and conversation as they are." → music→assemble · judge: The output is a roughly 10-second office video, but an unrequested portrait crop substantially changes the original framing.
- **E27c** Music Beneath the Radio Calls · 23 · must-have-missed, major-fault, not-usable
  asked: "Add a tense instrumental bed to this. Keep it under the radio calls so every word is easy to hear, especially 'Rook, you with me?' Don't cha" → music→assemble · judge: The seven-second output includes the transcribed key radio line but visibly reframes the footage and adds subtitles, while the music and its balance cannot be verified.
- **E29b** Append a Clean End Card · 23 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Keep this whole 7-second clip, then add a 2-second black end card with white text: 'Ready for takeoff?' and '@flightschool' underneath. Cent" → image→text-overlay→assemble · judge: The nine-second output includes cockpit footage and a black end card, but the card appears too early and its oversized text is severely cropped.
- **J49b** Bigger Headline Same Poster · 24 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make a square poster: a little illustrated coffee cup in the bottom half, cream background, dark brown headline 'SLOW SUNDAY' centred near t" → image→text-overlay | text-overlay · judge: The square poster is unusable because oversized white instructions replace the headline and a grey overlay obscures the cream background and cup.
- **J51b** Resize Finished Clip Without Remaking · 25 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make an 8-second widescreen cartoon of a little orange robot watering a potted plant. Put 'Small steps' at the top throughout. No sound." → text-to-video→text-overlay | crop · judge: The eight-second portrait output crops the picture and title instead of fitting the full widescreen clip within navy padding, and the audio report indicates it is not silent.
- **A03d** Long Venue Address Preserved Exactly · 27 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Please make a clean black-and-cream 4:5 flyer. Text: "Printmakers' Open Studio", "9 October 2027", "11:00–17:00", and "Unit 14B, Second Floo" → image→text-overlay→crop · judge: The portrait flyer has the correct date and time, but its headline is incomplete and a substantial portion of the required address is missing.
- **J50b** Change Only the Ending · 27 · not-wired:video-edit, wrong-aspect, wrong-length, must-have-missed, major-fault, not-usable
  asked: "Make an 8-second widescreen animation, no sound or text. A white paper plane glides through a sunny study for five seconds, then lands on a " → text-to-video | trim→trim→video-edit→assemble · judge: The clip shows a white paper plane reaching a notebook in a sunny study, but it is a five-second portrait video with speech instead of the required silent eight-second widescreen edit.
- **B09a** Bottle on a Kitchen Counter · 28 · must-have-missed, major-fault, not-usable
  asked: "Put this bottle on a light stone kitchen counter, with a tidy modern kitchen behind it. Keep the bottle exactly as it is. Square photo, no t" → background-remove→image→place · judge: The square image shows a tidy modern kitchen and light stone counter, but the bottle is a tiny floating object in the upper-right corner.
- **G35b** Imagine My Kitchen Renovation · 28 · must-have-missed, major-fault, not-usable
  asked: "Can you show how my kitchen could look renovated? Make one 16:9 before-and-after image, original on the left and your realistic makeover on " → image-edit→place→text-overlay→text-overlay · judge: The output leaves the original kitchen full-size with a tiny renovation inset and overlapping labels instead of delivering the requested 16:9 side-by-side comparison.
- **D20d** Mixed Sizes Without Cropping · 30 · must-have-missed, major-fault, not-usable
  asked: "These photos are all different shapes. Make one 10-second vertical reel, in this order. Keep each whole photo visible—don't stretch or crop " → assemble · judge: The 10-second vertical reel has no visible added text, but it crops the photos to fill the frame instead of preserving them over blurred backgrounds.
- **E29c** Subtle Handle Watermark Throughout · 30 · must-have-missed, major-fault, not-usable
  asked: "Add @flightschool as a subtle watermark at the bottom right for this whole clip. Small white text, slightly see-through, with a faint shadow" → text-overlay · judge: The handle is spelled correctly, but oversized lower-center lettering and a large dark backing panel defeat the requested subtle bottom-right watermark.
- **F30a** Warm Lo-Fi Music Bed · 30 · wrong-length, must-have-missed, major-fault, not-usable
  asked: "Make me a 10-second lo-fi hip-hop music bed, warm and relaxed. No vocals." → music · judge: An audio file was delivered, but it is 15 seconds long and contains a spoken word despite the request for a 10-second instrumental bed.
- **G34b** Five Tips Five Separate Slides · 31 · wrong-aspect, must-have-missed, text-wrong, major-fault, not-usable
  asked: "Need a 4:5 Instagram carousel: five focus tips, one per slide. Use these in order: 'Clear your desk', 'Silence notifications', 'Pick one tas" → image→text-overlay→crop→image→text-overlay→crop→image→text-overlay→crop→image→text-overlay→crop→image→text-overlay→crop · judge: Five portrait slides contain relevant illustrations, but severe heading and number cropping and the wrong color palette make the carousel unsuitable to post.
- **G36b** Readable Sale Copy Every Size · 31 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "I need matching plant-shop ads in 1:1, 9:16 and 16:9. Include exactly: “Fern House”, “Weekend Plant Sale”, “20% off all indoor plants”, “Sat" → image→crop→crop→text-overlay→text-overlay→text-overlay · judge: The square and portrait ads are readable and visually matched, but the landscape version is severely cropped and loses essential text.
- **H41b** Service Ad Without Source Assets · 31 · wrong-aspect, must-have-missed, major-fault, not-usable
  asked: "Make an 8-second 16:9 ad for ClearDay, a made-up app that turns a messy to-do list into a simple daily plan. I don't have screenshots or a l" → image→image-edit→image-to-video→text-overlay · judge: The blue-and-white demo ends with a readable ClearDay title, but its garbled interface and shifting cards do not demonstrate a clear daily plan.
- **D23b** Gardener Interview Name Caption · 32 · must-have-missed, major-fault, not-usable
  asked: "Make a silent 7-second widescreen clip of a fictional woman standing in a community garden, smiling and turning slightly toward the camera. " → text-to-video→text-overlay · judge: The garden scene and wording are correct, but an oversized centered caption obscures the woman's face and the clip contains unwanted speech.
- **E28a** Add My Supplied Voiceover · 32 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Add a warm, clear English voice-over to this silent clip, saying exactly: “Make mornings easier: prepare your clothes, pack your bag, and pl" → write→voice→assemble · judge: The output is a video with audible narration, but it omits the script’s opening phrase and changes the original landscape framing to a tight portrait crop.
- **H44c** Rooftop Jazz in Two Formats · 32 · must-have-missed, major-fault, not-usable
  asked: "I need the same 10-second Rooftop Jazz promo in 9:16 for Stories and 16:9 for a venue screen. Sunset rooftop, musicians playing, mellow jazz" → image→image-to-video→image-edit→image-to-video→music→assemble→text-overlay→crop · judge: Two sunset rooftop promos were delivered, but the portrait version crops essential text and musicians and has reported speech in its soundtrack.
- **B07d** Change Only the Bottle · 33 · must-have-missed, major-fault, not-usable
  asked: "Turn just the black bottle forest green, still matte. Everything outside the bottle must stay exactly the same, including the table and shad" → image-edit · judge: The recolor preserves the bottle's matte appearance and geometry, but the green is too bright and spills into the handle opening.
- **D22a** Make a Cat Then Animate · 33 · too-few-outputs, must-have-missed, major-fault, not-usable
  asked: "Make a square illustration of an orange cat wearing a blue scarf on a sunny windowsill, then animate that picture for 5 seconds: the cat bli" → image→image-to-video · judge: The square cat animation shows the requested sunny setting, blinking and tail movement, but a standalone picture is missing and the video is not silent.
- **E27a** Warm Music for Morning Tips · 33 · asked-unneeded, must-have-missed, major-fault, not-usable
  asked: "Add some warm, hopeful music to this clip, nothing too energetic. Keep the whole video and my voice." → music→assemble · judge: The output retains the 10-second spoken introduction but unnecessarily crops the landscape video into portrait format, and the music cannot be assessed from the supplied transcript.
- **G33b** Morning Video Frame Thumbnail · 33 · must-have-missed, major-fault, not-usable
  asked: "Use a clear frame from my video to make a 16:9 YouTube thumbnail. Keep me recognisable and add “MORNINGS MADE EASY” in big letters beside my" → frame→crop→text-overlay · judge: The thumbnail retains the woman and displays the correct headline, but the oversized central text and dark panel obscure her face instead of sitting beside it.
- **A02b** Write the Cleanup Headline · 34 · must-have-missed, major-fault, not-usable
  asked: "Make a square social graphic encouraging people to help clean up their local beach. Friendly illustrated seaside scene, with a short catchy " → image→write→text-overlay · judge: A square illustrated beach-cleanup scene was delivered, but a huge overlay of production instructions replaces the requested catchy headline and makes it unusable.
- **E24b** Spanish Subtitles For This Clip · 34 · must-have-missed, major-fault, not-usable
  asked: "Add Spanish subtitles to this English clip, please. Leave her voice in English and keep the whole video as it is." → captions · judge: The clip preserves the kitchen footage and English speech, but adds English captions instead of the requested Spanish subtitles.
- **G34c** One Print Style Across Plants · 34 · must-have-missed, major-fault, not-usable
  asked: "Make four square Instagram carousel slides: Monstera, Snake plant, Pothos, Peace lily, in that order. One plant and its name per slide. Keep" → image→text-overlay→image→text-overlay→image→text-overlay→image→text-overlay · judge: The four correctly labeled, recognizable plants arrive as separate square slides, but the photographic treatment misses the requested linocut design and fixed template.
- **G38a** Three Matching Mug Listing Photos · 34 · too-few-outputs, must-have-missed, major-fault, not-usable
  asked: "Make three square listing photos for a plain sage-green ceramic mug: one on pure white, one on a cosy breakfast table, and one close-up of t" → image→image-edit→image-edit · judge: Two realistic square mug photos cover the breakfast and white-background settings, but the close-up is missing and the glaze is inconsistent.
- **J52b** Bottle Cleanup and Mountain Scene · 34 · must-have-missed, major-fault, not-usable
  asked: "Can you do two square pictures? First, edit this bottle photo so the wooden table and background are gone, replaced with plain white. Keep t" → background-remove→image→place→image→place · judge: Two square images were supplied, but the source bottle is tiny in both and floats above a lake scene containing the wrong bottle on the rock.
- **A06c** Transparent Moon Bakery Logo · 36 · must-have-missed, major-fault, not-usable
  asked: "Make a square logo for my bakery, Mooncrumb: a gold crescent moon above dark navy lettering. Send it as a transparent PNG so I can put it on" → image→text-overlay · judge: The square logo has the correct name and a gold crescent above it, but uses white lettering on a gray box with visible background areas rather than the requested transparent treatment.
- **C15c** Two Coworkers Two Replacement Faces · 37 · must-have-missed, major-fault, not-usable
  asked: "Swap both faces in this 10-second office clip: the man's face from the man's portrait, and the woman's from the woman's portrait. Keep their" → face-swap-video→face-swap-video · judge: The output retains a roughly ten-second office scene but uses the wrong replacement identities and also changes the center coworker's face.
- **D18c** Lake Clouds and Water Moving · 37 · must-have-missed, major-fault, not-usable
  asked: "Turn this lake photo into an 8-second silent video. Let the clouds drift slowly and little ripples move across the water. Keep the mountains" → image-to-video · judge: The lake scene has moving clouds and gentle ripples with stable terrain, but unwanted speech, changing evening light, and overly rapid cloud evolution require a redo.
- **D22c** Keep My Robot Recognizable · 37 · must-have-missed, major-fault, not-usable
  asked: "Draw a square cartoon of a little yellow robot with one big round eye and purple boots, holding a red watering can beside a pot of seedlings" → image | image-to-video · judge: The robot visibly waters the seedlings, but the clip includes unwanted speech and uses glossy 3D rendering instead of the requested drawing style.
- **D23c** Coffee Clip Exact URL Ending · 37 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make a silent 8-second vertical coffee clip: a close-up of coffee being poured into a ceramic cup for 5 seconds, then a plain black end card" → image→image-to-video→image→assemble→text-overlay · judge: The vertical coffee pour and black end card are present, but the URL is severely cropped and unwanted audio violates the silence requirement.
- **E25b** Portrait Cut for Two Speakers · 37 · must-have-missed, major-fault, not-usable
  asked: "Turn this into a 9:16 vertical clip. Show the man when he asks his question, then the woman when she answers, with each centred while talkin" → crop · judge: The clip is portrait and caption-free, but its crop favours the central man instead of framing the questioner and then the woman.
- **F32b** Tiny Forests Two Host Segment · 37 · must-have-missed, major-fault, not-usable
  asked: "Turn this article into a roughly 90-second podcast chat between two hosts. Use two clearly different English voices, one male and one female" → write→voice · judge: The 105-second audio has a promising conversational opening, but the supplied speech ends mid-name before a complete discussion is demonstrated.
- **B07a** Repaint Only the Car · 38 · must-have-missed, major-fault, not-usable
  asked: "Can you make the red car navy blue? Leave the rest of the photo alone." → image-edit · judge: The car is convincingly recolored with the scene preserved, but the paint is too bright for navy and the rear light has also changed.
- **G33a** Shocked Face Gaming Thumbnail · 38 · wrong-aspect, must-have-missed, major-fault, not-usable
  asked: "Make me a 16:9 YouTube thumbnail for a gaming challenge. Big shocked face on the right, the three words “ONE LAST TRY” on the left. Invent t" → image→text-overlay · judge: The thumbnail has a vivid shocked face and correct wording, but the headline overlaps the face and the canvas is not 16:9.
- **B12d** Left Edge Sneaker Stays Visible · 39 · must-have-missed, major-fault, not-usable
  asked: "Make this square for my shop. The shoe's way over on the left, so don't just crop the middle. Keep the whole shoe; plain padding to match th" → crop · judge: The output is square but shows an enlarged, cropped portion of the sneaker with the heel missing.
- **C14b** Which Friend Gets My Face · 39 · must-have-missed, major-fault, not-usable
  asked: "Can you put my face from the park selfie onto someone in this beach photo? Just swap one face and leave everything else alone." → face-swap-photo · judge: The right woman's face is blended into the beach photo, but the man's face was also visibly replaced, violating the central instruction to change only one face.
- **C16c** Invent A Courier Then Reuse · 39 · too-few-outputs, must-have-missed, major-fault, not-usable
  asked: "Draw a square storybook picture of a little robot courier at a train station. She has a round teal body, one large amber eye, short red boot" → image | image-edit→image-edit · judge: The two attractive square storybook scenes depict the requested situations, but the cottage robot lacks her yellow mailbag and the original station picture is unavailable for comparison.
- **G36a** One Coffee Ad Three Shapes · 39 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make a coffee ad in three sizes: square 1:1, vertical 9:16 and wide 16:9. Use a steaming coffee cup, cream and dark green colours, and these" → image→text-overlay→crop→crop · judge: Three visually consistent coffee ads are supplied, but the vertical version severely clips required copy and the layouts are cropped rather than thoughtfully rearranged.
- **H40a** Black Bottle Product Reel · 40 · must-have-missed, major-fault, not-usable
  asked: "Make a 15-second vertical 9:16 ad for the bottle in my photo. Clean studio look, a few moving close-ups, mellow music, no talking. Start wit" → image-edit→image-to-video→image-to-video→image-to-video→music→assemble→text-overlay→text-overlay · judge: The 15-second vertical studio ad includes both requested captions, but unwanted speech and changes to the bottle’s lid and finish require a redo.
- **H41a** FitTrack Ad From Supplied Screenshots · 40 · must-have-missed, major-fault, not-usable
  asked: "Make a 10-second widescreen 16:9 ad for FitTrack using both screenshots. Show the home screen first, then the workout screen, and finish wit" → music→assemble→text-overlay · judge: The 10-second widescreen ad shows the screens in order and ends with FitTrack, but severe cropping and audible vocals require a redo.
- **A06b** Exact Spelling For Repair Logo · 41 · must-have-missed, major-fault, not-usable
  asked: "I need a square logo for my repair shop. The name is KwickFixx — please spell it exactly like that, with capital K and F and two x's. Small " → image→text-overlay · judge: The square logo has the correctly spelled name and a small orange wrench, but uses white lettering on a gray panel rather than black lettering on white.
- **B08c** Clean Up This Kitchen · 41 · must-have-missed, major-fault, not-usable
  asked: "Can you clean this up?" → image-edit · judge: The counters are substantially tidier and the original finishes are preserved, but the right-hand sink faucet was mistakenly erased.
- **E28b** Write Narration From The Clip · 41 · must-have-missed, major-fault, not-usable
  asked: "Watch this and write a short English voice-over explaining what's happening. Replace the original conversation with your narration, friendly" → frame→check→frame→check→frame→check→write→voice→assemble · judge: The 10-second output conveys the schedule change, but its severe portrait crop violates the requirement to leave the footage unchanged.
- **F30c** Exactly Fifteen Seconds of Music · 41 · must-have-missed, major-fault, not-usable
  asked: "I need a music bed that's exactly 15 seconds, no vocals. Style is up to you." → music · judge: A single 15-second audio file is supplied, but reported spoken words violate the no-vocals requirement.
- **G33c** Choose My Thumbnail Headline · 41 · wrong-aspect, must-have-missed, major-fault, not-usable
  asked: "Make a 16:9 YouTube thumbnail for my video about quitting late-night scrolling and sleeping better. Invent a tired-looking person for it and" → image→text-overlay · judge: The thumbnail has a convincing tired face and a readable, relevant three-word headline, but the text obscures the face and the canvas is not 16:9.
- **D20a** Five Café Photos With Music · 42 · must-have-missed, major-fault, not-usable
  asked: "Make a 10-second vertical Instagram reel from these five café photos, in the order attached. Add some relaxed instrumental music. No text, j" → music→assemble · judge: The output is a 10-second vertical café reel, but its soundtrack includes unwanted speech and the sampled frames do not verify the complete five-photo sequence.
- **D21a** Quiet Lake Website Loop · 42 · wrong-aspect, must-have-missed, major-fault, not-usable
  asked: "Make a 6-second seamless loop for my website background: a calm mountain lake at dusk, with gentle ripples. Wide 16:9, camera staying still," → image→image-to-video · judge: The clip presents a calm dusk mountain lake with subtle ripples, but unwanted speech, incorrect duration and non-16:9 framing require fixes.
- **E24d** Make Those Captions TikTok Bold · 42 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Add English subtitles to this clip. Keep her original voice." → captions | crop→captions · judge: The output is a face-preserving vertical clip with large captions, but weak contrast and insufficient right-side clearance need fixing before posting.
- **H44b** Countdown Into Neon Night · 42 · must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make an 8-second vertical ad for Neon Night, 12 September 2026 at The Foundry, Leeds. Start with a big 3, 2, 1 countdown, building electroni" → image→image-to-video→image-to-video→music→assemble→text-overlay→text-overlay→text-overlay→text-overlay · judge: The vertical ad presents correct, readable event details for an extended hold, but the countdown lacks scale and reported speech violates the brief.
- **J49c** Shorter Clip Same Opening · 42 · must-have-missed, major-fault, not-usable
  asked: "Make an 8-second widescreen video of a paper boat drifting slowly across a pond, fixed camera, soft morning light. Silent, no text." → text-to-video | trim · judge: The five-second widescreen clip shows a paper boat drifting across a softly lit pond, but reported speech violates the silence requirement.
- **A05b** Make My Photo Look Professional · 43 · must-have-missed, major-fault, not-usable
  asked: "Make me look professional in this photo." → image-edit · judge: The man remains recognizable and wears a convincing blazer and collared shirt, but the unchanged kitchen background prevents this from being a finished professional portrait.
- **J50a** Make the First One Square · 43 · must-have-missed, major-fault, not-usable
  asked: "Make two tall 4:5 illustrations, no text. First: a fox sleeping under a crescent moon. Second: a lighthouse in a storm. Both soft watercolou" → image→crop→image→crop | crop · judge: The output is a square, text-free sleeping-fox scene, but the tight crop cuts off both the fox and crescent moon.
- **J52a** Night Market Poster and Reel · 43 · wrong-aspect, must-have-missed, major-fault, not-usable
  asked: "Make a vertical poster and a matching 8-second reel for our night market. Both should say: “Night Market”, “Saturday 12 July”, “6–10 pm”, “R" → image→text-overlay→image-to-video→text-overlay · judge: The matching illustrated poster and animated reel keep all five event details clear, but the reel has audio and neither displayed asset meets the required 9:16 proportions.
- **C15a** Five Second Talking Face Swap · 44 · wrong-length, must-have-missed, major-fault, not-usable
  asked: "Put the face from this portrait onto the woman in the first 5 seconds of the video. Keep the original sound, framing and everything else." → face-swap-video · judge: The face swap looks consistent in the supplied frames and preserves the kitchen composition, but the video runs twice the required length.
- **D18a** Bottle Turns Slowly in Place · 44 · must-have-missed, major-fault, not-usable
  asked: "Animate this bottle turning slowly in place on the table, just a gentle quarter turn. Keep the camera still. Make it 6 seconds, square, no s" → image-to-video · judge: The recognizable black bottle turns slowly in a stable square shot, but added branding, slight shape drift, and unwanted audio require correction.
- **D23a** Mountain Morning Opening Title · 44 · must-have-missed, major-fault, not-usable
  asked: "Make a silent 6-second widescreen clip. Start with a dark green title card saying exactly “A quieter kind of morning” in cream lettering for" → image→image→image-to-video→assemble→text-overlay · judge: The clip has the correct legible title and an attractive moving sunrise lake scene, but unwanted speech and a blank green interval require correction.
- **F31a** Calm Voice Reading Supplied Script · 44 · wrong-length, must-have-missed, major-fault, not-usable
  asked: "Make an audio-only voice-over, about 10 seconds, in a calm, reassuring voice. Read exactly: “Take a slow breath. Let your shoulders relax. T" → voice · judge: The WAV contains the exact requested script, but its 7-second duration falls short of the requested approximately 10 seconds.
- **G39a** Shocked Cat Weekend Meme · 44 · must-have-missed, major-fault, not-usable
  asked: "Make a square meme with this cat photo. Top text: "WHEN YOU THINK IT'S FRIDAY" Bottom text: "BUT IT'S ONLY TUESDAY". Big white letters with " → crop→text-overlay→text-overlay · judge: The square meme preserves the photo and exact captions, but substitutes dark panels for black outlines and partially shades the cat's eyes.
- **H41c** Exact Copy App Ad · 44 · must-have-missed, major-fault, not-usable
  asked: "Create a silent 9-second 16:9 ad for my fictional planning app DayNest. Three equal-length scenes with these exact lines, one per scene in t" → image→image-to-video→image→image-to-video→image→image-to-video→assemble→text-overlay→text-overlay→text-overlay · judge: The ad presents all three lines correctly with cream-and-green calendar and checkmark graphics, but extra calendar text and non-silent audio require fixes.
- **H42a** Café Reel From Owner Photos · 45 · must-have-missed, major-fault, not-usable
  asked: "These are photos of my café. Make a cosy 9-second vertical Instagram reel using all three, storefront first. Gentle movement, soft upbeat mu" → image-to-video→image-to-video→image-to-video→music→assemble→text-overlay→text-overlay · judge: The nine-second vertical reel uses all three café photos in the requested order with correct titles, but unwanted speech requires an audio redo.
- **D19a** Dog Catches a Flying Frisbee · 46 · must-have-missed, major-fault, not-usable
  asked: "Make a realistic 5-second widescreen video of a golden retriever catching a red frisbee in a grassy park. One continuous shot with the camer" → text-to-video · judge: A realistic golden retriever runs through a grassy park and ends holding a red frisbee, but the clip has unwanted audio and the sampled frames do not establish the frisbee's approach or catch.
- **G38b** Bottle Listing From One Photo · 46 · must-have-missed, major-fault, not-usable
  asked: "This is my only product photo. Turn it into three separate square listing images: a clean white-background shot, a lifestyle shot on a gym b" → image-edit→image-edit→crop · judge: Three separate square images were delivered, but the detail shot is unchanged from the original and the white-background bottle looks too glossy.
- **H40c** Sneaker Captions Stay Safely Inside · 46 · must-have-missed, major-fault, not-usable
  asked: "Make a silent 15-second 9:16 sneaker ad. No photo—use a plain white leather low-top with white laces and a white sole, no logo. Three moving" → image→image-edit→image-edit→image-to-video→image-to-video→image-to-video→assemble→text-overlay→text-overlay→text-overlay · judge: The ad shows the requested white sneaker and correct captions, but the opening caption violates the explicitly required horizontal safe area.
- **A06d** Three Distinct Cycling Logo Options · 47 · major-fault, not-usable
  asked: "Give me three different logo options for my cycling club, Moss & Mile. Simple green and black on white, each with the name and a small symbo" → image→text-overlay→image→text-overlay→image→text-overlay · judge: Three separate logos have correctly spelled names and genuinely different symbols, but cream backgrounds, gray caption panels, and disconnected layouts require a redo.
- **B12a** Square Crop Keeps Whole Sneaker · 47 · major-fault, not-usable
  asked: "Make this wide photo square for an Instagram post. Keep the whole sneaker in view, and don't stretch it or change anything else." → crop · judge: The image is square and preserves the original photo's appearance, but crops off both ends of the sneaker.
- **B12b** Portrait Photo Into Story Frame · 47 · major-fault, not-usable
  asked: "Can you make this fit a 9:16 Instagram story? Keep all my hair and shoulders—use a blurred copy of the photo behind it if needed. No text." → crop · judge: The portrait fits a 9:16 frame but loses substantial shoulder area and some hair through a tight crop.
- **C17a** Photo Speaks My Short Script · 47 · wrong-length, must-have-missed, major-fault, not-usable
  asked: "Make this photo of me talk in an 8-second square video. Say exactly: “Hi everyone! Thanks for stopping by. I can't wait to show you what's n" → write→voice→talking-photo · judge: The square video preserves the woman and includes the complete script with visible mouth animation and no captions, but it is only 4.8 seconds instead of 8.
- **C17b** Write My Talking Sale Pitch · 47 · wrong-length, must-have-missed, major-fault, not-usable
  asked: "Make this photo of me say something about our sale. You write the line—keep it upbeat and don't invent discounts, dates or products. An 8-se" → write→voice→talking-photo · judge: The square talking portrait preserves the man's appearance and delivers a suitable sale invitation, but it is only 4.2 seconds instead of 8 seconds.
- **D19c** Hands Fold a Paper Sheet · 47 · major-fault, not-usable
  asked: "Make an 8-second realistic widescreen video looking down at a person's hands folding a plain blue sheet of paper in half on a wooden table, " → text-to-video · judge: The clip shows realistic overhead paper handling and crease pressing, but the folding result is wrong and unwanted speech breaks the silence requirement.
- **H43a** Casual Talking Camera Testimonial · 47 · wrong-aspect, must-have-missed, text-wrong, major-fault, not-usable
  asked: "Make an 8-second vertical testimonial-style ad for FitTrack. A fictional woman in her 30s, filming herself at home, talks to camera: “FitTra" → image→write→voice→talking-photo→captions · judge: A friendly vertical home testimonial includes the complete spoken script and visible speaking motion, but the captions get the brand name wrong.
- **A06a** Simple Sprout Shop Logo · 48 · must-have-missed, major-fault, not-usable
  asked: "Make a square logo for my plant shop, Little Sprout. Just a simple green sprout above the name on white, nothing fancy." → image→text-overlay · judge: The square logo has a clear green sprout and correctly spelled name, but the gray text panel departs from the requested simple design on white.
- **B11a** Quiet Caption Over The Lake · 48 · must-have-missed, major-fault, not-usable
  asked: "Put “A little room to breathe” over this photo, near the bottom in clean white lettering. Keep the whole wide photo, just add the caption." → text-overlay · judge: The wording is correct and the full photo is preserved, but oversized text and a large dark panel overwhelm the scene instead of providing a clean bottom caption.
- **B12c** One Car Photo Three Sizes · 48 · major-fault, not-usable
  asked: "I need this car photo in three sizes: square, 4:5 for the feed, and 9:16 for stories. Send three separate pictures. Keep the whole car in ea" → crop→crop→crop · judge: Three separate, correctly proportioned frames were delivered, but the feed and stories crops fail to keep the complete car visible.
- **D18b** Portrait With Subtle Natural Motion · 49 · must-have-missed, major-fault, not-usable
  asked: "Make this photo feel alive for 5 seconds: a natural blink and tiny breathing movement, nothing dramatic. Keep her face looking exactly like " → image-to-video · judge: The portrait stays visually consistent with restrained movement, but unwanted speech violates the silence requirement and the sampled frames do not verify a natural blink.
- **H42b** Gym Promo With Visit Details · 49 · must-have-missed, major-fault, not-usable
  asked: "Make a 10-second vertical promo for Northside Gym. Use a welcoming gym scene, not hardcore bodybuilding, with upbeat music and no voiceover." → image→image-to-video→image→image-to-video→music→assemble→text-overlay · judge: The vertical gym promo looks welcoming and displays readable, accurate details, but unwanted speech requires an audio redo.
- **D21b** Soft Glowing Phone Wallpaper · 50 · wrong-aspect, major-fault, not-usable
  asked: "Make me an 8-second looping video wallpaper for my phone, 9:16. Soft blue and purple glowing ribbons moving slowly on a dark background. Lea" → image→image-to-video · judge: The wallpaper visually matches the requested glowing ribbons and dark clock area, but reported speech violates the silence requirement and the seamless loop cannot be verified.
- **A04a** Watercolour Cottage by a Stream · 52 · major-fault, not-usable
  asked: "Make a square watercolour illustration of a little stone cottage beside a stream, with soft green hills behind it. No text." → image · judge: A square, text-free scene shows a stone cottage beside a stream with green hills behind it, but it looks photographic rather than like a watercolour illustration.
- **B07c** Warmer Colours Only · 52 · major-fault, not-usable
  asked: "Make it warmer—just the colours, please. Don't change anything in the picture." → image-edit · judge: The composition and reflections are preserved, but the extreme orange treatment and darkened shadows need toning down.
- **B11c** Shocked Cat Monday Meme · 52 · major-fault, not-usable
  asked: "Make this a classic meme. Top: WHEN YOU THINK IT'S FRIDAY. Bottom: BUT IT'S ONLY MONDAY. Big white letters with black outlines, keep it squa" → crop→text-overlay→text-overlay · judge: The square meme has the correct captions and original cat, but substitutes dark panels for the requested black letter outlines.
- **D19b** Slow Push Into Forest Cabin · 52 · major-fault, not-usable
  asked: "A realistic little wooden cabin among pine trees at dawn. Make a silent 6-second widescreen video, one shot slowly pushing toward the front " → text-to-video · judge: A convincing dawn cabin shot shows forward movement and strong foreground parallax, but unwanted speech breaks the explicit silence requirement.
- **G34a** Three Slides for Slow Sundays · 52 · major-fault, not-usable
  asked: "Make 3 square Instagram carousel slides that look like a set for a cosy café. Text, in order: 'Slow Sunday', 'Coffee first', 'Stay a little " → image→image-edit→image-edit→text-overlay→text-overlay→text-overlay · judge: Three coordinated square café slides have the correct readable text, but use photographs instead of simple illustrations and leave a visible rectangular editing patch on slide 3.
- **G37a** Night Market Event Pack · 52 · major-fault, not-usable
  asked: "Make a matching event pack: a 4:5 poster, a vertical story image and a 10-second vertical reel. Details on all three: Lantern Night Market /" → image→text-overlay→crop→image-to-video→image-to-video→music→assemble→text-overlay · judge: The pack has coordinated lantern imagery and clear, accurate event text, but the story has the wrong aspect ratio and the reel contains unrelated speech.
- **H40b** Candle Ad Without Photos · 52 · major-fault, not-usable
  asked: "I don't have a photo. Make a 15-second 9:16 ad for a candle: clear straight-sided glass jar, ivory wax, one wick, no label. Warm evening lig" → image→image-edit→image-edit→image-to-video→image-to-video→image-to-video→music→assemble→text-overlay→text-overlay · judge: The 15-second vertical ad delivers the requested candle, warm look and exact text, but unwanted speech makes an audio revision necessary.
- **J51a** Switch to TikTok Before Making · 52 · major-fault, not-usable
  asked: "I want a 6-second widescreen animation of a coffee cup on a rainy windowsill, steam curling up. Cosy illustrated look, no text or sound. Jus" → text-to-video | crop · judge: The vertical animation delivers the cosy illustrated coffee scene with curling steam and rain, but unwanted speech violates the silence requirement.
- **A04d** Cup Left of the Laptop · 53 · wrong-aspect, must-have-missed, not-usable
  asked: "Make a simple wide illustration of a desk viewed from above: an open laptop in the middle, a yellow cup to its left, and a closed blue noteb" → image · judge: The illustration places all three objects correctly with clear separation, but needs a 16:9 frame and removal of keyboard character markings.
- **B09d** Match the Kitchen Window Light · 53 · major-fault, not-usable
  asked: "Move this candle onto a pale kitchen counter with warm sunlight coming from the upper left. Make the light on the glass and the shadow on th" → image-edit→crop · judge: The candle is convincingly placed on a warm, pale kitchen counter, but its cast shadow points in the wrong direction.
- **J55b** Only Background Colour Is Delegated · 53 · major-fault, not-usable
  asked: "Make a square book-swap poster. Black lettering only, no pictures. The text should be exactly 'BOOK SWAP', 'Saturday 10-2' and 'Maple Hall'." → image→text-overlay | image-edit→text-overlay · judge: The square poster contains the exact requested wording and no pictures, but uses white lettering instead of black.
- **F30b** Upbeat Reel Music Default · 56 · wrong-length, major-fault, not-usable
  asked: "Can you make me some music? Something upbeat for a reel." → music · judge: A 30-second MP3 was delivered, but it contains unrelated German speech, and the supplied evidence does not establish the music’s energy or editing quality.
