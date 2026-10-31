# results — organised results

One HTML page per run, `results/<label>/index.html`, written by `backend/composer/results.js` from `runs/<label>/`. Regenerate it any
time with:

```
node V2/backend/composer/results.js --label <label>
```

What a page shows, in this order: the brief and the mode; the story; the screenplay as text; the state tables (who is in
which keyframe, what each keyframe is painted from); every keyframe with the picture on the left and, on the right, the
images that were sent in order and the prompt as sent, plus every earlier attempt and the gate's verdict; every clip with
its two keyframes, its prompt, the gate's verdict and the transcription; the film; the credits spent.

Pages reference the media in `../../runs/<label>/` by relative path, so they work as local files without copying anything.
Nothing in this folder is a source of truth; delete and regenerate freely.

A second page per finished run, `<label>-film/index.html`, is the finished product: the film first, then the cut shot by
shot with its clip, its two keyframes and what is said and shown; no prompts, no attempts. The pipeline writes it after the
stitch; `node V2/backend/composer/film-page.js <label>` rewrites it from the run record at any time.
