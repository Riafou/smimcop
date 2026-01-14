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
        this.nextScheduledTime = null;
        this.usCounter = 0;
        this.usInterval = null;
    }

    async login() {
        const tokens = [TOKEN, TOKEN2, TOKEN3].filter(t => t);
        
        if (tokens.length === 0) {
            console.error("❌ Aucun token fourni");
            process.exit(1);
        }

        try {
            for (let i = 0; i < tokens.length; i++) {
                const client = new Client({ checkUpdate: false });
                await client.login(tokens[i]);
                console.log(`✅ Compte ${i + 1} connecté: ${client.user.username}`);
                
                this.clients.push(client);
                
                const channel = await client.channels.fetch(CHANNEL_ID);
                this.channels.push(channel);
                
                this.setupListeners(client, i);
            }
            
            console.log(`✅ ${this.clients.length} compte(s) connecté(s)`);
            this.startHaLoop();
        } catch (err) {
            console.error("❌ Erreur de connexion:", err);
            process.exit(1);
        }
    }

    setupListeners(client, accountIndex) {
        client.on('messageCreate', (message) => {
            if (message.channelId === CHANNEL_ID && message.author.id === MUDAE_ID) {
                // Seul le premier compte vérifie les limites
                if (accountIndex === 0) {
                    this.checkForLimitMessage(message);
                }
            }
        });
    }


    checkForLimitMessage(message) {
        const content = message.content;

        if (content.includes("la roulette est limitée à") &&
            content.includes("utilisations par heure") &&
            content.includes("min d'attente")) {

            const match = content.match(/(\d+)\s+min d'attente/);
            const waitMinutes = match ? match[1] : "?";

            console.log(`🛑 Message de limite détecté ! Attente: ${waitMinutes} min`);
            this.stopHaLoop();
            this.startUsLoop();
        }
    }

    startHaLoop() {
        if (this.isRunning) return;

        this.isRunning = true;
        console.log("🚀 Démarrage de l'envoi de $ha toutes les 3 secondes...");

        this.haInterval = setInterval(() => {
            if (this.isRunning && this.channels.length > 0) {
                // Seul le premier compte envoie $ha
                this.channels[0].send('$ha').catch(err => {
                    console.error("❌ Erreur envoi $ha:", err);
                });
            }
        }, 3000);
    }

    stopHaLoop() {
        if (this.haInterval) {
            clearInterval(this.haInterval);
            this.haInterval = null;
        }
        this.isRunning = false;
        console.log("⏸️  Arrêt de l'envoi de $ha");
    }

    startUsLoop() {
        this.usCounter = 0;
        console.log("💰 Démarrage de l'envoi de $us 20 (50 fois)...");

        this.usInterval = setInterval(() => {
            if (this.usCounter < 50 && this.channels.length > 0) {
                // Seul le premier compte envoie $us
                this.channels[0].send('$us 20').catch(err => {
                    console.error("❌ Erreur envoi $us 20:", err);
                });
                this.usCounter++;
                console.log(`💰 $us 20 envoyé (${this.usCounter}/50)`);
            } else {
                this.stopUsLoop();
                console.log("✅ Phase $us terminée, reprise des invocations $ha...");
                this.startHaLoop();
            }
        }, 1000);
    }

    stopUsLoop() {
        if (this.usInterval) {
            clearInterval(this.usInterval);
            this.usInterval = null;
        }
        this.usCounter = 0;
    }

    scheduleNextRun() {
        const now = new Date();
        const next = new Date();

        next.setMinutes(17);
        next.setSeconds(0);
        next.setMilliseconds(0);

        if (next <= now) {
            next.setHours(next.getHours() + 1);
        }

        this.nextScheduledTime = next;
        const delay = next - now;

        console.log(`⏰ Prochain lancement programmé à ${next.toLocaleTimeString('fr-FR')}`);

        setTimeout(() => {
            console.log("⏰ Heure de relance atteinte !");
            this.startHaLoop();
        }, delay);
    }
}

const bot = new HaAutomation();
bot.login();
