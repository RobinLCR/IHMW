var name; // nom du groupe
var users; // liste des utilisateurs du groupe, associés à leur socket
var actions; // liste des événements survenus dans le groupe
var messages; // liste des messages du groupe (je gère ici uniquement les broadcast et non les notifications)
var bannis; // liste les personnes interdites de venir dans le groupe
var visibilité; //Désigne si le groupe est privé ou public

function Groupe(nom_groupe){
    this.name=nom_groupe;
    this.users = new Map();
    this.actions =[];
    this.messages=[];
    this.bannis=new Map();
    this.visibilité="";
}

Groupe.prototype.joindreGroupe = function(name_user){
    this.users.set(name_user);
}

Groupe.prototype.leaveGroupe = function(name_user){
    this.users.delete(name_user);
}


Groupe.prototype.liste = function(){
    listing = "Les personnes présentes dans le groupe sont :" + '\n';
    this.users.forEach(function(sock,nom){  //on parcours la map d'users du groupe 
        listing += nom + '\n';                     
    });
    return listing;
}

Groupe.prototype.getGroupe = function(nom_groupe){
     return this.users;
}

Groupe.prototype.ajoutMsg = function(message){
    this.messages.push(message);
}

Groupe.prototype.listeMessages = function(){
    listing = "Les messages échangés dans le groupe sont :" + '\n';
    this.messages.forEach(function(i){   
        
        listing += i + '\n';                     
    });
    return listing;
}

Groupe.prototype.ajoutState = function(action, name){
    this.actions.push(action + " provenant de "+name);
}

Groupe.prototype.listeState = function(){
    listing = "Les actions effectuées dans le groupe sont :" + '\n';
    this.actions.forEach(function(i){   
        
        listing += i + '\n';                     
    });
    return listing;
}

Groupe.prototype.ajoutBan = function(name,raison){
    this.bannis.set(name,raison);
}

Groupe.prototype.unBan = function(name){
    this.bannis.delete(name);
}

Groupe.prototype.isBan = function(name){
    if(this.bannis.has(name)){
        return true;
    }
    else {return false;}
}

module.exports=Groupe;