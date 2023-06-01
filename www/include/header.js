const socket = io();

addEventListener('pageshow', (e) => {
    if (e.persisted) {
        window.location.reload();
    }
});

socket.on("crossword::redirect", (path) => {
    window.location.href = path;
});

function get(name){
    if(name=(new RegExp('[?&]'+encodeURIComponent(name)+'=([^&]*)')).exec(location.search))
       return decodeURIComponent(name[1]);
 }
