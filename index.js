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
        
        if (!message.components || message.components.length === 0) {
            console.log('❌ Aucun composant trouvé dans le message');
            return null;
        }
        
        console.log(`📦 Nombre de rangées (rows): ${message.components.length}`);
        
        let buttonCount = 0;
        let foundTarget = false;
        let targetCustomId = null;
        let targetButtonObject = null;
        
        // Utiliser exactement la même structure que dans loli.js qui fonctionne
        message.components.forEach((row, rowIndex) => {
            console.log(`\n📂 Rangée (Row) #${rowIndex + 1}`);
            
            if (!row.components || row.components.length === 0) {
                console.log('   ⚠️  Aucun composant dans cette rangée');
                return;
            }
            
            row.components.forEach((component, compIndex) => {
                buttonCount++;
                
                // Utiliser exactement la même structure que dans loli.js
                const label = component.label || component.emoji?.name || "Sans label";
                const customId = component.customId;
                const type = component.type;
                const disabled = component.disabled || false;
                const style = component.style;
                
                console.log(`   🔹 Bouton ${buttonCount}:`);
                console.log(`      Type: ${type}`);
                console.log(`      Label: "${label}"`);
                console.log(`      Style: ${style}`);
                console.log(`      🆔 Custom ID: "${customId || 'N/A'}"`);
                console.log(`      Disabled: ${disabled ? "Oui" : "Non"}`);
                
                // Vérifier si c'est un bouton et si c'est le bouton cible
                if (type === 'BUTTON' || type === 2) {
                    if (!disabled && label === TARGET_LABEL && customId) {
                        foundTarget = true;
                        targetCustomId = customId;
                        targetButtonObject = component;
                        console.log(`      ✅ C'EST LE BOUTON CIBLE (${TARGET_LABEL}) !`);
                    } else {
                        if (disabled) {
                            console.log(`      ⚠️  Ignoré: bouton désactivé`);
                        } else if (label !== TARGET_LABEL) {
                            console.log(`      ⚠️  Ignoré: label "${label}" ≠ "${TARGET_LABEL}"`);
                        } else if (!customId) {
                            console.log(`      ⚠️  Ignoré: pas de customId`);
                        }
                    }
                } else {
                    console.log(`      ⚠️  Ignoré: ce n'est pas un bouton (type: ${type})`);
                }
            });
        });
        
        console.log(`\n📊 RÉSUMÉ: ${buttonCount} bouton(s) analysé(s)`);
        if (foundTarget) {
            console.log(`✅ Bouton cible trouvé ! Custom ID: ${targetCustomId}`);
            // Stocker l'objet bouton dans le message pour utilisation ultérieure
            message._targetButton = targetButtonObject;
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
            
            // Stocker l'objet bouton pour utilisation ultérieure
            const targetButtonObject = message._targetButton;
            
            // Lancer la rotation des clics pour tous les comptes
            for (let i = 0; i < this.clients.length; i++) {
                const delay = i * 5000; // 0s, 5s, 10s...
                
                console.log(`⏰ Compte ${i + 1} programmé pour cliquer dans ${delay}ms`);
                
                // Capturer les variables dans la closure
                const accountIndexForClick = i;
                const customIdForClick = customId;
                
                setTimeout(async () => {
                    console.log(`\n🖱️  === CLIC - Compte ${accountIndexForClick + 1} ===`);
                    const now = Date.now();
                    const timeSinceLastClick = now - this.lastKakeraClickAt[accountIndexForClick];
                    
                    if (timeSinceLastClick < 1500) {
                        console.log(`⏭️  Compte ${accountIndexForClick + 1} ignoré: dernier clic il y a ${timeSinceLastClick}ms (< 1500ms)`);
                        console.log(`🖱️  === FIN CLIC ===\n`);
                        return;
                    }

                    try {
                        console.log(`📥 Récupération du message ${messageId} depuis le canal...`);
                        // Récupérer le message depuis le client du compte i
                        const channel = this.channels[accountIndexForClick];
                        const msg = await channel.messages.fetch(messageId);
                        console.log(`✅ Message récupéré`);
                        
                        console.log(`🖱️  Tentative de clic sur le bouton avec customId: ${customIdForClick}`);
                        this.lastKakeraClickAt[accountIndexForClick] = now;
                        
                        // Essayer différentes méthodes de clic
                        try {
                            // Méthode 1: customId directement
                            await msg.clickButton(customIdForClick);
                            console.log(`✨ Compte ${accountIndexForClick + 1} (${this.clients[accountIndexForClick].user.username}) a cliqué sur kakeraD avec succès (méthode 1) !`);
                        } catch (err1) {
                            console.log(`⚠️  Méthode 1 échouée: ${err1?.message || err1}`);
                            try {
                                // Méthode 2: Objet avec customId
                                await msg.clickButton({ customId: customIdForClick });
                                console.log(`✨ Compte ${accountIndexForClick + 1} (${this.clients[accountIndexForClick].user.username}) a cliqué sur kakeraD avec succès (méthode 2) !`);
                            } catch (err2) {
                                console.log(`⚠️  Méthode 2 échouée: ${err2?.message || err2}`);
                                try {
                                    // Méthode 3: Utiliser l'objet bouton si disponible
                                    if (targetButtonObject) {
                                        await msg.clickButton(targetButtonObject);
                                        console.log(`✨ Compte ${accountIndexForClick + 1} (${this.clients[accountIndexForClick].user.username}) a cliqué sur kakeraD avec succès (méthode 3) !`);
                                    } else {
                                        throw new Error('Aucune méthode de clic n\'a fonctionné');
                                    }
                                } catch (err3) {
                                    throw err3;
                                }
                            }
                        }
                    } catch (err) {
                        console.error(`❌ Erreur compte ${accountIndexForClick + 1} lors du clic:`);
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
