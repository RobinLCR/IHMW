
// Create a client socket and connect to port 3636
const socketio = require('socket.io-client');
const socket = socketio.connect("http://localhost:3636");

//Couleur
const chalk = require('chalk');

//Bcrypt auth
const bcrypt = require('bcrypt');

// Read user's input
const readline = require('readline');
const rl = readline.createInterface(process.stdin, process.stdout);

// Variable to keep user's nickname
var argv = require('yargs').argv;
let nickname = '';
let isConnected = false;


// Process user's input
rl.on('line', function(line) {
    switch(line){
        case 'ls' :
            socket.emit('send', { sender: nickname, action: 'list' });
            break;
        case 'q' :
            isConnected = false;
            socket.emit('send', { sender: nickname, action: 'quit' }); 
            break;
        case (!isConnected) :
            console.log("You have been disconnected. Please close the program and reconnect");
            break;
        }
               

    var separation = line.split(';');
    switch (separation[0]){
            case 'b' :
                    socket.emit('send', { sender: nickname, message: getUserInputMessage(line), action: 'client-broadcast' });
                    break;
            case 's' :
                    socket.emit('send', { sender: nickname, message: separation[2], dest : separation[1], action: 'client-send' });
                    break;
            case 'cg' :
                    socket.emit('send',{sender: nickname,"color" : argv.color, "group": separation[1], action:'cgroupe'});
                    break;
            case 'cgpr' :
                    socket.emit('send',{sender: nickname,"color" : argv.color, "group": separation[1], action:'cgroupeprivé'});
                    break;
            case 'j' :
                    socket.emit('send',{sender: nickname, "color" : argv.color,"group": separation[1], action:'join'});
                    break;
            case 'bg' :
                    socket.emit('send',{sender: nickname, "color" : argv.color,"group": separation[1],"message": separation[2], action:'gbroadcast'});
                    break;
            case 'members' :
                    socket.emit('send',{sender: nickname, "color" : argv.color,"group": separation[1], action:'members'});
                    break;
            case 'messages' :
                    socket.emit('send',{sender: nickname, "color" : argv.color,"group": separation[1], action:'msgs'});
                    break;
            case 'groups' :
                    socket.emit('send',{sender: nickname, "color" : argv.color, action:'groups'});
                    break;
            case 'leave' : 
                socket.emit('send',{sender: nickname, "color" : argv.color,"group": separation[1], action:'leave'});
                break;
            case 'invite' :
                socket.emit('send',{sender: nickname, "color" : argv.color,"group": separation[1], "dest" : separation[2] ,action:'invite'});
                break;
            case 'kick' :
                socket.emit('send',{sender: nickname,"color" : argv.color, "group": separation[1], "dest" : separation[2], "reason" : separation[3] ,action:'kick'});
                break;
            case 'ban' :
                socket.emit('send',{sender: nickname, "color" : argv.color,"group": separation[1], "dest" : separation[2], "reason" : separation[3] ,action:'ban'});
                break;
            case 'unban' :
                socket.emit('send',{sender: nickname, "color" : argv.color,"group": separation[1], "dest" : separation[2] ,action:'unban'});
                break;
            case 'states' : 
                socket.emit('send',{sender: nickname, "color" : argv.color,"group": separation[1],  action:'states'});
                break;
    
        default :
        rl.prompt(true);
    }
});

//Texte après la virgule dans le cas d'un broadcat
function getUserInputMessage(line) {
    return line.substring(2, line.length);
}


// Handle events from server
socket.on('message', function(data) {
    switch(data.action){
        case 'server-invite' :
            console.log(data.message);
            rl.prompt();
            rl.question(chalk.yellow.bold('Voulez-vous rejoindre ce groupe ? (Y/N)'), function(text) {
                if(text == 'Y'){
                socket.emit('send',{"sender": nickname, "color" : argv.color,
                                             "group": data.group , action:'joinpr'});
                rl.prompt();
                }   
            else{ console.log('Vous avez raison ce groupe de vaut pas le coup !!')};
        });
        break;

        case 'server-quit' :
            console.log(data.message + chalk.yellow.bold('... Merci pour votre échange'));
            process.exit();
        break;

        default :
            console.log(data.message);
            rl.prompt();
        break;
    }

});

function main() {
    if (process.argv.length == 6 && process.argv[2] == '--name' && process.argv[4] ==  '--password') {
        nickname = process.argv[3];
        password = process.argv[5];
        socket.emit('send', { sender: nickname, "password" : password, action: 'connection' });
    } 
    else{
        if(process.argv.length == 4 && process.argv[2] == '--name'){
            nickname = process.argv[3];
            // Set the password
            rl.question('Please enter a password : ', function(motdep) {
                socket.emit('send', { sender: nickname, password : motdep ,action: 'connection' });
                rl.prompt(true);
                              
            });
        }        
        else {
            // Set the username
            rl.question('Nickname : ', function(nameInput) {
                nickname = nameInput;
                 // Set the password
                rl.question('Password : ', function(motdep) {
                    socket.emit('send', { sender: nickname, password : motdep ,action: 'connection' });
                    rl.prompt(true);             
                });
            });
           
        }
    }
}
 



main();