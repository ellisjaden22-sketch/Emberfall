/* Emberfall settings — edit freely.
   serverUrl:   leave null to use the same server that hosts the page (normal setup).
                Set e.g. 'wss://my-emberfall.example.com/ws' if the game page and server live on different hosts.
   multiplayer: set to false to always play solo.
   soloGM:      'file' = you are a Game Master only when you open index.html straight from your own disk (solo, no server).
                false = never. On a server, the owner is recognised automatically (see README: GM_PASSWORD / OWNER_IP).
   Bug reports: "Report a bug" in game creates a ticket on the realm server. Game Masters open them with /tickets. */
window.EMBERFALL_CONFIG = {
  serverUrl: null,
  multiplayer: true,
  soloGM: 'file',
};
