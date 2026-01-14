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

    // Fonction pour extraire tous les boutons d'un message (tente plusieurs méthodes)
    extractAllButtons(message) {
        const buttons = [];
        
        // Méthode 1: message.components (standard)
        if (Array.isArray(message.components)) {
            for (const row of message.components) {
                if (row?.components && Array.isArray(row.components)) {
                    buttons.push(...row.components);
                } else if (Array.isArray(row)) {
                    buttons.push(...row);
                }
            }
        }
        
        // Méthode 2: message.components comme objet
        if (buttons.length === 0 && message.components && typeof message.components === 'object') {
            const comps = message.components;
            if (Array.isArray(comps)) {
                buttons.push(...comps);
            } else {
                for (const key in comps) {
                    if (Array.isArray(comps[key])) {
                        buttons.push(...comps[key]);
                    }
                }
            }
        }
        
        // Méthode 3: Utiliser les méthodes de la bibliothèque si disponibles
        if (typeof message.components?.get === 'function') {
            // Si c'est une Collection
            buttons.push(...Array.from(message.components.values()));
        }
        
        return buttons;
    }

    findSpecificKakeraButton(message) {
        const TARGET_LABEL = 'kakeraD';
        
        console.log('\n🔍 === ANALYSE DES BOUTONS ===');
        console.log('🔬 Structure du message:');
        console.log(`   - message.components existe: ${!!message.components}`);
        console.log(`   - message.components type: ${Array.isArray(message.components) ? 'Array' : typeof message.components}`);
        
        // Essayer d'utiliser la méthode d'extraction
        const allButtons = this.extractAllButtons(message);
        console.log(`📦 ${allButtons.length} bouton(s) extrait(s) via extractAllButtons`);
        
        // Si aucune méthode n'a fonctionné, essayer l'accès direct
        let components = null;
        if (Array.isArray(message.components)) {
            components = message.components;
            console.log(`✅ Accès via message.components (Array)`);
        } else if (message.components && typeof message.components === 'object') {
            console.log('⚠️  message.components est un objet');
            components = message.components;
        }
        
        if (!components && allButtons.length === 0) {
            console.log('❌ Aucun composant trouvé dans le message');
            console.log('🔍 Toutes les clés du message:', Object.keys(message));
            return null;
        }
        
        let buttonCount = 0;
        let foundTarget = false;
        let targetCustomId = null;
        
        // Analyser les boutons extraits
        if (allButtons.length > 0) {
            console.log(`\n📋 Analyse de ${allButtons.length} bouton(s) extrait(s):`);
            for (let i = 0; i < allButtons.length; i++) {
                const c = allButtons[i];
                buttonCount++;
                this.analyzeButton(c, buttonCount, TARGET_LABEL, (found, customId) => {
                    if (found) {
                        foundTarget = true;
                        targetCustomId = customId;
                    }
                });
            }
        }
        
        // Analyser via la structure components standard
        if (components && Array.isArray(components)) {
            console.log(`\n📋 Analyse via structure components standard (${components.length} ligne(s)):`);
            for (let rowIndex = 0; rowIndex < components.length; rowIndex++) {
                const row = components[rowIndex];
                let rowComponents = null;
                
                if (row?.components && Array.isArray(row.components)) {
                    rowComponents = row.components;
                } else if (Array.isArray(row)) {
                    rowComponents = row;
                }
                
                if (rowComponents) {
                    for (let compIndex = 0; compIndex < rowComponents.length; compIndex++) {
                        const c = rowComponents[compIndex];
                        buttonCount++;
                        this.analyzeButton(c, buttonCount, TARGET_LABEL, (found, customId) => {
                            if (found) {
                                foundTarget = true;
                                targetCustomId = customId;
                            }
                        });
                    }
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

    analyzeButton(c, buttonNumber, targetLabel, callback) {
        console.log(`\n   🔬 Structure complète du composant ${buttonNumber}:`, JSON.stringify(c, null, 2));
        
        // Essayer différentes façons d'accéder au label
        let label = c?.label;
        if (!label && c?.data?.label) label = c.data.label;
        if (!label && c?.emoji?.name) label = c.emoji.name;
        if (!label && c?.data?.emoji?.name) label = c.data.emoji.name;
        
        // Essayer différentes façons d'accéder au customId
        let customId = c?.customId;
        if (!customId && c?.data?.custom_id) customId = c.data.custom_id;
        if (!customId && c?.data?.customId) customId = c.data.customId;
        if (!customId && c?.custom_id) customId = c.custom_id;
        
        // Essayer différentes façons d'accéder au type
        let type = c?.type;
        if (!type && c?.data?.type) type = c.data.type;
        // Type 2 = BUTTON dans Discord API
        const isButton = (type === 2 || type === 'BUTTON' || c?.type === 2 || c?.type === 'BUTTON');
        
        // Essayer différentes façons d'accéder à disabled
        let disabled = c?.disabled;
        if (disabled === undefined && c?.data?.disabled !== undefined) disabled = c.data.disabled;
        if (disabled === undefined) disabled = false;
        
        const buttonInfo = {
            type: type || 'UNKNOWN',
            label: label || '(sans label)',
            customId: customId || '(sans customId)',
            disabled: disabled ? 'OUI' : 'NON',
            style: c?.style || c?.data?.style || 'N/A'
        };
        
        console.log(`  🔘 Bouton ${buttonNumber}:`);
        console.log(`     - Type: ${buttonInfo.type} (raw: ${c?.type || c?.data?.type || 'N/A'})`);
        console.log(`     - Label: "${buttonInfo.label}" (raw: ${c?.label || c?.data?.label || 'N/A'})`);
        console.log(`     - Custom ID: ${buttonInfo.customId} (raw: ${c?.customId || c?.data?.custom_id || c?.custom_id || 'N/A'})`);
        console.log(`     - Désactivé: ${buttonInfo.disabled}`);
        console.log(`     - Style: ${buttonInfo.style}`);
        console.log(`     - Est un bouton: ${isButton}`);
        
        if (isButton) {
            const isTarget = !disabled && 
                           label === targetLabel &&
                           typeof customId === 'string' && 
                           customId.length > 0;
            
            if (isTarget) {
                console.log(`     ✅ C'EST LE BOUTON CIBLE (${targetLabel}) !`);
                callback(true, customId);
            } else {
                if (disabled) {
                    console.log(`     ⚠️  Ignoré: bouton désactivé`);
                } else if (label !== targetLabel) {
                    console.log(`     ⚠️  Ignoré: label "${label}" ≠ "${targetLabel}"`);
                } else if (typeof customId !== 'string' || customId.length === 0) {
                    console.log(`     ⚠️  Ignoré: customId invalide`);
                }
                callback(false, null);
            }
        } else {
            console.log(`     ⚠️  Ignoré: ce n'est pas un bouton (type: ${type})`);
            callback(false, null);
        }
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
