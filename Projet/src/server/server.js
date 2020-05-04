//Database requirement
var sq = require('sqlite3').verbose();;
const path = require('path');
const dbPath = path.resolve( __dirname +'db.db3');
var db=new sq.Database(dbPath);

//Bcrypt auth
const bcrypt = require('bcrypt');

///////////////////////////////////////////////////
//Init Database
// db.serialize(()=>{
//db.run('CREATE TABLE CLIENTS(C_NOM TEXT PRIMARY KEY UNIQUE, MDP TEXT)'); //Remplace MapClientSocket, recense les users du chat global
// db.run('CREATE TABLE GROUPE(G_NAME TEXT PRIMARY KEY UNIQUE,G_PRIVATE INT)'); //1 si privé, 0 si public
// db.run('CREATE TABLE MESSAGES(M_SENDER TEXT,M_DEST TEXT, M_CONTENT TEXT)'); //messages;[group]
// db.run('CREATE TABLE BAN(BAN_CLIENT TEXT,BAN_GROUP TEXT)');//Clients après un ban
// db.run('CREATE TABLE MEMBRES(MEM_CLIENT TEXT,MEM_GROUP TEXT)');// Pour members;[group]
// db.run('CREATE TABLE EVENT(EV_GROUP TEXT,EV_CONTENT TEXT)');//states;[group]
// });

///////////////////////////////////////////////////



//Appel à la classe Groupe
var Groupe = require('./Groupe.js');

// Create a server socket and listen on port 3636
const socketio = require('socket.io');
const io = socketio.listen(3636);

//Couleur
const chalk = require('chalk');


// Liaison ave ma classe Groupe
var Groupe = require('./Groupe.js');

// Variables locales de stockage 
var MapClientSocket = new Map();
var MaplisteGroupe = new Map();



// Handle action 'send' from client
io.on('connection', function(socket) {
    socket.on('send', function(data) {
        
        switch (data.action) {
            case 'connection':
                handleConnectionAction(socket, data);
                break;
            case 'client-broadcast':
                handleBroadcastAction(socket, data);
                break;
            case 'client-send':
                handleSendAction(data);
                break;
            case 'list':
                handleListAction(socket);
                break;
            case 'quit':
                handleQuitAction(socket, data);
                break;
            case 'cgroupe':
                handleCgroupeAction(socket, data);
                break;
            case 'cgroupeprivé':
                handleCgroupePrAction(socket, data);
                break;
            case 'join':
                handleJoinAction(socket, data);
                break;
            case 'joinpr':
                handleJoinPrAction(socket, data);
                break;
            case 'gbroadcast':
                handleGBroadcastAction(socket,data);
                break;
            case 'members':
                handleMembersAction(socket, data);
                break;
            case 'msgs':
                handleMsgsAction(socket, data);
                break;
            case 'groups':
                handleGroupsAction(socket, data);
                break;
            case 'leave':
                handleLeaveAction(socket, data);
                break;
            case 'invite':
                handleInviteAction(socket, data);
                break;
            case 'kick':
                handleKickAction(socket, data);
                break;
            case 'ban':
                handleBanAction(socket, data);
                break;
            case 'unban':
                handleUnbanAction(socket, data);
                break;
            case 'states':
                handleStatesAction(socket, data);
                break;

            default:
                handleNotSupportedAction(socket, data)
                break;
        }
    });

});


function handleNotSupportedAction(socket, data) {
    socket.emit('message', {  message: chalk.yellow.bold(`Action ${data.action} is not supported`), action: 'error.action.notSupported' });
}

function handleConnectionAction(socket, data) {
    //On regarde si l'utilisateur n'existe pas dans la table Utilisateurs, sinon on le rajoute
      db.each('SELECT COUNT(*) AS isUserHere FROM CLIENTS WHERE C_NOM = ?',[data.sender],(err,row)=>{
        if (err) {
          throw err;
        }
        if(row.isUserHere == 0){
            const saltRounds = 10
            bcrypt.genSalt(saltRounds, function (err, salt) {
                if (err) {
                    throw err
                } else {
                    bcrypt.hash(data.password, salt, function(err, hash) { 
                        if (err) {
                            throw err;
                          }
                        else{
                        db.run(`INSERT INTO CLIENTS VALUES(?,?)`, [data.sender,hash]); 
                        }
                    });
                }
            });
            socket.emit('message', {  message:chalk.yellow.bold(`Hello ${data.sender}`), action: 'server-connection' });
            sendBroadcastMessage(socket, {message: chalk.yellow.bold(`${data.sender} est connecté au chat global pour la première fois`)});
            MapClientSocket.set(data.sender, socket);
        }
        else{
            //Si l'user est déjà dans la database, on vérifie le mdp
            db.each('SELECT MDP FROM CLIENTS WHERE C_NOM = ?', [data.sender],(err,row)=>{
                mdp1 = row.MDP;
                if (err) {
                    throw err;
                  }
                else{
                    bcrypt.compare(data.password, mdp1, function(err, res) {
                        if (err) {
                            throw err;
                        }
                        if(res) {
                            console.log('ok');
                            socket.emit('message', {  message:chalk.yellow.bold(`Hello ${data.sender}`), action: 'server-connection' });
                            sendBroadcastMessage(socket, {message: chalk.yellow.bold(`${data.sender} est de retour sur le chat global`)});
                            MapClientSocket.set(data.sender, socket);
                        } 
                        else {
                            console.log('pas ok');
                            socket.emit('message', {  message:chalk.yellow.bold('Mot de passe erronné, veuillez réessayer'), action: 'server-quit' });
                        } 
                    });
                }
            });
        }
    });
}

function handleBroadcastAction(socket, data) {
    db.run('INSERT INTO MESSAGES VALUES(?,?,?)', [data.sender,'broadcast',data.message]);
    sendBroadcastMessage(socket, { sender: data.sender, message:data.sender+" : "+ data.message, action: 'server-broadcast' });
}

function handleSendAction(data){
    if (MapClientSocket.has(data.dest)){
        var socketCop = MapClientSocket.get(data.dest)
        socketCop.emit('message',{action:"server-envoi",message: data.sender + ' : '+data.message});
        //On ajoute le message dans la table des messages
        db.run('INSERT INTO MESSAGES VALUES(?,?,?)', [data.sender,data.dest,data.message]);
    } else {
        console.log(chalk.yellow.bold("La personne n'est pas connectée au chat"));
    }
}

function handleListAction(socket) {
    var liste = 'Les personnes connectées au chat général sont : '+ '\n';
                    MapClientSocket.forEach(function(sock,nom){  
                        liste += nom + '\n';                     
                    });
    socket.emit('message', {action:"server-list-clients", message: chalk.yellow.bold(liste)});
}

function handleQuitAction(socket, data) {
    MapClientSocket.delete(data.sender);
    socket.emit('message',{action:"server-quit" ,message:chalk.yellow.bold("Vous quittez la connexion") });
    sendBroadcastMessage(socket ,{action:"server-broadcast",message: chalk.yellow.bold("Déconnexion du chat global : ")+ data.sender });
}

function handleCgroupeAction(socket,data) {
    //On regarde si le nom de groupe a déjà été pris
    db.each('SELECT COUNT(*) AS GroupeIsHere FROM GROUPE WHERE G_NAME= ?',[data.group],(err,row)=>{
        if (err) {
          throw err;
        }
        if(row.GroupeIsHere == 0){
          // 0 si groupe public
          db.run('INSERT INTO GROUPE VALUES(?,?)', [data.group,0]);
          db.run(`INSERT INTO MEMBRES VALUES(?,?)`, [data.sender,data.group]);
          db.run(`INSERT INTO EVENT VALUES(?,?)`, [data.group,data.sender +' a créé le groupe '+data.group]);
        }
    });
    socket.emit('message',{action :"server-cgroupe", 
                           message:chalk.yellow.bold("Vous venez de créer le groupe " + data.group)});
                    var groupe = new Groupe(data.group);
                    groupe.visibilité = "public";
                    groupe.joindreGroupe(data.sender, socket);
                    MaplisteGroupe.set(data.group,groupe);
                    MaplisteGroupe.get(data.group).ajoutState(data.action, data.sender);
}

function handleCgroupePrAction(socket,data) {
    //On regarde si le nom de groupe a déjà été pris
    db.each('SELECT COUNT(*) AS GroupeIsHere FROM GROUPE WHERE G_NAME= ?',[data.group],(err,row)=>{
        if (err) {
          throw err;
        }
        if(row.GroupeIsHere == 0){
          db.run('INSERT INTO GROUPE VALUES(?,?)', [data.group,1]);
          db.run(`INSERT INTO MEMBRES VALUES(?,?)`, [data.sender,data.group]);
          db.run(`INSERT INTO EVENT VALUES(?,?)`, [data.group,(data.sender) +' a créé le groupe privé '+data.group]);
          socket.emit('message',{action :"server-cgroupeprivé",
                           message:chalk.yellow.bold("Vous venez de créer le groupe privé " + data.group)});
                    var groupe = new Groupe(data.group);
                    groupe.visibilité = "privé";
                    groupe.joindreGroupe(data.sender, socket);
                    MaplisteGroupe.set(data.group,groupe);
                    MaplisteGroupe.get(data.group).ajoutState(data.action, data.sender);
        }
    });
}

function handleJoinAction(socket,data) {
    db.each('SELECT COUNT(*) AS g FROM GROUPE WHERE G_NAME= ?',[data.group],(err,row)=>{
        if (err) {
          throw err;
        }
        //S'il existe pas on notifie l'utilisateur
        if(row.g == 0){
          socket.emit('message',{"message": chalk.yellow.bold('Le groupe ' +data.group+' n\'existe pas'),"action":'server-error'});
        }
        else{
          //On regarde si la personne n'est pas déja dans le groupe
          db.each('SELECT COUNT(*) AS YouInGroupe FROM MEMBRES WHERE MEM_CLIENT= ? AND MEM_GROUP=?',[data.sender,data.group],(err,row)=>{
                if (err) {
                throw err;
                }
                if(row.YouInGroupe == 1){
                socket.emit('message',{"message": chalk.yellow.bold('Vous etes déjà dans ce groupe') ,"action":'server-error'});
                }
                else{
                //On regarde si il est banni
                db.each('SELECT COUNT(*) AS ClientBanni FROM BAN WHERE BAN_CLIENT= ? AND BAN_GROUP= ?',[data.sender,data.group],(err,row)=>{
                    if (err) {
                    throw err;
                    }
                    if(row.ClientBanni==1){
                    socket.emit('message',{"message": chalk.yellow.bold('Vous avez été exclu définitivement du groupe ' +data.group+', vous ne pouvez donc pas le rejoindre.'),"action":'server-join'});
                    }
                    else{
                        //On regarde si le groupe est privé ou publique
                        db.each('SELECT G_PRIVATE AS private FROM GROUPE WHERE G_NAME= ?',[data.group],(err,row)=>{
                            if (err) {
                            throw err;
                            }
                            if(row.private==1){
                                //si le groupe est privé on lui explique qu'il faut une invitation
                                socket.emit('message',{action:'server-join', message:  chalk.yellow.bold( data.group+" est privé, il vous faut être invité pour y accéder")});
                                db.each('SELECT MEM_CLIENT FROM MEMBRES WHERE MEM_GROUP= ?',[data.group],(err,row)=>{
                                    if (err) {
                                    throw err;
                                    }
                                    //On regarde si l'utilisateur est connecté pour le notifier
                                    if(MapClientSocket.has(row.MEM_CLIENT)){
                                        if(row.MEM_CLIENT!=data.sender){
                                            MapClientSocket.get(row.MEM_CLIENT).emit('message',{"message": chalk.yellow.bold(data.sender +' souhaiterait rejoindre le groupe '+data.group) ,"action":'server-join'});
                                        }  
                                    }                                  
                                });
                            }
                            //Si le groupe n'est pas privé
                            else{
                            db.serialize(() => {
                                //On rajoute l'utilisateur dans le groupe
                                db.run(`INSERT INTO MEMBRES VALUES(?,?)`, [data.sender,data.group])
                                //On rajoute à l'évenement à la liste des évènements
                                .run(`INSERT INTO EVENT VALUES(?,?)`, [data.group,(data.sender) +' a rejoins le groupe privé '+data.group])
                                //Notification des personnes dans le groupe
                                .each('SELECT MEM_CLIENT FROM MEMBRES WHERE MEM_GROUP= ?',[data.group],(err,row)=>{
                                    if (err) {
                                    throw err;
                                    }
                                    //On regarde si l'utilisateur est connecté pour le notifier
                                    if(MapClientSocket.has(row.MEM_CLIENT)){
                                        if(row.MEM_CLIENT == data.sender){
                                            socket.emit('message',{action:'server-join', message:  chalk.yellow.bold("Vous avez été ajouté au groupe "+ data.group)});
                                        }
                                        else{
                                            userInGroup = MapClientSocket.get(row.MEM_CLIENT);
                                            userInGroup.emit('message',{"message": chalk.yellow.bold(data.sender +' a été ajouté au groupe '+data.group) ,"action":'server-gbroadcast'});
                                        }
                                        
                                    } 
                                
                                });
                            });
                        }

                        });
                    }
                });}
          });
        }
    });
}

function handleJoinPrAction(socket,data) {
    db.each('SELECT COUNT(*) AS ClientBanni FROM BAN WHERE BAN_CLIENT= ? AND BAN_GROUP= ?',[data.sender,data.group],(err,row)=>{
        if (err) {
          throw err;
        }
        if(row.ClientBanni==1){
            socket.emit('message',{"message": chalk.yellow.bold('Vous avez été exclu définitivement du groupe ') +data.group+', vous ne pouvez donc pas le rejoindre.',"action":'server-join'});
        }
        else{
          //On rajoute l'utilisateur dans le groupe
          db.run(`INSERT INTO MEMBRES VALUES(?,?)`, [data.sender,data.group]);
          //On rajoute à l'évenement à la liste des évènements
          db.run(`INSERT INTO EVENT VALUES(?,?)`, [data.group,data.sender +' a rejoins le groupe privé '+data.group]);
          //Notification des personnes dans le groupe
          db.each('SELECT MEM_CLIENT FROM MEMBRES WHERE MEM_GROUP= ?',[data.group],(err,row)=>{
                if (err) {
                throw err;
                }
                //On regarde si l'utilisateur est connecté pour le notifier
                if(MapClientSocket.has(row.MEM_CLIENT)){
                    if(row.MEM_CLIENT == data.sender){
                        socket.emit('message',{"message": chalk.yellow.bold('Vous avez été ajouté au groupe privé '+data.group),"action":'server-gbroadcast'});
                    }
                    else{
                        userInGroup = MapClientSocket.get(row.MEM_CLIENT);
                        userInGroup.emit('message',{"message": chalk.yellow.bold(data.sender +' a été ajouté au groupe privé '+data.group) ,"action":'server-gbroadcast'});
                    }
                    
                } 
            
            });
    
        }
    });
}

function handleGBroadcastAction(socket,data) {
    var listUser = MaplisteGroupe.get(data.group);
    //on regarde si le groupe existe
    db.each('SELECT COUNT(*) AS g FROM GROUPE WHERE G_NAME= ?',[data.group],(err,row)=>{
        if (err) {
          throw err;
        }
        //S'il existe pas on notifie l'utilisateur
        if(row.g == 0){
          socket.emit('message',{"message": chalk.yellow.bold('Le groupe ' +data.group+' n\'existe pas'),"action":'server-error'});
        }
        else{
          //On regarde si la personne est dans le groupe
          db.each('SELECT COUNT(*) AS YouInGroupe FROM MEMBRES WHERE MEM_CLIENT= ? AND MEM_GROUP=?',[data.sender,data.group],(err,row)=>{
                if (err) {
                throw err;
                }
                //Si on est pas dans le groupe on le notifie
                if(row.YouInGroupe == 0){
                socket.emit('message',{"message": chalk.yellow.bold('Vous n\'etes pas dans ce groupe') ,"action":'server-error'});
                }
                else{
                db.run('INSERT INTO MESSAGES VALUES(?,?,?)', [data.sender,data.group,data.message]);
                //Notification des personnes dans le groupe
                db.each('SELECT MEM_CLIENT FROM MEMBRES WHERE MEM_GROUP= ?',[data.group],(err,row)=>{
                    if (err) {
                    throw err;
                    }
                    //On regarde si l'utilisateur est connecté pour le notifier
                    if(MapClientSocket.has(row.MEM_CLIENT)){
                        if(row.MEM_CLIENT == data.sender){
                            socket.emit('message',{"message": chalk.yellow.bold('Vous: ') +data.message ,"action":'server-join'});
                        }
                        else{
                            userInGroup = MapClientSocket.get(row.MEM_CLIENT);
                            userInGroup.emit('message',{"message": chalk.yellow.bold(data.sender +' : ') +data.message ,"action":'server-gbroadcast'});
                        }
                        
                    }
                });
                }
            });
        } 
    });   
}

function handleMembersAction(socket,data) {
    db.each('SELECT COUNT(*) AS g FROM GROUPE WHERE G_NAME= ?',[data.group],(err,row)=>{
        if (err) {
          throw err;
        }
        //S'il existe pas on notifie l'utilisateur
        if(row.g == 0){
          socket.emit('message',{"message": chalk.yellow.bold('Le groupe ' +data.group+' n\'existe pas'),"action":'server-error'});
        }
        else{
          //On regarde si la personne est dans dans le groupe
          db.each('SELECT COUNT(*) AS YouInGroupe FROM MEMBRES WHERE MEM_CLIENT= ? AND MEM_GROUP=?',[data.sender,data.group],(err,row)=>{
                if (err) {
                throw err;
                }
                if(row.YouInGroupe == 0){
                    socket.emit('message',{"message": chalk.yellow.bold('Vous n\'etes pas dans ce groupe et ne pouvez donc pas voir ses membres') ,"action":'server-error'});
                }
                else{                   
                    db.all('SELECT MEM_CLIENT AS membre FROM MEMBRES WHERE MEM_GROUP= ?',[data.group],(err,row)=>{
                        var s='Les membres du groupe sont :' + '\n';
                        if (err) {
                        throw err;
                        }
                        row.forEach(function (row) {
                        s+=row.membre+'\n';
                        });
                        socket.emit('message',{sender: data.sender ,"message": chalk.yellow.bold(s), action:'server-members'});
                    });
                    //On rajoute à l'évenement à la liste des évènements
                    db.run(`INSERT INTO EVENT VALUES(?,?)`, [data.group,data.sender +' a consulté la liste des membres du groupe'+data.group]);
                }
            });
        }
    });
}                   

function handleMsgsAction(socket,data) {
    db.each('SELECT COUNT(*) AS g FROM GROUPE WHERE G_NAME= ?',[data.group],(err,row)=>{
        if (err) {
          throw err;
        }
        //S'il existe pas on notifie l'utilisateur
        if(row.g == 0){
          socket.emit('message',{"message": chalk.yellow.bold('Le groupe ' +data.group+' n\'existe pas'),"action":'server-error'});
        }
        else{
          //On regarde si la personne est dans dans le groupe
          db.each('SELECT COUNT(*) AS YouInGroupe FROM MEMBRES WHERE MEM_CLIENT= ? AND MEM_GROUP=?',[data.sender,data.group],(err,row)=>{
                if (err) {
                throw err;
                }
                if(row.YouInGroupe == 0){
                    socket.emit('message',{"message": chalk.yellow.bold('Vous n\'etes pas dans ce groupe et ne pouvez donc pas voir ses messages') ,"action":'server-error'});
                }
                else{                   
                    db.all('SELECT M_CONTENT FROM MESSAGES WHERE M_DEST = ?', [data.group],(err,row)=>{
                        var s='Les messages du groupe '+data.group+ ' sont :' + '\n';
                        if (err) {
                        throw err;
                        }
                        row.forEach(function (row) {
                        s+=row.M_CONTENT+'\n';
                        });
                        socket.emit('message',{sender: data.sender ,"message": chalk.yellow.bold(s), action:'server-members'});
                    });
                    //On rajoute à l'évenement à la liste des évènements
                    db.run(`INSERT INTO EVENT VALUES(?,?)`, [data.group,data.sender +' a consulté la liste des messages du chat'+data.group]);
                }
            });
        }
    });
}

function handleGroupsAction(socket,data) {
    var res='Les groupes du chat sont :' + '\n';
    db.all('SELECT G_NAME, G_PRIVATE FROM GROUPE',(err,row)=>{
        if (err) {
        throw err;
        }
        else {
            row.forEach(function (row) {
                if(row.G_PRIVATE == 0){
                    res += row.G_NAME + ' (public)'+'\n';
                }
                else{
                    res += row.G_NAME + ' (privé)' +'\n';
                }
            });
            socket.emit('message',{sender: data.sender ,"message": chalk.yellow.bold(res), action:'server-groups'});
        }
    });
}

function handleLeaveAction(socket,data) {
    var listUser = MaplisteGroupe.get(data.group);
    //on regarde si le groupe existe
    db.each('SELECT COUNT(*) AS g FROM GROUPE WHERE G_NAME= ?',[data.group],(err,row)=>{
        if (err) {
          throw err;
        }
        //S'il existe pas on notifie l'utilisateur
        if(row.g == 0){
          socket.emit('message',{"message": chalk.yellow.bold('Le groupe ' +data.group+' n\'existe pas, vous ne pouvez donc pas le quitter'),"action":'server-error'});
        }
        else{
          //On regarde si la personne est dans le groupe
          db.each('SELECT COUNT(*) AS YouInGroupe FROM MEMBRES WHERE MEM_CLIENT= ? AND MEM_GROUP=?',[data.sender,data.group],(err,row)=>{
                if (err) {
                throw err;
                }
                //Si on est pas dans le groupe on le notifie
                if(row.YouInGroupe == 0){
                socket.emit('message',{"message": chalk.yellow.bold('Vous n\'etes pas dans ce groupe, vous ne pouvez donc pas le quitter') ,"action":'server-error'});
                }
                else{
                    db.serialize(()=>{
                        //On rajoute l'évènement à la liste
                        db.run(`INSERT INTO EVENT VALUES(?,?)`, [data.group,data.sender +' a quitté le groupe '+data.group])
                        //Notification des personnes dans le groupe
                        db.each('SELECT MEM_CLIENT FROM MEMBRES WHERE MEM_GROUP= ?',[data.group],(err,row)=>{
                            if (err) {
                            throw err;
                            }
                            //On regarde si l'utilisateur est connecté pour le notifier
                            if(MapClientSocket.has(row.MEM_CLIENT)){
                                if(row.MEM_CLIENT == data.sender){
                                    socket.emit('message',{"message": chalk.yellow.bold(' Vous avez quitté le groupe '+data.group) ,"action":'server-leave'});
                                }
                                else{
                                    userInGroup = MapClientSocket.get(row.MEM_CLIENT);
                                    userInGroup.emit('message',{"message": chalk.yellow.bold(data.sender +" a quitté le groupe "+ data.group) ,"action":'server-gbroadcast'});
                                }
                                
                            }
                        });
                        db.run('DELETE FROM MEMBRES WHERE MEM_GROUP=? AND MEM_CLIENT=? ', [data.group,data.sender]);
                    });
                }
            });
        } 
    });   
}

function handleInviteAction(socket,data){
    //on regarde si le groupe existe
    db.each('SELECT COUNT(*) AS g FROM GROUPE WHERE G_NAME= ?',[data.group],(err,row)=>{
        if (err) {
          throw err;
        }
        //S'il existe pas on notifie l'utilisateur
        if(row.g == 0){
          socket.emit('message',{"message": chalk.yellow.bold('Le groupe ' +data.group+' n\'existe pas'),"action":'server-error'});
        }
        else{
            var socketDest = MapClientSocket.get(data.dest);
            socketDest.emit('message',{ action:"server-invite", group : data.group, message: chalk.yellow.bold(data.sender + ' vous invite dans le groupe '+data.group)});
        }
    });
}

function handleKickAction(socket,data) {
    //on regarde si le groupe existe
    db.each('SELECT COUNT(*) AS g FROM GROUPE WHERE G_NAME= ?',[data.group],(err,row)=>{
        if (err) {
          throw err;
        }
        //S'il existe pas on notifie l'utilisateur
        if(row.g == 0){
          socket.emit('message',{"message": chalk.yellow.bold('Le groupe ' +data.group+' n\'existe pas'),"action":'server-error'});
        }
        else{
            db.serialize(()=>{
                //On rajoute l'évènement à la liste
                db.run(`INSERT INTO EVENT VALUES(?,?)`, [data.group,data.sender +' a exclu '+data.dest+' pour la raison : '+data.reason])
                //Notification des personnes dans le groupe
                db.each('SELECT MEM_CLIENT FROM MEMBRES WHERE MEM_GROUP= ?',[data.group],(err,row)=>{
                    if (err) {
                    throw err;
                    }
                    //On regarde si l'utilisateur est connecté pour le notifier
                    if(MapClientSocket.has(row.MEM_CLIENT)){
                        if(row.MEM_CLIENT == data.sender){
                            socket.emit('message',{"message": chalk.yellow.bold(' Vous avez exclu '+data.dest+' du groupe '+data.group+" pour la raison : "+data.reason) ,"action":'server-kick'});
                        }
                        else {
                            if(row.MEM_CLIENT == data.dest){
                                DestInGroup = MapClientSocket.get(row.MEM_CLIENT);
                                DestInGroup.emit('message',{"message": chalk.yellow.bold(data.sender +' vous a exclu du groupe '+data.group+" pour la raison : "+data.reason) ,"action":'server-kick'});
                            }
                            else{
                                userInGroup = MapClientSocket.get(row.MEM_CLIENT);
                                userInGroup.emit('message',{"message":chalk.yellow.bold(data.sender +" a exclu "+data.dest+" du groupe "+data.group+" pour la raison : "+ data.reason) ,"action":'server-gbroadcast'});
                            }
                        }
                                
                    }
                });
                //On le supprime du groupe
                db.run('DELETE FROM MEMBRES WHERE MEM_GROUP=? AND MEM_CLIENT=? ', [data.group,data.dest]);
            });
                
        }
    });
}
  
function handleBanAction(socket,data) {
    //on regarde si le groupe existe
    db.each('SELECT COUNT(*) AS g FROM GROUPE WHERE G_NAME= ?',[data.group],(err,row)=>{
        if (err) {
          throw err;
        }
        //S'il existe pas on notifie l'utilisateur
        if(row.g == 0){
          socket.emit('message',{"message": 'Le groupe ' +data.group+' n\'existe pas',"action":'server-error'});
        }
        else{
            db.serialize(()=>{
                db.run('INSERT INTO BAN VALUES (?,?)',[data.dest,data.group])
                .run(`INSERT INTO EVENT VALUES(?,?)`, [data.group,data.sender +' a banni '+data.dest+' du groupe '+data.group+' pour la raison : '+data.reason])
                //Notification des personnes dans le groupe
                .each('SELECT MEM_CLIENT FROM MEMBRES WHERE MEM_GROUP= ?',[data.group],(err,row)=>{
                    if (err) {
                    throw err;
                    }
                    //On regarde si l'utilisateur est connecté pour le notifier
                    if(MapClientSocket.has(row.MEM_CLIENT)){
                        if(row.MEM_CLIENT == data.sender){
                            socket.emit('message',{"message": chalk.yellow.bold(' Vous avez banni '+data.dest+' du groupe '+data.group+" pour la raison : "+data.reason) ,"action":'server-kick'});
                        }
                        else {
                            if(row.MEM_CLIENT == data.dest){
                                DestInGroup = MapClientSocket.get(row.MEM_CLIENT);
                                DestInGroup.emit('message',{"message": chalk.yellow.bold(data.sender +' vous a banni du groupe '+data.group+" pour la raison : "+data.reason) ,"action":'server-kick'});
                            }
                            else{
                                userInGroup = MapClientSocket.get(row.MEM_CLIENT);
                                userInGroup.emit('message',{"message":chalk.yellow.bold(data.sender +" a banni "+data.dest+" du groupe "+data.group+" pour la raison : "+ data.reason) ,"action":'server-gbroadcast'});
                            }
                        }
                                
                    }
                });
                //On le supprime du groupe
                db.run('DELETE FROM MEMBRES WHERE MEM_GROUP=? AND MEM_CLIENT=? ', [data.group,data.dest]);
            });
                
        }
    });
}

function handleUnbanAction(socket,data) {
    db.each('SELECT COUNT(*) AS g FROM GROUPE WHERE G_NAME= ?',[data.group],(err,row)=>{
        if (err) {
          throw err;
        }
        //S'il existe pas on notifie l'utilisateur
        if(row.g == 0){
          socket.emit('message',{"message": chalk.yellow.bold('Le groupe ' +data.group+' n\'existe pas'),"action":'server-error'});
        }
        else{
            DestInGroup = MapClientSocket.get(data.dest);
            DestInGroup.emit('message',{"message": chalk.yellow.bold(data.sender +' vous permet de rejoindre de nouveau le groupe '+data.group) ,"action":'server-unban'});
            db.serialize(()=>{
            //On supprime l'utilisateur du groupe
                db.run('DELETE FROM BAN WHERE BAN_GROUP=? AND BAN_CLIENT=? ', [data.group,data.dest])
                .run(`INSERT INTO EVENT VALUES(?,?)`, [data.group,data.sender +' a unban '+data.dest+' du groupe '+data.group])
                //Notification des personnes dans le groupe
                .each('SELECT MEM_CLIENT FROM MEMBRES WHERE MEM_GROUP= ?',[data.group],(err,row)=>{
                    if (err) {
                    throw err;
                    }
                    //On regarde si l'utilisateur est connecté pour le notifier
                    if(MapClientSocket.has(row.MEM_CLIENT)){
                        if(row.MEM_CLIENT == data.sender){
                            socket.emit('message',{"message": chalk.yellow.bold(' Vous avez unban '+data.dest+' du groupe '+data.group) ,"action":'server-unban'});
                        }
                        else {
                            userInGroup = MapClientSocket.get(row.MEM_CLIENT);
                            userInGroup.emit('message',{"message":chalk.yellow.bold(data.sender +" a unban "+data.dest+" du groupe "+data.group) ,"action":'server-gbroadcast'});
                        }
                                        
                    }
                });
            });

        }
    });
}


function handleStatesAction(socket,data) {
    //On regarde si le groupe existe
    db.each('SELECT COUNT(*) AS g FROM GROUPE WHERE G_NAME= ?',[data.group],(err,row)=>{
        if (err) {
          throw err;
        }
        //S'il existe pas on notifie l'utilisateur
        if(row.g == 0){
          socket.emit('message',{"message": chalk.yellow.bold('Le groupe ' +data.group+' n\'existe pas'),"action":'server-error'});
        }
        else{
          //On regarde si la personne est dans dans le groupe
          db.each('SELECT COUNT(*) AS YouInGroupe FROM MEMBRES WHERE MEM_CLIENT= ? AND MEM_GROUP=?',[data.sender,data.group],(err,row)=>{
                if (err) {
                throw err;
                }
                if(row.YouInGroupe == 0){
                    socket.emit('message',{"message": chalk.yellow.bold('Vous n\'etes pas dans ce groupe et ne pouvez donc pas voir ses événements') ,"action":'server-error'});
                }
                else{                     
                    db.all('SELECT  EV_CONTENT FROM EVENT WHERE EV_GROUP=?',[data.group],(err,row)=>{
                        var res='Les événements du groupe sont :' + '\n';
                        if (err) {
                        throw err;
                        }
                        row.forEach(function (row) {
                        res+=row.EV_CONTENT +'\n';
                        });
                        socket.emit('message',{sender: data.sender ,"message": chalk.yellow.bold(res), action:'server-states'});
                    });
                    //On rajoute l'évenement à la liste des évènements
                    db.run(`INSERT INTO EVENT VALUES(?,?)`, [data.group,data.sender +' a consulté la liste des événements parvenus dans le groupe '+data.group]);
                }
            });
        }
    });
}

function sendBroadcastMessage(socket, data) {
    socket.broadcast.emit('message', data);
};
