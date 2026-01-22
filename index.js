const { Client } = require('discord.js-selfbot-v13');

const TOKEN = process.env.TOKEN;
const TOKEN2 = process.env.TOKEN2;
const TOKEN3 = process.env.TOKEN3;
const CHANNEL_ID = process.env.CHANNEL_ID;
const MUDAE_ID = '432610292342587392';

class HaAutomation {
    constructor() {
        this.clients = [];
        this.isRunning = false;
        this.haInterval = null;
        this.channels = [];
        
        this.usCounter = 0;
        this.usInterval = null;
        // Ajout d'un état pour savoir si on est en mode reset
        this.isResetting = false; 
    }

    async login() {
        const tokens = [TOKEN, TOKEN2, TOKEN3].filter(t => t);
        
        if (tokens.length === 0) {
            process.exit(1);
        }

        try {
            for (let i = 0; i < tokens.length; i++) {
                const client = new Client({ checkUpdate: false });
                await client.login(tokens[i]);
                
                this.clients.push(client);
                
                const channel = await client.channels.fetch(CHANNEL_ID);
                this.channels.push(channel);
                
                this.setupListeners(client, i);
                console.log(`Compte ${i+1} connecté`);
            }
            
            // On démarre la boucle principale
            this.startHaLoop();
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    }

    setupListeners(client, accountIndex) {
        client.on('messageCreate', (message) => {
            // On vérifie que le message vient bien du channel ET de Mudae
            if (message.channelId === CHANNEL_ID && message.author.id === MUDAE_ID) {
                // On écoute seulement sur le compte principal pour éviter les doublons
                if (accountIndex === 0) {
                    this.checkForLimitMessage(message);
                }
            }
        });
    }

    checkForLimitMessage(message) {
        // Si on est déjà en train de faire les $us, on ignore les nouveaux messages
        if (this.isResetting) return;

        const content = message.content.toLowerCase(); // Conversion en minuscule pour être sûr

        if (content.includes("la roulette est limitée à") &&
            content.includes("utilisations par heure") &&
            content.includes("min d'attente")) {
            
            console.log("Limite détectée ! Passage en mode RESET ($us)");
            this.stopHaLoop();
            this.startUsLoop();
        }
    }

    startHaLoop() {
        // Sécurité : Si déjà en route ou si en mode reset, on ne fait rien
        if (this.haInterval || this.isResetting) return;

        console.log("Démarrage de la boucle $ha");
        this.isRunning = true;

        this.haInterval = setInterval(() => {
            if (this.channels.length > 0) {
                this.channels[0].send('$ha').catch(e => console.log("Erreur envoi $ha"));
            }
        }, 3000); // 3 secondes
    }

    stopHaLoop() {
        if (this.haInterval) {
            clearInterval(this.haInterval);
            this.haInterval = null;
        }
        this.isRunning = false;
    }

    startUsLoop() {
        // Sécurité CRITIQUE : Si un intervalle US existe déjà, on arrête tout de suite
        if (this.usInterval) return;

        this.isResetting = true;
        this.usCounter = 0;

        // On s'assure que le $ha est bien coupé
        this.stopHaLoop();

        console.log("Démarrage de la boucle $us 20");
        
        this.usInterval = setInterval(() => {
            if (this.usCounter < 50 && this.channels.length > 0) {
                this.channels[0].send('$us 20').catch(e => console.log("Erreur envoi $us"));
                this.usCounter++;
            } else {
                // Une fois fini, on nettoie proprement et on relance HA
                this.stopUsLoop();
                this.startHaLoop();
            }
        }, 1100); // Légèrement augmenté à 1.1s pour éviter le rate limit Discord
    }

    stopUsLoop() {
        if (this.usInterval) {
            clearInterval(this.usInterval);
            this.usInterval = null;
        }
        this.usCounter = 0;
        this.isResetting = false; // On libère le verrou
        console.log("Fin de la boucle $us, retour à la normale.");
    }
}

const bot = new HaAutomation();
bot.login();
