// Test scripts for the floating command panel (not part of the product). Each script is a list of actions the panel
// plays against the chat: send a message with materials, wait for the agent, run the current turn (simulated or
// real, per the panel's switch), wait for it to finish. Materials are imported from a run folder so they are real
// pictures. The brief for the film is short and cheap on the free tier.
window.TEST_SCRIPTS = {
  "micro ×4 (2 single, 2 trees)": {
    mode: "ask",
    steps: [
      { do: "import", from: "runs/topgun9/refs/vega-f35c-3.jpg", name: "jet.jpg" },
      { do: "import", from: "runs/topgun9/stills/s3-1.png", name: "cockpit.png" },
      { do: "import", from: "runs/topgun9/roots/vega.png", name: "pilot.png" },
      { do: "send", text: "Make this photo black and white with a little grain.", materials: ["jet.jpg"] },
      { do: "run" },
      { do: "send", text: "Upscale this picture." , materials: ["cockpit.png"] },
      { do: "run" },
      { do: "send", text: "An Instagram post: this jet on a hangar floor at dawn, the headline 'Ready', in 4:5 and 1:1.", materials: ["jet.jpg"] },
      { do: "run" },
      { do: "send", text: "Put this pilot in a rainy street at night, then make it look like a 1970s film still, then add a neon sign that says 'Vega'.", materials: ["pilot.png"] },
      { do: "run" },
    ],
  },
  "film (10 s ad, free tier)": {
    mode: "auto",
    steps: [
      { do: "send", text: "A 10-second YouTube ad for Cabin Coffee: a steaming mug on a wooden table at dawn, a hand lifts it, end on the words 'Wake up slow'. Warm and quiet, for people who buy specialty coffee.", materials: [] },
      { do: "run" },
    ],
  },
};
