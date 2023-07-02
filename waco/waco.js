const { LocalAuth, Client } = require("whatsapp-web.js");
const express = require("express");
const socketIO = require("socket.io");
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');
const fileUpload = require('express-fileupload');
const quotable = require('quotable');
const moment = require("moment-timezone");

const config = require("./../config.js");
const { phoneNumberFormatter } = require("./common.js");

const sessions = [];
const SESSIONS_FILE = './sessions/whatsapp-sessions.json';
const AUTH_DIR = './.wwebjs_auth/';
const CACHE_DIR = './wwebjs_cache/';

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    allowEIO3: true,
    cors: config.cors
});

app.use(express.json());

app.use(express.urlencoded({
    extended: true,
    limit: '50mb'
}));

app.use(fileUpload({
    debug: false
}));

const WACO = {
    io: io,
	app: app,
	server: server,
	cors: cors(config.cors),
    clients: new Client(),

    createSessionsFileIfNotExists: async function() {
        if (!fs.existsSync(SESSIONS_FILE)) {
            try {
                fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
                console.log('Sessions file created successfully.');
            } catch (err) {
                console.log('Failed to create sessions file: ', err.message);
            }
        }
    },

    setSessionsFile: function(sessions) {
        fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions), function(err) {
            if (err) {
                console.log(err);
            }
        });
    },

    getSessionsFile: function() {
        // var fsessions = fs.readFileSync(SESSIONS_FILE);
        // if (fsessions) {
        //     try {
        //         return JSON.parse(fsessions);
        //     } catch (e) {
        //         // console.error(e.name, e.message);
        //         // reset session file
        //         fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
        //         return JSON.parse(fs.readFileSync(SESSIONS_FILE));
        //     }
        // } else {
        //     fs.writeFileSync(SESSIONS_FILE, JSON.stringify([]));
        //     return JSON.parse(fs.readFileSync(SESSIONS_FILE));
        // }
        return JSON.parse(fs.readFileSync(SESSIONS_FILE));
    },

    createSession: async function(id, description) {
        if (id && description) {
            const client = new Client({
                restartOnAuthFail: true,
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process', // <- this one doesn't works in Windows
                        '--disable-gpu'
                    ],
                },
                authStrategy: new LocalAuth({
                    clientId: id
                })
            });

            client.initialize();

            this.clients = client;

            // client.on("loading_screen", (percent, message) => {
            //     console.log('LOADING SCREEN', percent, message);
            // }),

            client.on('qr', (qr) => {
                // check sessions
                const savedSessions = this.getSessionsFile();
                const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
                if (savedSessions[sessionIndex]) {
                    console.log('QR Received with ID - ' + id);
                    // console.log('QR RECEIVED ~ ' + id, qr);
                    qrcode.toDataURL(qr, (err, url) => {
                        io.emit('qr', { id: id, src: url });
                        io.emit('message', {
                            id: id, 
                            text: 'QR Code received, scan please!', 
                            time: moment.tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm') 
                        });
                    });
                }
            });
            
            client.on('ready', async () => {
                io.emit('ready', { id: id });
                io.emit('message', { 
                    id: id, 
                    text: 'Whatsapp is ready!', 
                    time: moment.tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm') 
                });
                const savedSessions = this.getSessionsFile();
                const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
                savedSessions[sessionIndex].ready = true;
                savedSessions[sessionIndex].pic = await client.getProfilePicUrl(client.info.wid._serialized);
                savedSessions[sessionIndex].name = client.info.pushname;
                savedSessions[sessionIndex].server = client.info.wid.server;
                savedSessions[sessionIndex].user = client.info.wid.user;
                this.setSessionsFile(savedSessions);
            });

            client.on('message', async (message) => {
                if ((message.body).toLocaleLowerCase() === 'hello') {
                    client.sendMessage(message.from, 'Hola!');
                }
                if ((message.body).toLocaleLowerCase() === 'quote') {
                    const a = await quotable.getRandomQuote();
                    message.reply( a.content + " " + "-" + " " + a.author);
                }
            });

            client.on('authenticated', () => {
                io.emit('authenticated', { id: id });
                io.emit('message', { 
                    id: id, 
                    text: 'Whatsapp is authenticated!', 
                    time: moment.tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm') 
                });
            });

            client.on('auth_failure', function() {
                io.emit('message', { 
                    id: id, 
                    text: 'Auth failure, restarting...', 
                    time: moment.tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm') 
                });
            });

            // logout
            client.on('disconnected', async (reason) => {
                io.emit('message', { 
                    id: id, 
                    text: 'Whatsapp is disconnected!', 
                    time: moment.tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm') 
                });
                await client.destroy();
                await client.initialize();
                // Menghapus pada file sessions
                const savedSessions = this.getSessionsFile();
                const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
                savedSessions.splice(sessionIndex, 1);
                console.log(savedSessions);
                this.setSessionsFile(savedSessions);
                io.emit('remove-session', id);
            });

            // client.on('change_state', state => {
            //     console.log('CHANGE STATE', state);
            // });

            // Tambahkan client ke sessions
            sessions.push({
                id: id,
                description: description,
                client: client
            });

            // Menambahkan session ke file
            const savedSessions = this.getSessionsFile();
            const sessionIndex = savedSessions.findIndex(sess => sess.id == id);

            if (sessionIndex == -1) {
                savedSessions.push({
                    id: id,
                    description: description,
                    ready: false,
                    name: null,
                    server: null,
                    pic: null,
                    user: null
                });
                this.setSessionsFile(savedSessions);
            }
        }
    },

    init: async function(socket) {
        const savedSessions = this.getSessionsFile();
        if (savedSessions) {
            console.log(1);
        } else {
            console.log(0);
        }
        // console.log(savedSessions);
        if (savedSessions.length > 0) {
            if (socket) {
                console.log(savedSessions);
                /**
                 * At the first time of running (e.g. restarting the server), our client is not ready yet!
                 * It will need several time to authenticating.
                 * 
                 * So to make people not confused for the 'ready' status
                 * We need to make it as FALSE for this condition
                 */
                savedSessions.forEach((e, i, arr) => {
                    // arr[i].ready = false;
                });
                socket.emit('init', savedSessions, moment.tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm'));
            } else {
                savedSessions.forEach(sess => {
                    this.createSession(sess.id, sess.description);
                });
            }
        }
    },

    send_message: async function(req, res) {
        const sender = req.body.sender;
        const number = await phoneNumberFormatter(req.body.number);
        const message = req.body.message;

        // return res.json(number);

        const client = sessions.find(sess => sess.id == sender)?.client;

        // Make sure the sender is exists & ready
        if (!client) {
            return res.status(422).json({
                status: false,
                message: `The sender: ${sender} is not found!`
            })
        }

        try {
            /**
             * Check if the number is already registered
             * Copied from app.js
             * 
             * Please check app.js for more validations example
             * You can add the same here!
             */
            const isRegisteredNumber = await client.isRegisteredUser(number);
            if (!isRegisteredNumber) {
                return res.status(422).json({
                    status: false,
                    message: 'The number is not registered'
                });
            }

            await client.sendMessage(number, message).then(response => {
                res.status(200).json({
                    status: true,
                    response: response
                });
            }).catch(err => {
                res.status(500).json({
                    status: false,
                    response: err
                });
            });
        } catch(err) {
            return res.status(422).json({
                status: false,
                message: 'Try again..'
            });
        }   
    },

    exit: async function(req, res) {
        const id = req.body.id;
        const clientx = WACO.clients;
        io.emit('message', { id: id, text: 'Whatsapp is disconnected!', time: moment.tz('Asia/Jakarta').format('DD/MM/YYYY HH:mm') });
        // client.destroy();
        // client.initialize();

        // while (clientx.pupBrowser.isConnected()) {
        //     await new Promise(resolve => setTimeout(resolve, 100))
        // }

        

        // Menghapus pada file sessions
        const savedSessions = this.getSessionsFile();
        const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
        savedSessions.splice(sessionIndex, 1);
        // this.setSessionsFile(savedSessions);

        io.emit('remove-session', id);

        // fs.rmdirSync(".wwebjs_auth/session-" + id);
        // fs.rmSync(".wwebjs_auth/session-" + id, {force: true, recursive: true});

        // io.emit('remove-session', id);

        // console.log(id);
        // const savedSessions = this.getSessionsFile();
        // console.log(savedSessions.findIndex(sess => sess.id == id));
        // savedSessions.splice(savedSessions.findIndex(sess => sess.id == id), 1)
        // // const client = sessions.findIndex(sess => sess.id == 1)?.client;
        // // console.log(client);
        return res.status(200).json({
            status: true,
            response: "exit"
        });
    }
}

WACO.createSessionsFileIfNotExists();

WACO.init();

io.on('connection', function(socket) {
    WACO.init(socket);
    socket.on('create-session', function(data) {
        WACO.createSession(data.id, data.description);
    });
    socket.on('exit', async function(data) {
        console.log(data);
    });
});

module.exports = WACO; 