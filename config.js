/* Emberfall settings — edit freely.
   serverUrl:   leave null to use the same server that hosts the page (normal setup).
                Set e.g. 'wss://my-emberfall.example.com/ws' if the game page and server live on different hosts.
   multiplayer: set to false to always play solo.
   soloGM:      'file' = you are a Game Master only when you open index.html straight from your own disk (solo, no server).
                false = never. On a server, the owner is recognised automatically (see README: GM_PASSWORD / OWNER_IP).
   bugEmail:    where "Report a bug" sends reports (opens the player's email app). */
window.EMBERFALL_CONFIG = {
  serverUrl: null,
  multiplayer: true,
  soloGM: 'file',
  bugEmail: 'ellis.jaden22@gmail.com',
};
