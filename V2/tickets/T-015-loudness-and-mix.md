# T-015 · Loudness normalisation and the mix

- status: open · priority: medium · subsystem: edit
- what: at the stitch, normalise dialogue to a broadcast target (EBU R128, about -16 LUFS, true peak -1 dB) with ffmpeg loudnorm; duck music under dialogue; short fades at cuts.
- why: the vanderbilt6 film peaks at 0 dB (clipping) and levels differ between clips.
- acceptance: the film measures within 1 LU of the target; no sample above -1 dBTP.
