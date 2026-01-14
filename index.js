const { Client } = require('discord.js-selfbot-v13');

const TOKEN = process.env.TOKEN;
const TOKEN2 = process.env.TOKEN2;
const TOKEN3 = process.env.TOKEN3;
const CHANNEL_ID = process.env.CHANNEL_ID;
const MUDAE_ID = '432610292342587392';

// Configuration pour les boutons kakera
const KAKERA_CONFIG = {
    targetButtonLabel: 'kakeraD', // Le label du bouton à cliquer
    clickInterval: 5000 // Temps d'attente entre chaque compte (en millisecondes)
};

// Fonction utilitaire pour faire des pauses
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
        client.on('messageCreate', async (message) => {
            if (message.channelId === CHANNEL_ID && message.author.id === MUDAE_ID) {
                // Seul le premier compte vérifie les limites et les boutons kakera
                if (accountIndex === 0) {
                    this.checkForLimitMessage(message);
                    // Vérifier les boutons kakera
                    await this.checkForKakeraButton(message);
                }
            }
        });
    }


    findTargetButtonAndLog(message) {
        if (!message.components || message.components.length === 0) return null;

        let foundId = null;

        // On n'affiche les logs détaillés que si le message contient des boutons
        console.log(`\n📨 Message Mudae détecté (ID: ${message.id})...`);

        message.components.forEach((row, rowIndex) => {
            row.components.forEach((btn, btnIndex) => {
                if (btn.type === 'BUTTON') {
                    const label = btn.label || "AUCUN_LABEL";
                    const emojiName = btn.emoji ? btn.emoji.name : "AUCUN_EMOJI";
                    const customId = btn.customId;

                    // Log pour debug (utile pour vérifier le nom exact)
                    console.log(`   🔸 Btn [${rowIndex+1}-${btnIndex+1}] : Emoji="${emojiName}" | Label="${label}"`);

                    // Vérification de correspondance
                    if (!btn.disabled && (emojiName === KAKERA_CONFIG.targetButtonLabel || label === KAKERA_CONFIG.targetButtonLabel)) {
                        console.log(`       ✅ CORRESPONDANCE TROUVÉE !`);
                        foundId = customId;
                    }
                }
            });
        });

        return foundId;
    }

    async executeClickSequence(messageId, customId) {
        // Boucle sur chaque compte connecté
        for (let i = 0; i < this.clients.length; i++) {
            const client = this.clients[i];
            
            try {
                // 1. Récupération du channel
                const channel = await client.channels.fetch(CHANNEL_ID);
                
                // 2. Récupération du message
                const messageToClick = await channel.messages.fetch(messageId);

                if (messageToClick) {
                    console.log(`👉 Compte ${i + 1} (${client.user.username}) se prépare à cliquer...`);
                    
                    // Petit délai humain aléatoire (entre 0.2s et 0.8s) avant de cliquer
                    await wait(Math.random() * 600 + 200);

                    await messageToClick.clickButton(customId);
                    console.log(`✨ Compte ${i + 1} : Clic réussi.`);
                } else {
                    console.log(`⚠️ Compte ${i + 1} : Message introuvable (supprimé ?).`);
                }

            } catch (err) {
                console.error(`❌ Erreur Compte ${i + 1} : ${err.message}`);
            }

            // 3. Pause de 5 secondes avant le prochain compte (sauf si c'est le dernier)
            if (i < this.clients.length - 1) {
                console.log(`⏳ Pause de ${KAKERA_CONFIG.clickInterval / 1000} secondes...`);
                await wait(KAKERA_CONFIG.clickInterval);
            }
        }
        console.log("🏁 Séquence terminée pour ce message.\n");
    }

    async checkForKakeraButton(message) {
        // Vérifier si le message contient un embed avec "Appartient à" dans le footer
        const hasEmbed = Array.isArray(message.embeds) && 
                        message.embeds.some(e => (e?.footer?.text || '').includes('Appartient à'));
        
        if (!hasEmbed) return;

        // Analyser les boutons pour trouver la cible
        const targetCustomId = this.findTargetButtonAndLog(message);

        // Si trouvé, on lance la séquence de clics
        if (targetCustomId) {
            console.log(`\n💎 CIBLE VALIDÉE ! Démarrage de la séquence multi-comptes...`);
            await this.executeClickSequence(message.id, targetCustomId);
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
