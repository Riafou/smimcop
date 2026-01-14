const { Client } = require('discord.js-selfbot-v13');

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const MUDAE_ID = '432610292342587392';

class HaAutomation {
    constructor() {
        this.client = new Client({ checkUpdate: false });
        this.isRunning = false;
        this.haInterval = null;
        this.channel = null;
        this.nextScheduledTime = null;
        this.usCounter = 0;
        this.usInterval = null;
        this.lastKakeraClickAt = 0;
    }

    async login() {
        try {
            await this.client.login(TOKEN);
            console.log(`✅ Connecté en tant que ${this.client.user.username}`);
            this.setupListeners();
            this.channel = await this.client.channels.fetch(CHANNEL_ID);
            this.startHaLoop();
        } catch (err) {
            console.error("❌ Erreur de connexion:", err);
            process.exit(1);
        }
    }

    setupListeners() {
        this.client.on('messageCreate', (message) => {
            if (message.channelId === CHANNEL_ID && message.author.id === MUDAE_ID) {
                this.checkForLimitMessage(message);
                this.tryClickKakeraButton(message);
            }
        });
    }

    embedFooterIncludes(message, needle) {
        return Array.isArray(message.embeds) && message.embeds.some(e => (e?.footer?.text || '').includes(needle));
    }

    findSpecificKakeraButton(message) {
        const TARGET_LABEL = 'kakeraC';
        
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

    async tryClickKakeraButton(message) {
        if (!this.embedFooterIncludes(message, 'Appartient à')) return;

        const now = Date.now();
        if (now - this.lastKakeraClickAt < 1500) return;

        const customId = this.findSpecificKakeraButton(message);
        if (!customId) return;

        try {
            this.lastKakeraClickAt = now;
            await message.clickButton(customId);
            console.log('✨ Bouton kakeraC cliqué (détection par label)');
        } catch (err) {
            console.error('❌ Erreur lors du clic du bouton kakera:', err?.message || err);
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
            if (this.isRunning && this.channel) {
                this.channel.send('$ha').catch(err => {
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
            if (this.usCounter < 50 && this.channel) {
                this.channel.send('$us 20').catch(err => {
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
