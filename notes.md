- ASD100 
- How does sound work 
- State memeory bank for seeding 
- Video cutting states -> solved with ASD100 as the seed for the cutts and imrpotnat frames 
- check the latest video


- e I want you to check does the PRD and the code match what I am about to say :

  We have a state manger, allt he state maanger does is keep track of the assets and where they are in the previous frames

  a new frame when made, the state manger will track what assests are in it

  when a new frame needs to be made, it asks what is changing in it, and if anything that is not in the frame being introduced

  if soemthing is not being introduced then all assets are in the current frame, a tool call the trnasofmr whatever that asset is would be done

  if something new is being intorudced, this can be an element or an enitre enviroemtn, the state manager checks what was the last time that element was referecned in some frame

  the idea is that last most recent frame would carry all the apprioate context of that asset and would also carry the appriaote transformations that were done to it in the story, if there an multitpel elements it is possible that those two elements alreayd interact with each other in the the latest scene as they are both in the scene, regarldess the latest scene of it is alwasy taken as the state manager alwasy keep track of where thigns are. At this point once the new scene has been made, this scene is tracked to contain the elements mentioend,

  If an element does not have an existing scene with it materialzied then it will check the asset SEED bank. THe asset seed bank is onyl ever used under the case that the asset has never been generated as once it has been generated then its context is fixed to the first scene it has been introduced in. The asset bank has a special pieplein in whcih it generates all assets that are mentioned, a matrix is run to see if an asset interacts with soemthign, if an asset interacts with something, an llm checks if there needs to be some special contraints on how that asset generates, for example a house vs its rooms

  - diffused cropping 


  ❯ wait how do we remeber thigns ? Is it not as simple as a table for each frame, whenever each frame is made, a query table is made, all elements that are reuqested are assumed to be present. This is by induction. All requested elements woudl have been requested, and since it has been requested it must be in the frame. The search would then be to query which tabel has the elements, and sort for the latest one as that one has the most recent changes.

  If something is mentioend in the story as an asset it would have already been declared in the very start as an asset to keep track of.

  In the very start an llm goes through the story and makes a comprhesnsive list of all elements mentioend by the story, the llm should also run to find the aliases of those elements, all times that some element is mentioned in the story, that element will be unambigiosuyl assigned an ID that matches the ID in the table, so if we have an "it" or whatever, there would be a simaltuous copy of the script, with that it reaplced with the ID element for jsut the state manager, we shouldnt even have the case of "it" since everything is explcit, but regarldess if the llm has an issue of known what it is, the ID poitns to a specifc name, as well. But the llm uses the roignal script and onyl the state manager uses the IDd version so it knwos which IDs are in whcih scenes,

  my quesrtion is how the fuck does the code forget, are we curretnly running an llm as the state manager?????

  why would an edit swap an entire room, how is that even possible, like is that a tool glitch or something. If its a tool gltich we can try to fix it later


❯ beforwe, was an llm running the state mamanger?

  additioanly this ID run, is this run at the very start? it should be run before anything has started since then we can check if nouns have all been labeled, The asset bank runs after the story is done. An llm can just run for each chunk of text and parse out the nouns no? and if a noun/pronoun is smetnaitcaly the same it gets the same ID.

  Of the resulting IDs, there is a table of IDs and things, another llm will run to check if any of the assets have special contraints on each other, this way we dont gotta generate shit like a fuckign needle or whatever, but roosm and the house have special contrainsts since they are the same object, clearly they gotta respect each toehr. So all the LLM is checking for is some noun is referencing things that are physcialyl connected. A room and a house are two different nouns but they reference the same thing spatially. The LLm will run twice, once to for hypothesis, another is to check the text for if they are the same, it can simply ask does x belong to y or something.

If it is not sourced from a previous frame or the bank it is simply being generated (this is only the case when it is never refenrece before and not in the asset bank because it
  is not nesscaery)