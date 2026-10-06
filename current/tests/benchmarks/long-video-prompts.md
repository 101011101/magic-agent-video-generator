# Long-Video Prompts

- Purpose: test whether the system holds duration, identity, text and structure at 5–20 min.
- Provenance: all `generated` (drafted for the benchmark).
- Each prompt lists: prompt text as typed, uploads, rigid checks for `checklist_pass`.

| ID | Length | Stresses |
|---|---|---|
| L1 | 5 min | Narration-driven explainer, chapter cards |
| L2 | 5 min | Recurring character, many scenes |
| L3 | 8 min | Two-host talking heads, lip-sync |
| L4 | 10 min | Research documentary, facts |
| L5 | 10 min | Narrative short film, 3 characters |
| L6 | 12 min | Course lesson, on-screen code text |
| L7 | 15 min | Travel vlog from uploaded footage |
| L8 | 20 min | Episodic story, 4 acts, full stress |

- **L1** — 5 min explainer
  - Prompt: "5 minute youtube explainer on how sourdough starter works. 5 chapters with a title card for each: 'What is a starter', 'The microbes', 'Feeding', 'Signs it's ready', 'Common mistakes'. calm voiceover, close up food shots, 16:9"
  - Uploads: none.
  - Checks:
    - Duration 4:30–5:30. 16:9.
    - 5 chapter cards, titles verbatim, in order.
    - Voiceover over the full length. Visuals match the current chapter.

- **L2** — 5 min recurring character
  - Prompt: "5 min animated story for kids. main character is Pip, a small orange fox with a blue scarf and one white ear. Pip loses the scarf in the wind and follows it through the forest, a river, a village and up a mountain, and meets a helper in each place. soft watercolor style, narrator reads it like a bedtime story"
  - Uploads: none.
  - Checks:
    - Duration 4:30–5:30.
    - Pip holds in every shot: orange fur, blue scarf (until lost), one white ear.
    - 4 locations in order. 4 distinct helpers.
    - Watercolor style holds. Narration only, no character dialogue.

- **L3** — 8 min two-host show
  - Prompt: "8 minute podcast style video, two AI hosts at a desk talking about the history of the bicycle. host 1 is a woman in her 30s with curly black hair and a green sweater, host 2 is an older man with a grey beard and glasses. they take turns, react to each other, and show old photos on a screen behind them. lower third with their names: Maya Ortiz and Hal Brenner"
  - Uploads: none.
  - Checks:
    - Duration 7:30–8:30.
    - Both hosts hold identity for the full length. Lip-sync matches the speaker.
    - Lower thirds verbatim: "Maya Ortiz", "Hal Brenner".
    - Same set and camera angles across the episode.

- **L4** — 10 min research documentary
  - Prompt: "10 minute documentary on the Apollo 13 mission. cover launch, the explosion, the fix with the CO2 scrubbers, re-entry. use real dates and names, archival style visuals, serious narrator, no fake quotes"
  - Uploads: none.
  - Checks:
    - Duration 9:00–11:00.
    - Facts correct: launch date 11 April 1970, crew Lovell, Swigert, Haise, oxygen tank failure, splashdown 17 April 1970.
    - No invented quotes. Events in order.
    - Archival look holds.

- **L5** — 10 min narrative short film
  - Prompt: "10 min short film. three siblings meet at their late mother's house to clean it out before it's sold. the oldest wants to sell fast, the middle one wants to keep it, the youngest finds a box of letters that changes everything. dialogue driven, naturalistic, 2.39:1 letterbox, end on the three of them on the porch at sunset"
  - Uploads: none.
  - Checks:
    - Duration 9:00–11:00. 2.39:1 letterbox.
    - 3 siblings hold identity in every scene. Same house interior across scenes.
    - Dialogue lip-synced, voices stay assigned to the same character.
    - Final shot: 3 siblings, porch, sunset.

- **L6** — 12 min course lesson
  - Prompt: "12 minute lesson for beginners: intro to python lists. show the code on screen and explain each line. cover creating a list, indexing, slicing, append, loops over a list, and a small exercise at the end with the answer. friendly instructor voice"
  - Uploads: none.
  - Checks:
    - Duration 11:00–13:00.
    - On-screen code is exact and runs. No garbled characters.
    - 6 topics in order. Exercise and answer at the end.
    - Narration matches the code on screen.

- **L7** — 15 min travel vlog from footage
  - Prompt: "turn my japan trip footage into a 15 minute travel vlog. go in order of the days, add a title card for each city (Tokyo, Kyoto, Osaka), light music, keep my own voice clips where I'm talking to camera"
  - Uploads: about 60 phone clips across 3 cities, total 90 min, mixed 9:16 and 16:9.
  - Checks:
    - Duration 14:00–16:00.
    - City order follows clip dates. 3 title cards verbatim.
    - The user's talking-to-camera clips kept with original audio.
    - Mixed aspects handled without black bars or bad crops.

- **L8** — 20 min episodic story
  - Prompt: "20 minute sci-fi episode in 4 acts. a cargo ship crew of four finds an empty station drifting near jupiter. act 1 boarding, act 2 they find the logs, act 3 something is still aboard, act 4 escape. characters: Captain Rhee (woman, 50s, buzz cut, scar on chin), Okafor (engineer, tall, red jumpsuit), Lund (pilot, young, blond, headset), and the ship AI called WREN (voice only). act title cards. cinematic, dark, full dialogue and score"
  - Uploads: none.
  - Checks:
    - Duration 18:00–22:00.
    - 4 act cards, in order.
    - 3 crew hold identity for 20 min, including Rhee's scar and Okafor's red jumpsuit.
    - WREN is voice only, one consistent voice.
    - Ship interior and station interior stay consistent across acts.
