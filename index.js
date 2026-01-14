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
            }
            
            this.startHaLoop();
        } catch (err) {
            process.exit(1);
        }
    }

    setupListeners(client, accountIndex) {
        client.on('messageCreate', (message) => {
            if (message.channelId === CHANNEL_ID && message.author.id === MUDAE_ID) {
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
            this.stopHaLoop();
            this.startUsLoop();
        }
    }

    startHaLoop() {
        if (this.isRunning) return;

        this.isRunning = true;

        this.haInterval = setInterval(() => {
            if (this.isRunning && this.channels.length > 0) {
                this.channels[0].send('$ha').catch(() => {});
            }
        }, 3000);
    }

    stopHaLoop() {
        if (this.haInterval) {
            clearInterval(this.haInterval);
            this.haInterval = null;
        }
        this.isRunning = false;
    }

    startUsLoop() {
        this.usCounter = 0;

        this.usInterval = setInterval(() => {
            if (this.usCounter < 50 && this.channels.length > 0) {
                this.channels[0].send('$us 20').catch(() => {});
                this.usCounter++;
            } else {
                this.stopUsLoop();
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

        setTimeout(() => {
            this.startHaLoop();
        }, delay);
    }
}

const bot = new HaAutomation();
bot.login();
