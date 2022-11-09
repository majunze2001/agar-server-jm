// We need the file system here
var fs = require('fs');

// Express is a node module for building HTTP servers
var express = require('express');
var app = express();
var cors = require('cors');

var corsOptions = {
    origin: [/http:\/\/localhost:\d*/, /\.cims\.nyu\.edu:\d*/],
    credentials: true,
    optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

const port = 12345;
/* 
This server simply keeps track of the peers all in one big "room"
and relays signal messages back and forth.
*/
let rooms = {};

// If the user just goes to the "route" / then run this function
app.get('/', function(req, res) {
    res.redirect('/index.html');
});

app.get('/count/', cors(corsOptions), function(req, res) {
    const room = req.query.room;
    // send back the string of players in the room
    if (rooms[room]) {
        res.send(rooms[room].length + '');
    } else {
        res.send('0');
    }
});

// Here is the actual HTTP server
// In this case, HTTPS (secure) server
var https = require('https');

Security options - key and certificate
var options = {
    key: fs.readFileSync('keys/privkey.pem'),
    cert: fs.readFileSync('keys/fullchain.pem'),
};

// We pass in the Express object and the options object
var httpServer = https.createServer(options, app);

// Tell Express to look in the "public" folder for any files first
app.use(express.static('public'));

// Default HTTPS port
httpServer.listen(port);

/* 
This server simply keeps track of the peers all in one big "room"
and relays signal messages back and forth.
*/

// WebSocket Portion
// WebSockets work with the HTTP server

const {
    Server
} = require('socket.io');

const io = new Server(httpServer, {
    cors: {
        // regular expression to allow for all local and cims domain
        origin: [/http:\/\/localhost:\d*/, /\.cims\.nyu\.edu:\d*/],
        credentials: true,
    },
    // allow for older client socket.io
    allowEIO3: true,
});

// Register a callback function to run when we have an individual connection
// This is run for each individual user that connects
io.on(
    'connection',

    // We are given a websocket object in our function
    function(socket) {
        console.log(Date.now(), socket.id, 'New client');
        // peers.push({socket: socket});

        socket.on('room_connect', function(room) {
            console.log(Date.now(), socket.id, room, 'room_connect');

            if (!rooms.hasOwnProperty(room)) {
                console.log(Date.now(), socket.id, "room doesn't exist, creating it");
                rooms[room] = [];
            }
            rooms[room].push(socket);
            socket.room = room;

            console.log(Date.now(), socket.id, rooms);

            let ids = [];
            for (let i = 0; i < rooms[socket.room].length; i++) {
                ids.push(rooms[socket.room][i].id);
            }
            console.log(Date.now(), socket.id, 'ids length: ' + ids.length);
            socket.emit('listresults', ids);
        });

        socket.on('list', function() {
            let ids = [];
            for (let i = 0; i < rooms[socket.room].length; i++) {
                ids.push(rooms[socket.room][i].id);
            }
            console.log(Date.now(), socket.id, 'ids length: ' + ids.length);
            socket.emit('listresults', ids);
        });

        // Relay signals back and forth
        socket.on('signal', (to, from, data) => {
            //console.log("SIGNAL", to, data);
            let found = false;
            for (let i = 0; i < rooms[socket.room].length; i++) {
                //console.log(rooms[socket.room][i].id, to);
                if (rooms[socket.room][i].id == to) {
                    //console.log("Found Peer, sending signal");
                    rooms[socket.room][i].emit('signal', to, from, data);
                    found = true;
                    break;
                }
            }
            // if (!found) {
            // 	console.log("never found peer");
            // }
        });

        socket.on('disconnect', function() {
            console.log(Date.now(), socket.id, 'Client has disconnected');
            if (rooms[socket.room]) {
                // Check on this
                // Tell everyone first
                let which = -1;
                for (let i = 0; i < rooms[socket.room].length; i++) {
                    if (rooms[socket.room][i].id != socket.id) {
                        rooms[socket.room][i].emit('peer_disconnect', socket.id);
                    } else {
                        which = i;
                    }
                }
                // Now remove from array
                if (rooms[socket.room][which] && rooms[socket.room][which].id == socket.id) {
                    rooms[socket.room].splice(which, 1);
                }

                // This could fail if someone joins while the loops are in progress
                // Should be using associative arrays all the way around here
            }
        });
    }
);