# T-009 · A results page per run

status:     open
priority:   high
subsystem:  results

what:
`backend/composer/results.js --label <label>` writes `results/<label>/index.html`: the brief and mode, the story, the screenplay, the
state tables, then every keyframe with the picture on the left and on the right the images sent in order (each labelled
plate, earlier still, crop or portrait, with its file) and the prompt as sent, with every earlier attempt as thumbnails
(the one in use bold, "USED") and the gate's verdict; every clip with its two keyframes, prompt, gate verdict and
transcription; the film; the credits. Taken from the job records, not from the plan, so it shows what was actually sent.

why:
The user reviews by looking. In `V1/` this grew into four separate pages (compare, slides, review, keyframes gallery)
built one request at a time; the gallery with the job inputs is the one that answered "what was sent" correctly. V2 needs
one page, regenerated from the run folder.

acceptance:
One command produces the page for vanderbilt6 with all five keyframes, their attempts and inputs, the six clips and the
film; the page works as a local file with no network.
