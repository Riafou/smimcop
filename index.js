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
                console.log(`\n📬 === NOUVEAU MESSAGE MUDAE - Compte ${accountIndex + 1} ===`);
                console.log(`📨 Message ID: ${message.id}`);
                console.log(`📝 Contenu: ${message.content || '(vide)'}`);
                console.log(`📄 Nombre d'embeds: ${message.embeds?.length || 0}`);
                
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
        
        console.log('\n🔍 === ANALYSE DES BOUTONS ===');
        
        if (!Array.isArray(message.components)) {
            console.log('❌ Aucun composant trouvé dans le message');
            return null;
        }
        
        console.log(`📦 Nombre de lignes de composants: ${message.components.length}`);
        
        let buttonCount = 0;
        let foundTarget = false;
        let targetCustomId = null;
        
        for (let rowIndex = 0; rowIndex < message.components.length; rowIndex++) {
            const row = message.components[rowIndex];
            const components = row?.components || [];
            console.log(`\n📋 Ligne ${rowIndex + 1}: ${components.length} composant(s)`);
            
            for (let compIndex = 0; compIndex < components.length; compIndex++) {
                const c = components[compIndex];
                buttonCount++;
                
                const buttonInfo = {
                    type: c?.type || 'UNKNOWN',
                    label: c?.label || '(sans label)',
                    customId: c?.customId || '(sans customId)',
                    disabled: c?.disabled ? 'OUI' : 'NON',
                    style: c?.style || 'N/A'
                };
                
                console.log(`  🔘 Bouton ${buttonCount}:`);
                console.log(`     - Type: ${buttonInfo.type}`);
                console.log(`     - Label: "${buttonInfo.label}"`);
                console.log(`     - Custom ID: ${buttonInfo.customId}`);
                console.log(`     - Désactivé: ${buttonInfo.disabled}`);
                console.log(`     - Style: ${buttonInfo.style}`);
                
                // Vérifier si c'est le bouton cible
                if (c?.type === 'BUTTON') {
                    const isTarget = !c.disabled && 
                                   c.label === TARGET_LABEL &&
                                   typeof c.customId === 'string' && 
                                   c.customId.length > 0;
                    
                    if (isTarget) {
                        foundTarget = true;
                        targetCustomId = c.customId;
                        console.log(`     ✅ C'EST LE BOUTON CIBLE (kakeraD) !`);
                    } else {
                        if (c.disabled) {
                            console.log(`     ⚠️  Ignoré: bouton désactivé`);
                        } else if (c.label !== TARGET_LABEL) {
                            console.log(`     ⚠️  Ignoré: label "${c.label}" ≠ "${TARGET_LABEL}"`);
                        } else if (typeof c.customId !== 'string' || c.customId.length === 0) {
                            console.log(`     ⚠️  Ignoré: customId invalide`);
                        }
                    }
                } else {
                    console.log(`     ⚠️  Ignoré: ce n'est pas un bouton`);
                }
            }
        }
        
        console.log(`\n📊 RÉSUMÉ: ${buttonCount} bouton(s) analysé(s)`);
        if (foundTarget) {
            console.log(`✅ Bouton cible trouvé ! Custom ID: ${targetCustomId}`);
        } else {
            console.log(`❌ Bouton cible "${TARGET_LABEL}" NON TROUVÉ`);
        }
        console.log('🔍 === FIN ANALYSE ===\n');
        
        return targetCustomId;
    }

    async tryClickKakeraButton(message, accountIndex) {
        console.log(`\n🎯 === TENTATIVE DE CLIC - Compte ${accountIndex + 1} ===`);
        console.log(`📨 Message ID: ${message.id}`);
        console.log(`👤 Auteur: ${message.author?.username || 'Unknown'} (${message.author?.id || 'Unknown'})`);
        
        // Vérifier l'embed
        const hasEmbed = this.embedFooterIncludes(message, 'Appartient à');
        console.log(`📄 Embed "Appartient à" détecté: ${hasEmbed ? '✅ OUI' : '❌ NON'}`);
        
        if (!hasEmbed) {
            console.log('⏭️  Arrêt: pas d\'embed "Appartient à"');
            console.log('🎯 === FIN TENTATIVE ===\n');
            return;
        }

        const customId = this.findSpecificKakeraButton(message);
        
        if (!customId) {
            console.log('⏭️  Arrêt: bouton kakeraD non trouvé');
            console.log('🎯 === FIN TENTATIVE ===\n');
            return;
        }

        // Utiliser l'ID du message comme clé unique pour éviter les doublons
        const messageId = message.id;
        
        // Si un clic est déjà en cours pour ce message, ignorer
        if (this.pendingClicks.has(messageId)) {
            console.log('⏭️  Arrêt: clic déjà en cours pour ce message');
            console.log('🎯 === FIN TENTATIVE ===\n');
            return;
        }

        // Marquer ce message comme en cours de traitement
        this.pendingClicks.set(messageId, true);
        console.log(`✅ Message marqué comme en cours de traitement`);

        // Seul le premier compte (index 0) initie la rotation
        if (accountIndex === 0) {
            console.log(`🚀 Compte ${accountIndex + 1} initie la rotation des clics`);
            console.log(`⏱️  ${this.clients.length} compte(s) vont cliquer avec un délai de 5s entre chacun`);
            // Lancer la rotation des clics pour tous les comptes
            for (let i = 0; i < this.clients.length; i++) {
                const delay = i * 5000; // 0s, 5s, 10s...
                
                console.log(`⏰ Compte ${i + 1} programmé pour cliquer dans ${delay}ms`);
                
                setTimeout(async () => {
                    console.log(`\n🖱️  === CLIC - Compte ${i + 1} ===`);
                    const now = Date.now();
                    const timeSinceLastClick = now - this.lastKakeraClickAt[i];
                    
                    if (timeSinceLastClick < 1500) {
                        console.log(`⏭️  Compte ${i + 1} ignoré: dernier clic il y a ${timeSinceLastClick}ms (< 1500ms)`);
                        console.log(`🖱️  === FIN CLIC ===\n`);
                        return;
                    }

                    try {
                        console.log(`📥 Récupération du message ${messageId} depuis le canal...`);
                        // Récupérer le message depuis le client du compte i
                        const channel = this.channels[i];
                        const msg = await channel.messages.fetch(messageId);
                        console.log(`✅ Message récupéré`);
                        
                        console.log(`🖱️  Clic sur le bouton avec customId: ${customId}`);
                        this.lastKakeraClickAt[i] = now;
                        await msg.clickButton(customId);
                        console.log(`✨ Compte ${i + 1} (${this.clients[i].user.username}) a cliqué sur kakeraD avec succès !`);
                    } catch (err) {
                        console.error(`❌ Erreur compte ${i + 1} lors du clic:`);
                        console.error(`   Message: ${err?.message || err}`);
                        console.error(`   Stack: ${err?.stack || 'N/A'}`);
                    }
                    console.log(`🖱️  === FIN CLIC ===\n`);
                }, delay);
            }

            // Nettoyer après le temps nécessaire pour tous les clics
            setTimeout(() => {
                this.pendingClicks.delete(messageId);
                console.log(`🧹 Message ${messageId} retiré de la liste des clics en cours`);
            }, this.clients.length * 5000 + 1000);
        } else {
            console.log(`⏭️  Compte ${accountIndex + 1} ignoré: seul le compte 1 initie la rotation`);
        }
        
        console.log('🎯 === FIN TENTATIVE ===\n');
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
