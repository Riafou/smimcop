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
        this.lastKakeraClickAt = [];
        this.pendingClicks = new Map(); // Pour gérer les clics en rotation
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
                this.lastKakeraClickAt.push(0);
                
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
                this.tryClickKakeraButton(message, accountIndex);
            }
        });
    }

    embedFooterIncludes(message, needle) {
        return Array.isArray(message.embeds) && message.embeds.some(e => (e?.footer?.text || '').includes(needle));
    }

    findSpecificKakeraButton(message) {
        const TARGET_LABEL = 'kakeraD';
        
        if (!Array.isArray(message.components)) return null;
        for (const row of message.components) {
            const components = row?.components || [];
            for (const c of components) {
                if (c?.type === 'BUTTON' && 
                    !c.disabled && 
                    c.label === TARGET_LABEL &&
                    typeof c.customId === 'string' && 
                    c.customId.length > 0) {
                    return c.customId;
                }
            }
        }
        return null;
    }

    async tryClickKakeraButton(message, accountIndex) {
        if (!this.embedFooterIncludes(message, 'Appartient à')) return;

        const customId = this.findSpecificKakeraButton(message);
        if (!customId) return;

        // Utiliser l'ID du message comme clé unique pour éviter les doublons
        const messageId = message.id;
        
        // Si un clic est déjà en cours pour ce message, ignorer
        if (this.pendingClicks.has(messageId)) {
            return;
        }

        // Marquer ce message comme en cours de traitement
        this.pendingClicks.set(messageId, true);

        // Seul le premier compte (index 0) initie la rotation
        if (accountIndex === 0) {
            // Lancer la rotation des clics pour tous les comptes
            for (let i = 0; i < this.clients.length; i++) {
                const delay = i * 5000; // 0s, 5s, 10s...
                
                setTimeout(async () => {
                    const now = Date.now();
                    if (now - this.lastKakeraClickAt[i] < 1500) {
                        console.log(`⏭️  Compte ${i + 1} ignoré (trop tôt)`);
                        return;
                    }

                    try {
                        // Récupérer le message depuis le client du compte i
                        const channel = this.channels[i];
                        const msg = await channel.messages.fetch(messageId);
                        
                        this.lastKakeraClickAt[i] = now;
                        await msg.clickButton(customId);
                        console.log(`✨ Compte ${i + 1} (${this.clients[i].user.username}) a cliqué sur kakeraD`);
                    } catch (err) {
                        console.error(`❌ Erreur compte ${i + 1} lors du clic:`, err?.message || err);
                    }
                }, delay);
            }

            // Nettoyer après le temps nécessaire pour tous les clics
            setTimeout(() => {
                this.pendingClicks.delete(messageId);
            }, this.clients.length * 5000 + 1000);
        }
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
